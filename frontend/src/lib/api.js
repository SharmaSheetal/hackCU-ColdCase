const API_BASE = "http://127.0.0.1:8000";

export async function startSession() {
    const response = await fetch(`${API_BASE}/session/start`, {
        method: "POST",
    });

    if (!response.ok) {
        throw new Error("Failed to create session");
    }

    return response.json();
}