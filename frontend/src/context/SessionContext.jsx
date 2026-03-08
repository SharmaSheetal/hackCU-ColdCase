import { createContext, useContext, useMemo, useState } from "react";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
    const [sessionId, setSessionIdState] = useState(() => {
        try {
            return window.localStorage.getItem("cold_case_session_id");
        } catch {
            return null;
        }
    });

    const [unlockedEvidence, setUnlockedEvidence] = useState([]);
    const [phase, setPhase] = useState(1);

    const setSessionId = (id) => {
        setSessionIdState(id);

        try {
            if (id) {
                window.localStorage.setItem("cold_case_session_id", id);
            } else {
                window.localStorage.removeItem("cold_case_session_id");
            }
        } catch {
        }
    };

    const value = useMemo(
        () => ({
            sessionId,
            setSessionId,
            unlockedEvidence,
            setUnlockedEvidence,
            phase,
            setPhase,
        }),
        [sessionId, unlockedEvidence, phase]
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);

    if (!context) {
        throw new Error("useSession must be used inside SessionProvider");
    }

    return context;
}