from fastapi import APIRouter

from backend.api.models import (
    AccusationRequest,
    AccusationResponse,
    ContradictionEvent,
    EvidenceSubmitRequest,
    GameStateResponse,
    HintRequest,
    HintResponse,
    InterviewRequest,
    InterviewResponse,
    ProgressData,
    SessionStartResponse
)
from backend.api.session import get_or_create_session


router = APIRouter()


@router.post("/interview", response_model=InterviewResponse)
def interview_character(payload: InterviewRequest):
    session = get_or_create_session(payload.session_id)

    if payload.character_id not in session["questioned_characters"]:
        session["questioned_characters"].append(payload.character_id)

    contradiction = ContradictionEvent(
        contradiction_id="contradiction_001",
        characters=["victor", "martha"],
        claim_a="Victor said he never entered the demo hall after 6 PM.",
        claim_b="Martha said she saw Victor near the backstage entrance after 6 PM.",
    )

    if not any(
        item.get("contradiction_id") == contradiction.contradiction_id
        for item in session["found_contradictions"]
    ):
        session["found_contradictions"].append(contradiction.dict())

    session["last_meter_score"] = 15
    session["session_history"].append(
        {
            "type": "interview",
            "character_id": payload.character_id,
            "player_message": payload.player_message,
        }
    )

    # TODO: replace with real orchestrator call
    return InterviewResponse(
        response_text=(
            f"{payload.character_id.title()} looks uneasy and gives a guarded answer. "
            "Something about the timeline feels inconsistent."
        ),
        active_fact_ids=["fact_victor_timeline", "fact_backstage_sighting"],
        stress_level=0.42,
        contradiction_event=contradiction,
        progress=ProgressData(
            show=True,
            score=15,
            label="Something doesn't add up",
            flavor_text="You noticed a crack in their version of events.",
        ),
        hint_injected=False,
    )


@router.post("/submit-evidence", response_model=GameStateResponse)
def submit_evidence(payload: EvidenceSubmitRequest):
    session = get_or_create_session(payload.session_id)

    if payload.evidence_id not in session["submitted_evidence"]:
        session["submitted_evidence"].append(payload.evidence_id)

    if payload.evidence_id not in session["unlocked_evidence"]:
        session["unlocked_evidence"].append(payload.evidence_id)

    session["progress_score"] = len(session["found_contradictions"]) * 10 + len(session["submitted_evidence"]) * 5
    session["session_history"].append(
        {
            "type": "submit_evidence",
            "evidence_id": payload.evidence_id,
        }
    )

    # TODO: replace with real orchestrator call
    return GameStateResponse(
        phase=session["phase"],
        questioned_characters=session["questioned_characters"],
        found_contradictions=[
            ContradictionEvent(**item) for item in session["found_contradictions"]
        ],
        unlocked_evidence=session["unlocked_evidence"],
        available_endings=["1", "2"] if session["phase"] >= 2 else [],
        hints_used=session["hints_used"],
        progress_score=session["progress_score"],
    )


@router.get("/game-state/{session_id}", response_model=GameStateResponse)
def get_game_state(session_id: str):
    session = get_or_create_session(session_id)

    progress_score = len(session["found_contradictions"]) * 10 + len(session["submitted_evidence"]) * 5

    # TODO: replace with real orchestrator call
    return GameStateResponse(
        phase=session["phase"],
        questioned_characters=session["questioned_characters"],
        found_contradictions=[
            ContradictionEvent(**item) for item in session["found_contradictions"]
        ],
        unlocked_evidence=session["unlocked_evidence"],
        available_endings=["1"] if progress_score >= 10 else [],
        hints_used=session["hints_used"],
        progress_score=progress_score,
    )


@router.post("/hint", response_model=HintResponse)
def get_hint(payload: HintRequest):
    session = get_or_create_session(payload.session_id)

    session["hints_used"] += 1
    session["shown_passive_hints"].append("Try comparing Victor's timeline with Martha's statement.")
    session["session_history"].append({"type": "hint"})

    # TODO: replace with real orchestrator call
    return HintResponse(
        hint_text="Try comparing Victor's timeline with Martha's statement.",
        cooldown_remaining=0,
        hints_used=session["hints_used"],
    )


@router.post("/accuse", response_model=AccusationResponse)
def accuse(payload: AccusationRequest):
    session = get_or_create_session(payload.session_id)
    session["session_history"].append(
        {
            "type": "accuse",
            "ending_choice": payload.ending_choice,
        }
    )

    ending_map = {
        1: "You accuse Victor of staging the incident for publicity.",
        2: "You argue the collapse was a chain reaction caused by sabotage and panic.",
        3: "You present the full hidden truth behind Julian's final stunt.",
    }

    # TODO: replace with real orchestrator call
    return AccusationResponse(
        ending_text=ending_map[payload.ending_choice],
        score=78,
        hints_used_note=f"Hints used in this session: {session['hints_used']}",
        full_truth_reveal=(
            "Julian orchestrated the demo chaos himself, but the situation spiraled "
            "through multiple small actions and misjudgments by others."
        ),
    )


@router.post("/session/start", response_model=SessionStartResponse)
def start_session():
    session = get_or_create_session(None)

    # TODO: replace with real orchestrator call
    return {
        "session_id": session["session_id"],
        "message": "New session created",
    }

@router.get("/contradictions/{session_id}")
def get_contradictions(session_id: str):
    session = get_or_create_session(session_id)
    return {"contradictions": session["found_contradictions"]}


@router.get("/facts/{character_id}")
def get_character_facts(character_id: str):
    data = {
        "victor": [
            {"id": "fact_victor_timeline", "label": "Victor timeline", "x": 80, "y": 80},
            {"id": "fact_backstage_sighting", "label": "Backstage sighting", "x": 320, "y": 180},
            {"id": "fact_drink_access", "label": "Drink access", "x": 120, "y": 280},
        ]
    }
    return {"facts": data.get(character_id, [])}