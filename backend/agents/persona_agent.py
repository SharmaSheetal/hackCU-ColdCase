import os
import json
import logging
from typing import List, Dict, Any

from google import genai
from google.genai import types

from backend.config import settings
from backend.agents.tools import query_character_knowledge, log_claim, query_tool, log_tool

log = logging.getLogger(__name__)

# Basic identity prompts map (for easy testing now, can load from DB later)
from backend.agents.prompts.victor_prompt import VICTOR_SYSTEM_PROMPT
from backend.agents.prompts.martha_prompt import MARTHA_SYSTEM_PROMPT
from backend.agents.prompts.hayes_prompt import HAYES_SYSTEM_PROMPT
from backend.agents.prompts.dr_collins_prompt import DR_COLLINS_SYSTEM_PROMPT
from backend.agents.prompts.rose_prompt import ROSE_SYSTEM_PROMPT

PROMPT_MAP = {
    "victor": VICTOR_SYSTEM_PROMPT,
    "martha": MARTHA_SYSTEM_PROMPT,
    "hayes": HAYES_SYSTEM_PROMPT,
    "dr_collins": DR_COLLINS_SYSTEM_PROMPT,
    "rose": ROSE_SYSTEM_PROMPT
}

class PersonaAgent:
    def __init__(self, character_id: str, knowledge_cutoff: str, stress: float = 0.3):
        """
        Initializes a Gemini-driven character agent.
        
        Args:
            character_id: String ID of the character (e.g. 'victor')
            knowledge_cutoff: ISO datetime string representing the latest point in time this character knows about.
            stress: Current emotional stress modifier (0.0 to 1.0).
        """
        self.character_id = character_id
        self.knowledge_cutoff = knowledge_cutoff
        self.stress = stress
        self.session_history: List[Dict[str, str]] = []
        
        # Load the appropriate system prompt (defaulting if missing for safety)
        self.system_prompt = PROMPT_MAP.get(
            character_id, 
            f"You are {character_id}. You are a suspect in a mystery."
        )
        
        # Instantiate Gemini GenAI Client
        self.client = genai.Client(api_key=settings.gemini_api_key)
        
    def update_stress(self, delta: float):
        """
        Step 18: Modulates the character's stress level, clamping between 0.0 and 1.0.
        """
        self.stress = max(0.0, min(1.0, self.stress + delta))
        log.info(f"[{self.character_id}] Stress updated by {delta}. New level: {self.stress:.2f}/1.0")

    def _build_context_prompt(self) -> str:
        """Injects dynamic variables (like stress) into the system prompt."""
        dynamic_context = f"\n\n[DYNAMIC STATE]\nYour current stress level is: {self.stress}/1.0."
        
        # Step 18: High Stress Instruction Injection
        if self.stress > 0.7:
            dynamic_context += (
                "\n\nYou are becoming visibly flustered. Your composure is slipping slightly. "
                "You may over-explain, use your defensive catchphrases more than usual, and "
                "accidentally let small details through that you would normally suppress."
            )
            
        return self.system_prompt + dynamic_context
        
    def respond(self, player_message: str, session_id: str) -> str:
        """
        Sends the player message to the LLM. Automatically handles tool calls 
        (like searching their Neo4j memory) and returns the final character dialogue.
        """
        log.info(f"[{self.character_id}] Player asks: {player_message}")
        
        # 1. Structure the tools we want to give to Gemini
        gemini_tools = [{"function_declarations": [query_tool, log_tool]}]
        
        # 2. Append the new message to history
        self.session_history.append({"role": "user", "content": player_message})
        
        # 3. Create a chat session with the client
        # Currently, Google GenAI SDK `chats.create` prefers string messages. 
        # We start a new chat instance and replay history if needed, or rely on 
        # the chat state for a single conversation thread.
        
        from backend.agents.llm_client import execute_with_fallback
        
        def _attempt_chat_completion(active_client, msg, system_msg, tools_config):
            chat = active_client.chats.create(
                model="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    system_instruction=system_msg,
                    tools=tools_config,
                    temperature=0.7 # Need a bit of personality for characters
                )
            )
            return chat.send_message(msg), chat

        context_prompt = self._build_context_prompt()
        
        try:
            response, active_chat = execute_with_fallback(
                _attempt_chat_completion, 
                player_message, 
                context_prompt, 
                gemini_tools
            )
        except Exception as e:
            log.error(f"Failed to generate response across all fallback API keys: {e}")
            return "I... I need a moment. (Rate Limit Reached)"
        
        # 4. Handle tool calls if the LLM wants to check memory or log a claim
        if response.function_calls:
            tool_responses = []
            
            for function_call in response.function_calls:
                func_name = function_call.name
                args = function_call.args
                
                log.info(f"[{self.character_id}] Model is calling tool: {func_name}")
                
                # Execute query_character_knowledge
                if func_name == "query_character_knowledge":
                    # Make sure the LLM isn't hallucinating its own character ID or cutoff
                    cid = args.get("character_id", self.character_id)
                    q = args.get("query", "")
                    cutoff = args.get("before_timestamp", self.knowledge_cutoff)
                    
                    tool_result = query_character_knowledge(cid, q, cutoff)
                    
                    tool_responses.append(
                        types.Part.from_function_response(
                            name=func_name,
                            response={"result": tool_result}
                        )
                    )
                    
                # Execute log_claim
                elif func_name == "log_claim":
                    cid = args.get("character_id", self.character_id)
                    claim_text = args.get("claim_text", "")
                    q_asked = args.get("question_asked", player_message)
                    sid = args.get("session_id", session_id)
                    
                    tool_result = log_claim(sid, cid, claim_text, q_asked)
                    
                    tool_responses.append(
                        types.Part.from_function_response(
                            name=func_name,
                            response={"result": tool_result}
                        )
                    )
            
            # Send all tool responses back to Gemini together so it can generate final dialogue
            if tool_responses:
                def _attempt_tool_reply(active_client):
                    return active_chat.send_message(tool_responses)
                    
                try:
                    response = execute_with_fallback(_attempt_tool_reply)
                except Exception as e:
                    log.error(f"Failed to generate tool response across API keys: {e}")
                    return "I... I need a moment. (Rate Limit Reached)"
                    
        # 5. Save the final model response to history and return it
        # If the model called a tool but didn't return text in the first pass, 
        # the subsequent round (after we fed it the tool responses) will have the .text
        final_text = response.text
        
        # If still none, there might be a bug with the SDK tool loop
        if final_text is None:
            final_text = "..."
            
        self.session_history.append({"role": "model", "content": final_text})
        
        return final_text

if __name__ == "__main__":
    # Test script for Step 5
    logging.basicConfig(level=logging.INFO)
    
    # Instantiate Victor
    print("--- Instantiating Victor ---")
    victor = PersonaAgent(
        character_id="victor",
        knowledge_cutoff="2024-01-15T00:05:00",
        stress=0.3
    )
    
    test_message = "Did you enter the judges' lounge tonight?"
    print(f"\nPlayer: {test_message}")
    
    # Send the test message
    response = victor.respond(
        player_message=test_message,
        session_id="test_session_123"
    )
    
    print("\nVictor:")
    print(response)
