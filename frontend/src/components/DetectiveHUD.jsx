/**
 * DetectiveHUD.jsx
 * ─────────────────────────────────────────────────────────
 * Persistent left-sidebar HUD shown on every page.
 * Displays detective identity, live progress, rotating
 * thoughts, case stats, suspicion bars, notepad, and
 * the gender selector.
 *
 * Usage:
 *   import DetectiveHUD from "../components/DetectiveHUD";
 *   <DetectiveHUD />
 *
 * The component reads from SessionContext and ProgressContext
 * and polls the backend on its own — no props needed.
 * The main page content should have:  marginLeft: 248px
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "../context/SessionContext";
import { useProgress } from "../context/ProgressContext";

const API_BASE = "http://127.0.0.1:8000";

// Import detective avatars — adjust paths to match your project
import detectiveMaleImg from "../assets/characters/user_male.webp";
import detectiveFemaleImg from "../assets/characters/user_female.webp";

const THOUGHTS = [
    "Someone is lying.",
    "Check the timeline again.",
    "The inhaler — why?",
    "Victor was nervous.",
    "Follow the cold brew.",
    "Rose knows more.",
    "Hayes is hiding something.",
    "Motive: trophy envy?",
    "Cross-reference alibis.",
    "The sticky note. Premeditated?",
    "Martha had access.",
    "Push harder.",
    "Who gains from Julian's collapse?",
    "Trace the VIP kit.",
    "Every alibi has a crack.",
    "The truth is in the details.",
];

const SUSPICION_BASE = {
    victor: { name: "Victor", accent: "#e67e22", suspicion: 72 },
    martha: { name: "Martha", accent: "#9b59b6", suspicion: 58 },
    rose: { name: "Rose", accent: "#1abc9c", suspicion: 34 },
    hayes: { name: "Hayes", accent: "#3498db", suspicion: 12 },
};

function statusColor(score) {
    if (score >= 35) return "#e74c3c";
    if (score >= 20) return "#e67e22";
    return "#f5c842";
}

function progressLabel(score) {
    if (score < 10) return "Cold Trail";
    if (score < 20) return "Something's Off";
    if (score < 35) return "Threads Connecting";
    if (score < 50) return "Truth Closing In";
    return "Breakthrough";
}

export default function DetectiveHUD() {
    const { sessionId } = useSession();
    const { progressData } = useProgress();

    // Gender — persisted in localStorage
    const [gender, setGender] = useState(
        () => (typeof localStorage !== "undefined" ? localStorage.getItem("detective_gender") || "male" : "male")
    );
    const toggleGender = () => {
        const next = gender === "male" ? "female" : "male";
        setGender(next);
        if (typeof localStorage !== "undefined") localStorage.setItem("detective_gender", next);
    };

    // Live game state
    const [gameState, setGameState] = useState({ phase: 1, progress_score: 0 });
    const [contradictionCount, setContradictionCount] = useState(0);
    const [suspicions, setSuspicions] = useState(SUSPICION_BASE);
    const seenRef = useRef(new Set());

    // Rotating thought
    const [thoughtIdx, setThoughtIdx] = useState(0);
    const [blinkOn, setBlinkOn] = useState(true);

    // Notepad
    const [noteOpen, setNoteOpen] = useState(false);
    const [notes, setNotes] = useState("");

    useEffect(() => {
        const t = setInterval(() => setThoughtIdx(i => (i + 1) % THOUGHTS.length), 3800);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const b = setInterval(() => setBlinkOn(v => !v), 530);
        return () => clearInterval(b);
    }, []);

    // Poll game state
    useEffect(() => {
        if (!sessionId) return;
        const poll = async () => {
            try {
                const r = await fetch(`${API_BASE}/game-state/${sessionId}`);
                if (r.ok) {
                    const d = await r.json();
                    setGameState(prev => ({ ...prev, ...d }));
                }
            } catch { }
        };
        poll();
        const iv = setInterval(poll, 5000);
        return () => clearInterval(iv);
    }, [sessionId]);

    // Poll contradictions
    useEffect(() => {
        if (!sessionId) return;
        const poll = async () => {
            try {
                const r = await fetch(`${API_BASE}/contradictions/${sessionId}`);
                if (!r.ok) return;
                const data = await r.json();
                const list = Array.isArray(data) ? data : data.contradictions || [];
                for (const item of list) {
                    if (!seenRef.current.has(item.contradiction_id)) {
                        seenRef.current.add(item.contradiction_id);
                        setContradictionCount(c => c + 1);
                    }
                }
            } catch { }
        };
        poll();
        const iv = setInterval(poll, 4000);
        return () => clearInterval(iv);
    }, [sessionId]);

    const score = progressData?.score ?? gameState.progress_score ?? 0;
    const label = progressLabel(score);
    const sColor = statusColor(score);
    const avatarSrc = gender === "female" ? detectiveFemaleImg : detectiveMaleImg;

    return (
        <>
            <style>{`
                @keyframes hud-pulse {
                    0%,100% { box-shadow: 0 0 6px rgba(192,57,43,0.8); transform: scale(1); }
                    50%     { box-shadow: 0 0 14px rgba(192,57,43,1);   transform: scale(1.3); }
                }
                @keyframes ring-pulse {
                    0%,100% { transform: scale(1);   opacity: 0.5; }
                    50%     { transform: scale(1.65); opacity: 0;   }
                }
                @keyframes ring-pulse2 {
                    0%,100% { transform: scale(1);   opacity: 0.3; }
                    50%     { transform: scale(1.4);  opacity: 0;   }
                }
                @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }

                .hud-root {
                    position: fixed;
                    left: 0; top: 0; bottom: 0;
                    width: 248px;
                    z-index: 800;
                    display: flex;
                    flex-direction: column;
                    background: linear-gradient(180deg, #07050a 0%, #080610 100%);
                    border-right: 1px solid rgba(245,200,66,0.09);
                    box-shadow: 4px 0 50px rgba(0,0,0,0.9);
                    font-family: 'Courier Prime', monospace;
                    overflow: hidden;
                }

                /* Scanlines on HUD */
                .hud-root::after {
                    content: '';
                    position: absolute; inset: 0; pointer-events: none; z-index: 0;
                    background: repeating-linear-gradient(
                        to bottom, transparent 0px, transparent 3px,
                        rgba(0,0,0,0.09) 3px, rgba(0,0,0,0.09) 4px
                    );
                }

                .hud-section {
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(245,200,66,0.07);
                    position: relative; z-index: 1; flex-shrink: 0;
                }

                .hud-label {
                    font-size: 8px;
                    letter-spacing: 0.35em;
                    text-transform: uppercase;
                    color: rgba(245,200,66,0.35);
                    margin-bottom: 8px;
                    font-family: 'Courier Prime', monospace;
                }

                .suspicion-bar-track {
                    height: 3px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 3px;
                }

                .gender-btn {
                    flex: 1;
                    padding: 7px 6px;
                    border-radius: 4px;
                    font-family: 'Special Elite', cursive;
                    font-size: 10px;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    cursor: crosshair !important;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .notepad-textarea {
                    width: 100%;
                    background: rgba(245,230,180,0.04);
                    border: 1px solid rgba(245,200,66,0.12);
                    border-radius: 4px;
                    padding: 8px 10px;
                    font-family: 'Courier Prime', monospace;
                    font-size: 10.5px;
                    line-height: 1.7;
                    color: rgba(220,200,160,0.8);
                    resize: none;
                    outline: none;
                    cursor: text !important;
                    box-sizing: border-box;
                    margin-top: 8px;
                }
                .notepad-textarea::placeholder { color: rgba(196,184,154,0.25); }

                .toggle-btn {
                    width: 100%;
                    background: rgba(245,200,66,0.06);
                    border: 1px solid rgba(245,200,66,0.15);
                    border-radius: 4px;
                    font-family: 'Special Elite', cursive;
                    font-size: 10px;
                    letter-spacing: 0.18em;
                    color: rgba(245,200,66,0.6);
                    padding: 7px 0;
                    cursor: crosshair !important;
                    transition: all 0.2s;
                    text-transform: uppercase;
                }
                .toggle-btn:hover { background: rgba(245,200,66,0.12); color: rgba(245,200,66,0.9); }
            `}</style>

            <div className="hud-root">

                {/* ── IDENTITY BLOCK ────────────────────────────────── */}
                <div className="hud-section" style={{ paddingTop: 20, background: "linear-gradient(180deg, rgba(245,200,66,0.05), transparent)" }}>
                    <div className="hud-label">◈ Hackathon P.D. — Det. File</div>

                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                        {/* Detective avatar — game-art style portrait */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <div style={{
                                width: 68, height: 80,
                                borderRadius: "6px 6px 0 0",
                                overflow: "hidden",
                                border: "2px solid rgba(245,200,66,0.5)",
                                boxShadow: "0 0 0 3px rgba(245,200,66,0.07), 0 0 24px rgba(245,200,66,0.15)",
                                background: "#0a0810",
                                position: "relative",
                            }}>
                                <img
                                    src={avatarSrc}
                                    alt="Detective"
                                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
                                />
                                {/* Bottom gradient to blend into HUD */}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(to top, rgba(7,5,10,0.9), transparent)", pointerEvents: "none" }} />
                            </div>
                            {/* Pulse rings */}
                            <div style={{ position: "absolute", inset: -5, borderRadius: 8, border: "1.5px solid rgba(245,200,66,0.28)", animation: "ring-pulse 2.4s ease-in-out infinite", pointerEvents: "none" }} />
                            <div style={{ position: "absolute", inset: -2, borderRadius: 7, border: "1px solid rgba(245,200,66,0.15)", animation: "ring-pulse2 2.4s ease-in-out infinite 0.5s", pointerEvents: "none" }} />
                        </div>

                        <div style={{ flex: 1, paddingBottom: 2 }}>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, fontStyle: "italic", color: "#f5c842", lineHeight: 1.1, textShadow: "0 0 16px rgba(245,200,66,0.4)" }}>
                                You
                            </div>
                            <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 10, color: "rgba(196,184,154,0.55)", marginTop: 3, letterSpacing: "0.06em" }}>
                                Lead Detective
                            </div>
                            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "rgba(196,184,154,0.35)", marginTop: 1 }}>
                                Case #0001
                            </div>
                            {/* Live indicator */}
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c0392b", animation: "hud-pulse 1.8s ease-in-out infinite" }} />
                                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, color: "#c0392b", letterSpacing: "0.18em", textTransform: "uppercase" }}>Live — On Case</span>
                            </div>
                        </div>
                    </div>

                    {/* Gender selector */}
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        {["male", "female"].map(g => (
                            <button
                                key={g}
                                className="gender-btn"
                                onClick={toggleGender}
                                style={{
                                    background: gender === g ? "rgba(245,200,66,0.15)" : "rgba(255,255,255,0.03)",
                                    border: gender === g ? "1px solid rgba(245,200,66,0.4)" : "1px solid rgba(255,255,255,0.08)",
                                    color: gender === g ? "#f5c842" : "rgba(196,184,154,0.4)",
                                    boxShadow: gender === g ? "0 0 12px rgba(245,200,66,0.12)" : "none",
                                }}
                            >
                                {g === "male" ? "♂ Male" : "♀ Female"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── PROGRESS ──────────────────────────────────────── */}
                <div className="hud-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontFamily: "'Special Elite', cursive", fontSize: 10, letterSpacing: "0.18em", color: sColor, textTransform: "uppercase" }}>{label}</span>
                        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: sColor }}>{score}pts</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <motion.div
                            animate={{ width: `${Math.min(score * 2, 100)}%` }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                            style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${sColor}88, ${sColor})`, boxShadow: `0 0 10px ${sColor}66` }}
                        />
                    </div>
                </div>

                {/* ── DETECTIVE THOUGHT ─────────────────────────────── */}
                <div className="hud-section">
                    <div className="hud-label">// Detective's Thoughts</div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={thoughtIdx}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.35 }}
                            style={{
                                fontFamily: "'Special Elite', cursive",
                                fontSize: 12, lineHeight: 1.55,
                                color: "rgba(220,200,160,0.88)",
                                fontStyle: "italic",
                                borderLeft: "2px solid rgba(245,200,66,0.25)",
                                paddingLeft: 10, minHeight: 38,
                            }}
                        >
                            "{THOUGHTS[thoughtIdx]}"
                            <span style={{ opacity: blinkOn ? 1 : 0, color: "#f5c842", marginLeft: 1 }}>_</span>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── CASE STATS ────────────────────────────────────── */}
                <div className="hud-section">
                    <div className="hud-label">// Case Stats</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                            { label: "Suspects", val: "4", color: "#e67e22" },
                            { label: "Contradictions", val: `${contradictionCount}`, color: "#e74c3c" },
                            { label: "Time of Death", val: "02:07 AM", color: "#9b59b6" },
                            { label: "Case Phase", val: `${gameState.phase || 1}`, color: "#3498db" },
                        ].map(r => (
                            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9.5, color: "rgba(196,184,154,0.48)" }}>{r.label}</span>
                                <span style={{ fontFamily: "'Special Elite', cursive", fontSize: 10, color: r.color, letterSpacing: "0.05em" }}>{r.val}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── SUSPICION INDEX ───────────────────────────────── */}
                <div className="hud-section" style={{ flex: 1, overflow: "hidden" }}>
                    <div className="hud-label">// Suspicion Index</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(suspicions)
                            .sort(([, a], [, b]) => b.suspicion - a.suspicion)
                            .map(([id, c]) => (
                                <div key={id}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9.5, color: "rgba(196,184,154,0.62)" }}>{c.name}</span>
                                        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: c.accent }}>{c.suspicion}%</span>
                                    </div>
                                    <div className="suspicion-bar-track">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${c.suspicion}%` }}
                                            transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
                                            style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${c.accent}55, ${c.accent})` }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* ── DETECTIVE NOTEPAD ─────────────────────────────── */}
                <div className="hud-section" style={{ paddingBottom: 16 }}>
                    <button className="toggle-btn" onClick={() => setNoteOpen(v => !v)}>
                        {noteOpen ? "▾ Close Notes" : "▸ Detective Notes"}
                    </button>
                    <AnimatePresence>
                        {noteOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 88, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                style={{ overflow: "hidden" }}
                            >
                                <textarea
                                    className="notepad-textarea"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Jot your theories..."
                                    style={{ height: 80 }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </>
    );
}