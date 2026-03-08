import logging
from typing import Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from backend.agents.orchestrator import (
    route_to_persona,
    submit_evidence,
    get_active_hint,
    get_game_state,
    advance_phase
)
from backend.agents.progress import calculate_progress_score, should_show_meter, get_flavor_text
from backend.agents.orchestration.hints import wrong_direction_detector, get_passive_hint
from backend.agents.orchestration.state import get_or_create_session

log = logging.getLogger(__name__)

router = APIRouter()

# --- Pydantic Models ---

class InterviewRequest(BaseModel):
    session_id: str
    character_id: str
    message: str

class EvidenceRequest(BaseModel):
    session_id: str
    evidence_id: str

class HintRequest(BaseModel):
    session_id: str

# --- API Endpoints ---

@router.post("/interview")
def interview_character(req: InterviewRequest):
    """
    Step 26: Routes player message to persona, calculates score/meter, 
    evaluates wrong direction heuristics, appends passive hints, 
    checks phase advancement, and returns the assembled payload.
    """
    try:
        # 1. Base Routing
        base_result = route_to_persona(req.character_id, req.message, req.session_id)
        if "error" in base_result:
            raise HTTPException(status_code=400, detail=base_result["error"])
            
        session_state = get_or_create_session(req.session_id)
        
        # 2. Progress Calculation
        raw_score = calculate_progress_score(session_state)
        session_state["progress_score"] = raw_score # Keep state updated
        
        # 3. Meter Display Logic
        show_meter = should_show_meter(session_state)
        meter_flavor_text = None
        if show_meter:
            import time
            meter_flavor_text = get_flavor_text(raw_score, session_state)
            session_state["last_meter_shown_timestamp"] = time.time()
            session_state["last_meter_score"] = raw_score
            
        # 4. Wrong Direction & Passive Hints (Logic extracted from internal router logic for API assembly)
        session_history = session_state.get("session_history", [])
        struggle_score = wrong_direction_detector(session_state, session_history)
        
        response_text = base_result["response"]
        passive_hint_text = None
        
        if struggle_score >= 2:
            phase = session_state.get("current_phase", 1)
            found_contradictions = len(session_state.get("found_contradictions", []))
            early_acc = any(inter.get("action") == "ACCUSATION" for inter in session_history)
            
            if early_acc and phase in [1, 2]:
                trigger_type = "too_early_accusation"
            elif phase == 1 and len(session_history) > 15 and found_contradictions == 0:
                trigger_type = "phase_stalled"
            elif len(session_state.get("questioned_characters", set())) <= 2 and len(session_history) > 8:
                trigger_type = "not_spreading"
            else:
                trigger_type = "stuck_on_suspect"
                
            passive_hint_text = get_passive_hint(req.character_id, trigger_type, session_state)
            
            if passive_hint_text:
                response_text = f"{response_text}\n\n{passive_hint_text}"
                
            session_state["session_history"] = []
            
        # 5. Advancement Checks
        advanced = advance_phase(req.session_id)
        
        # Assemble Full Return Object
        return {
            "character_id": req.character_id,
            "response": response_text,
            "stress": base_result.get("stress", 0.0),
            "questioned_characters": list(session_state.get("questioned_characters", set())),
            "phase": session_state.get("current_phase", 1),
            "progress_score": raw_score,
            "show_meter": show_meter,
            "meter_flavor_text": meter_flavor_text,
            "phase_advanced": advanced
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Interview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evidence")
def present_evidence(req: EvidenceRequest):
    try:
        result = submit_evidence(req.session_id, req.evidence_id)
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Evidence error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hint")
def request_hint(req: HintRequest):
    try:
        return get_active_hint(req.session_id)
    except Exception as e:
        log.error(f"Hint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state/{session_id}")
def fetch_state(session_id: str):
    try:
        return get_game_state(session_id)
    except Exception as e:
        log.error(f"State retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Note: Additional 2 endpoints required to make "all six" endpoints.
@router.post("/reset/{session_id}")
def reset_session(session_id: str):
    from backend.agents.orchestration.state import sessions
    if session_id in sessions:
        del sessions[session_id]
        return {"status": "success", "message": "Session reset"}
    return {"status": "error", "message": "Session not found"}

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "cold-case-api"}
