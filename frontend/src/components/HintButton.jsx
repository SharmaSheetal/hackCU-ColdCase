import { useEffect, useState } from "react";
import { useHint } from "../context/HintContext";
import { useSession } from "../context/SessionContext";

const API_BASE = "http://127.0.0.1:8000";

export default function HintButton() {
    const { sessionId } = useSession();
    const {
        setHintData,
        cooldownRemaining,
        setCooldownRemaining,
    } = useHint();

    const [cooldownTotal, setCooldownTotal] = useState(0);

    useEffect(() => {
        if (cooldownRemaining <= 0) return;

        const interval = setInterval(() => {
            setCooldownRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [cooldownRemaining, setCooldownRemaining]);

    const handleHintClick = async () => {
        if (!sessionId) return;

        try {
            const response = await fetch(`${API_BASE}/hint`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session_id: sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch hint");
            }

            const data = await response.json();

            if (data.cooldown_remaining > 0) {
                setCooldownRemaining(data.cooldown_remaining);
                setCooldownTotal(data.cooldown_remaining);
            } else {
                setCooldownRemaining(0);
            }

            if (data.hint_text) {
                setHintData(data);
            }
        } catch {
        }
    };

    const percentage =
        cooldownRemaining > 0 && cooldownTotal > 0
            ? (cooldownRemaining / cooldownTotal) * 100
            : 0;

    const ringStyle =
        cooldownRemaining > 0
            ? {
                background: `conic-gradient(
            rgba(250, 204, 21, 0.95) 0deg,
            rgba(250, 204, 21, 0.95) ${percentage * 3.6}deg,
            rgba(255,255,255,0.12) ${percentage * 3.6}deg,
            rgba(255,255,255,0.12) 360deg
          )`,
            }
            : {
                background: "transparent",
            };

    return (
        <div className="fixed right-6 top-6 z-40">
            <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full p-[4px] shadow-xl"
                style={ringStyle}
            >
                <button
                    onClick={handleHintClick}
                    disabled={!sessionId}
                    title="Request hint"
                    className="relative flex h-14 w-14 items-center justify-center rounded-md border border-yellow-500/40 bg-[#f4d84a] shadow-lg transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <div className="absolute right-0 top-0 h-4 w-4 bg-[#eacb35] [clip-path:polygon(0_0,100%_0,100%_100%)]" />
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#5a4200]">
                        Hint
                    </div>
                </button>

                {cooldownRemaining > 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-[11px] font-bold text-yellow-100">
                            {cooldownRemaining}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}