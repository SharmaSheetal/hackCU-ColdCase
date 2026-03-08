import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

import { useSession } from "../context/SessionContext";
import { useProgress } from "../context/ProgressContext";
import { typewriterClick } from "../audio/sounds";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import ContradictionAlert from "../components/ContradictionAlert";
import { CHARACTER_DATA } from "../data/characters";
import DetectiveHUD from "../components/DetectiveHUD";

// Detective portraits (adjust paths to match your asset structure)
import detectiveMaleImg from "../assets/characters/user_male.webp";
import detectiveFemaleImg from "../assets/characters/user_female.webp";

const API_BASE = "http://127.0.0.1:8000";
const HUD_W = 248; // must match DetectiveHUD width

// ── Character accent colours ──────────────────────────────────────────────────
const CHAR_META = {
    julian: { accent: "#e74c3c", trait: "VICTIM", bgTint: "231,76,60" },
    victor: { accent: "#e67e22", trait: "SUSPECT", bgTint: "230,126,34" },
    martha: { accent: "#9b59b6", trait: "SUSPECT", bgTint: "155,89,182" },
    rose: { accent: "#1abc9c", trait: "WITNESS", bgTint: "26,188,156" },
    hayes: { accent: "#3498db", trait: "ALLY", bgTint: "52,152,219" },
};

// ── Fallback facts ────────────────────────────────────────────────────────────
const FALLBACK_FACTS = {
    victor: [
        { id: "fact_victor_timeline", label: "Victor timeline", x: 80, y: 80 },
        { id: "fact_backstage_sighting", label: "Backstage sighting", x: 320, y: 180 },
        { id: "fact_drink_access", label: "Drink access", x: 120, y: 280 },
    ],
    martha: [
        { id: "fact_martha_lounge", label: "Lounge presence", x: 100, y: 90 },
        { id: "fact_inhaler_chain", label: "Inhaler chain", x: 320, y: 200 },
        { id: "fact_victor_overlap", label: "Victor overlap", x: 140, y: 300 },
    ],
    rose: [
        { id: "fact_vip_kit", label: "VIP kit", x: 120, y: 90 },
        { id: "fact_julian_contact", label: "Julian contact", x: 320, y: 200 },
        { id: "fact_event_access", label: "Event access", x: 150, y: 310 },
    ],
    hayes: [
        { id: "fact_case_summary", label: "Case summary", x: 100, y: 90 },
        { id: "fact_room_timeline", label: "Room timeline", x: 330, y: 190 },
        { id: "fact_witness_map", label: "Witness map", x: 140, y: 310 },
    ],
    julian: [
        { id: "fact_julian_demo", label: "Demo pressure", x: 100, y: 90 },
        { id: "fact_julian_drink", label: "Cold brew", x: 330, y: 180 },
        { id: "fact_julian_note", label: "Sticky note", x: 140, y: 300 },
    ],
};

function stressColor(s) {
    if (s < 0.33) return "#1abc9c";
    if (s < 0.66) return "#f5c842";
    return "#e74c3c";
}

function buildNodes(facts, accent) {
    return facts.map(f => ({
        id: f.id,
        position: { x: f.x, y: f.y },
        data: { label: f.label },
        style: {
            border: `1px solid ${accent}44`,
            borderRadius: 8,
            padding: "8px 12px",
            background: "#100d18",
            color: "#e8dcc8",
            width: 140,
            fontSize: 11,
            fontFamily: "'Courier Prime', monospace",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        },
    }));
}
function buildEdges(facts, accent) {
    return facts.slice(0, -1).map((f, i) => ({
        id: `e-${f.id}`,
        source: f.id,
        target: facts[i + 1].id,
        style: { stroke: `${accent}33`, strokeWidth: 1.5 },
    }));
}
function highlightStyle(accent) {
    return {
        border: `1px solid ${accent}99`,
        borderRadius: 8, padding: "8px 12px",
        background: "#180f1a", color: "#fff",
        width: 140, fontSize: 11,
        fontFamily: "'Courier Prime', monospace",
        boxShadow: `0 0 0 2px ${accent}33, 0 0 20px ${accent}55`,
    };
}

export default function InterviewRoom() {
    const { characterId } = useParams();
    const navigate = useNavigate();
    const { sessionId } = useSession();
    const { setProgressData } = useProgress();

    const meta = CHARACTER_DATA[characterId] || { name: characterId || "Unknown", role: "Unknown Role", image: null };
    const charMeta = CHAR_META[characterId] || { accent: "#f5c842", trait: "UNKNOWN", bgTint: "245,200,66" };
    const accent = charMeta.accent;

    // Read gender from localStorage (same key as HUD)
    const [gender, setGender] = useState(
        () => (typeof localStorage !== "undefined" ? localStorage.getItem("detective_gender") || "male" : "male")
    );
    // Sync if HUD changes it in another tab / component — poll localStorage
    useEffect(() => {
        const sync = () => {
            const stored = localStorage.getItem("detective_gender") || "male";
            setGender(stored);
        };
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    const [stressLevel, setStressLevel] = useState(0.12);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [activeFactIds, setActiveFactIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [latestContradiction, setLatestContradiction] = useState(null);
    const [activeSpeaker, setActiveSpeaker] = useState(null);
    const [charBubble, setCharBubble] = useState("");
    const [playerBubble, setPlayerBubble] = useState("");
    const [showGraph, setShowGraph] = useState(false);
    const [blinkOn, setBlinkOn] = useState(true);

    const historyRef = useRef(null);
    const typingIntervalRef = useRef(null);
    const highlightTORef = useRef(null);

    const stressPercent = useMemo(() => `${Math.max(0, Math.min(1, stressLevel)) * 100}%`, [stressLevel]);
    const detectiveImg = gender === "female" ? detectiveFemaleImg : detectiveMaleImg;

    useEffect(() => {
        const b = setInterval(() => setBlinkOn(v => !v), 500);
        return () => clearInterval(b);
    }, []);

    useEffect(() => {
        const fetchFacts = async () => {
            try {
                const r = await fetch(`${API_BASE}/facts/${characterId}`);
                if (!r.ok) throw new Error();
                const data = await r.json();
                const facts = Array.isArray(data) ? data : data.facts || [];
                const safe = facts.length ? facts : (FALLBACK_FACTS[characterId] || []);
                setNodes(buildNodes(safe, accent));
                setEdges(buildEdges(safe, accent));
            } catch {
                const fb = FALLBACK_FACTS[characterId] || [];
                setNodes(buildNodes(fb, accent));
                setEdges(buildEdges(fb, accent));
            }
        };
        fetchFacts();
        return () => {
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
            if (highlightTORef.current) clearTimeout(highlightTORef.current);
            try { typewriterClick.stop(); } catch { }
        };
    }, [characterId, accent]);

    useEffect(() => {
        if (!activeFactIds.length) return;
        setNodes(prev => prev.map(n => activeFactIds.includes(n.id) ? { ...n, style: highlightStyle(accent) } : n));
        if (highlightTORef.current) clearTimeout(highlightTORef.current);
        highlightTORef.current = setTimeout(() => {
            setNodes(prev => prev.map(n => activeFactIds.includes(n.id)
                ? { ...n, style: buildNodes([{ id: n.id, label: n.data.label, x: 0, y: 0 }], accent)[0].style }
                : n
            ));
            setActiveFactIds([]);
        }, 3000);
    }, [activeFactIds, accent]);

    useEffect(() => {
        if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }, [messages]);

    const runTypewriter = (fullText, hintInjected) => {
        if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
        try { typewriterClick.stop(); } catch { }

        const responseId = `resp-${Date.now()}`;
        let index = 0;

        setActiveSpeaker("character");
        setCharBubble("");
        setMessages(prev => [...prev, { id: responseId, sender: "character", text: "", fullText, hintInjected, typing: true }]);

        typingIntervalRef.current = setInterval(() => {
            index += 1;
            if (index % 4 === 0) { try { typewriterClick.stop(); typewriterClick.play(); } catch { } }
            const partial = fullText.slice(0, index);
            setCharBubble(partial);
            setMessages(prev => prev.map(msg => msg.id === responseId ? { ...msg, text: partial } : msg));

            if (index >= fullText.length) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
                try { typewriterClick.stop(); } catch { }
                setMessages(prev => prev.map(msg => msg.id === responseId ? { ...msg, text: fullText, typing: false } : msg));
                setCharBubble(fullText);
                setTimeout(() => setActiveSpeaker(null), 2000);
            }
        }, 38);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || !sessionId || loading) return;
        setActiveSpeaker("player");
        setPlayerBubble(trimmed);
        setMessages(prev => [...prev, { id: `player-${Date.now()}`, sender: "player", text: trimmed }]);
        setInput("");
        setLoading(true);
        setTimeout(() => setActiveSpeaker(null), 700);

        try {
            const r = await fetch(`${API_BASE}/interview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ character_id: characterId, player_message: trimmed, session_id: sessionId }),
            });
            if (!r.ok) throw new Error();
            const data = await r.json();
            setLoading(false);
            setStressLevel(data.stress_level ?? 0);
            setActiveFactIds(data.active_fact_ids || []);
            runTypewriter(data.response_text || "", !!data.hint_injected);
            if (data.contradiction_event) setLatestContradiction(data.contradiction_event);
            if (data.progress?.show) setProgressData(data.progress);
        } catch {
            setLoading(false);
            runTypewriter("The character pauses, lips tight, eyes elsewhere.", false);
        }
    };

    const handleKeyDown = e => { if (e.key === "Enter") handleSend(); };
    const isSpeaking = activeSpeaker === "character";

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Special+Elite&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
                * { cursor: crosshair !important; }

                @keyframes float-char {
                    0%,100% { transform: translateY(0); }
                    50%     { transform: translateY(-7px); }
                }
                @keyframes float-player {
                    0%,100% { transform: translateY(0) scaleX(-1); }
                    50%     { transform: translateY(-5px) scaleX(-1); }
                }
                @keyframes speak-bounce {
                    0%,100% { transform: translateY(0); }
                    40%     { transform: translateY(-4px); }
                }
                @keyframes bubble-pop {
                    0%   { opacity:0; transform:scale(0.82) translateY(10px); }
                    65%  { transform:scale(1.04) translateY(-2px); }
                    100% { opacity:1; transform:scale(1) translateY(0); }
                }
                @keyframes dot-pulse {
                    0%,100%{opacity:1;} 50%{opacity:0.2;}
                }
                @keyframes lamp-flicker {
                    0%,88%,100%{opacity:1;} 89%{opacity:0.5;} 91%{opacity:0.9;} 93%{opacity:0.35;} 95%{opacity:1;}
                }

                .interview-root {
                    min-height: 100vh;
                    background: #08060d;
                    font-family: 'Courier Prime', monospace;
                    color: #e8dcc8;
                    position: relative;
                    overflow: hidden;
                    margin-left: ${HUD_W}px;
                }

                /* Film grain */
                .interview-root::before {
                    content: '';
                    position: fixed; inset: 0; z-index: 9998; pointer-events: none; opacity: 0.04;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
                    background-size: 180px;
                }
                /* Vignette */
                .interview-root::after {
                    content: '';
                    position: fixed; inset: 0; z-index: 9997; pointer-events: none;
                    background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.78) 100%);
                }

                /* Stage bg — tinted per character */
                .scene-bg {
                    position: absolute; inset: 0; pointer-events: none;
                    background:
                        radial-gradient(ellipse 65% 55% at 28% 70%, rgba(${charMeta.bgTint},0.09) 0%, transparent 62%),
                        radial-gradient(ellipse 55% 45% at 72% 65%, rgba(245,200,66,0.04) 0%, transparent 56%),
                        linear-gradient(180deg, #0c0a14 0%, #080610 55%, #06050d 100%);
                }

                /* Perspective floor */
                .floor-grid {
                    position: absolute; bottom: 340px; left: 0; right: 0; height: 180px;
                    background-image:
                        linear-gradient(rgba(${charMeta.bgTint},0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(${charMeta.bgTint},0.04) 1px, transparent 1px);
                    background-size: 44px 34px;
                    transform: perspective(380px) rotateX(55deg);
                    transform-origin: bottom center;
                    opacity: 0.7;
                }
                .floor-line {
                    position: absolute; bottom: 340px; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(${charMeta.bgTint},0.18) 25%, rgba(${charMeta.bgTint},0.12) 75%, transparent);
                }

                /* Avatar floats */
                .char-avatar       { animation: float-char 4.2s ease-in-out infinite; filter: drop-shadow(0 24px 48px rgba(0,0,0,0.8)); }
                .char-avatar.talk  { animation: speak-bounce 0.32s ease-in-out infinite; }
                .player-avatar     { animation: float-player 3.8s ease-in-out infinite 0.4s; filter: drop-shadow(0 22px 44px rgba(0,0,0,0.8)); }

                /* Speech bubbles */
                .sbubble {
                    animation: bubble-pop 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
                    pointer-events: none;
                }

                /* Thinking dots */
                .dot { animation: dot-pulse 1.1s ease-in-out infinite; }
                .dot:nth-child(2) { animation-delay: 0.18s; }
                .dot:nth-child(3) { animation-delay: 0.36s; }

                /* Chat scrollbar */
                .chat-log::-webkit-scrollbar { width: 3px; }
                .chat-log::-webkit-scrollbar-track { background: transparent; }
                .chat-log::-webkit-scrollbar-thumb { background: rgba(245,200,66,0.2); border-radius: 2px; }

                /* Input */
                .q-input {
                    flex: 1; background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
                    padding: 11px 14px; font-family: 'Courier Prime', monospace;
                    font-size: 13px; color: #e8dcc8; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
                }
                .q-input:focus { border-color: rgba(245,200,66,0.35); box-shadow: 0 0 0 3px rgba(245,200,66,0.06); }
                .q-input::placeholder { color: rgba(196,184,154,0.3); }
                .q-input:disabled { opacity: 0.5; }

                .send-btn {
                    background: rgba(245,200,66,0.1); border: 1px solid rgba(245,200,66,0.28);
                    border-radius: 10px; padding: 11px 18px;
                    font-family: 'Special Elite', cursive; font-size: 11px;
                    letter-spacing: 0.2em; color: #f5c842; cursor: crosshair !important;
                    transition: all 0.2s; white-space: nowrap; text-transform: uppercase;
                }
                .send-btn:hover:not(:disabled) { background: rgba(245,200,66,0.2); box-shadow: 0 0 16px rgba(245,200,66,0.2); }
                .send-btn:disabled { opacity: 0.4; cursor: not-allowed !important; }

                .back-btn {
                    font-family: 'Special Elite', cursive; font-size: 10px;
                    letter-spacing: 0.18em; text-transform: uppercase;
                    color: rgba(196,184,154,0.5); background: transparent;
                    border: 1px solid rgba(196,184,154,0.15); border-radius: 3px;
                    padding: 5px 12px; cursor: crosshair !important; transition: all 0.2s;
                }
                .back-btn:hover { color: rgba(196,184,154,0.85); border-color: rgba(196,184,154,0.35); }

                .graph-toggle {
                    font-family: 'Courier Prime', monospace; font-size: 9px;
                    letter-spacing: 0.22em; text-transform: uppercase;
                    color: rgba(245,200,66,0.45); background: transparent;
                    border: 1px solid rgba(245,200,66,0.15); border-radius: 3px;
                    padding: 4px 10px; cursor: crosshair !important; transition: all 0.2s;
                }
                .graph-toggle:hover { color: rgba(245,200,66,0.8); border-color: rgba(245,200,66,0.3); }

                /* React Flow override */
                .react-flow__background { background: #0a0810 !important; }

                /* Hint / Contradiction: float top-right, clear of any left panel */
                .overlay-widgets {
                    position: fixed;
                    top: 16px;
                    right: 20px;
                    z-index: 9000;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                    pointer-events: none;
                }
                .overlay-widgets > * { pointer-events: auto; }
            `}</style>

            {/* ── Persistent HUD ── */}
            <DetectiveHUD />

            <div className="interview-root">
                <div className="scene-bg" />
                <div className="floor-grid" />
                <div className="floor-line" />

                {/* ─── TOP BAR ─────────────────────────────────────────── */}
                <div style={{
                    position: "relative", zIndex: 30,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 20px",
                    background: "linear-gradient(180deg, rgba(0,0,0,0.72), transparent)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                    {/* Left: back + case tag */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button className="back-btn" onClick={() => navigate("/board")}>← Board</button>
                        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(245,200,66,0.3)", textTransform: "uppercase" }}>
                            Case #0001
                        </span>
                    </div>

                    {/* Centre: character name + trait */}
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, fontStyle: "italic", color: accent, textShadow: `0 0 20px ${accent}55`, lineHeight: 1.1 }}>
                            {meta.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 3 }}>
                            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, border: `1px solid ${accent}44`, background: `${accent}11`, padding: "2px 7px", borderRadius: 2 }}>
                                {charMeta.trait}
                            </span>
                            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: "rgba(196,184,154,0.4)" }}>{meta.role}</span>
                        </div>
                    </div>

                    {/* Right: stress + graph toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 130 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.18em", color: "rgba(196,184,154,0.38)", marginBottom: 4 }}>
                                <span>STRESS</span>
                                <span style={{ color: stressColor(stressLevel) }}>{Math.round(stressLevel * 100)}%</span>
                            </div>
                            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: stressPercent, height: "100%", borderRadius: 3, background: stressColor(stressLevel), boxShadow: `0 0 8px ${stressColor(stressLevel)}88`, transition: "width 0.6s ease, background-color 0.5s" }} />
                            </div>
                        </div>
                        <button className="graph-toggle" onClick={() => setShowGraph(v => !v)}>
                            {showGraph ? "▾ Graph" : "▸ Graph"}
                        </button>
                    </div>
                </div>

                {/* ─── STAGE: avatars ──────────────────────────────────── */}
                <div style={{
                    position: "relative", zIndex: 20,
                    height: "calc(100vh - 340px)",
                    minHeight: 300,
                    display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                    padding: "0 60px",
                    overflow: "hidden",
                }}>

                    {/* Character (LEFT) */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                        {/* Bubble / loading */}
                        <AnimatePresence>
                            {loading && !charBubble && (
                                <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    style={{ marginBottom: 14 }}>
                                    <div style={{ background: "rgba(8,6,14,0.92)", border: `1px solid ${accent}33`, borderRadius: 14, padding: "10px 18px", backdropFilter: "blur(10px)" }}>
                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                            {[0, 1, 2].map(i => <span key={i} className="dot" style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "block" }} />)}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            {(isSpeaking || (activeSpeaker === null && charBubble)) && charBubble && (
                                <motion.div key="char-bubble" className="sbubble"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    style={{ marginBottom: 14, maxWidth: 300, position: "relative" }}>
                                    <div style={{
                                        background: "rgba(8,6,14,0.94)", backdropFilter: "blur(12px)",
                                        border: `1px solid ${accent}33`, borderRadius: "14px 14px 14px 4px",
                                        padding: "12px 16px", boxShadow: `0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)`,
                                        position: "relative", overflow: "hidden",
                                    }}>
                                        {/* Accent top strip */}
                                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                                        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12.5, lineHeight: 1.7, color: "#e8dcc8" }}>
                                            {charBubble}
                                            {activeSpeaker === "character" && <span style={{ opacity: blinkOn ? 1 : 0, color: accent }}>|</span>}
                                        </div>
                                        {/* Bubble tail */}
                                        <div style={{ position: "absolute", bottom: -9, left: 20, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "4px solid transparent", borderTop: "9px solid rgba(8,6,14,0.94)" }} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Character portrait — game-art style, same treatment as detectives */}
                        <motion.div
                            className={`char-avatar${isSpeaking ? " talk" : ""}`}
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
                            style={{ position: "relative" }}
                        >
                            {/* Coloured glow halo */}
                            <div style={{
                                position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                                width: 220, height: 200,
                                background: `radial-gradient(ellipse, ${accent}20 0%, transparent 68%)`,
                                pointerEvents: "none", zIndex: 0,
                            }} />

                            <div style={{
                                width: 200, height: 290,
                                borderRadius: "10px 10px 0 0",
                                overflow: "hidden",
                                border: `2px solid ${accent}44`,
                                boxShadow: [
                                    `0 0 0 1px rgba(0,0,0,0.5)`,
                                    `0 0 30px ${accent}22`,
                                    `inset 0 0 40px rgba(0,0,0,0.4)`,
                                ].join(", "),
                                background: "#0c0a14",
                                position: "relative", zIndex: 1,
                            }}>
                                {meta.image ? (
                                    <img src={meta.image} alt={meta.name}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                                ) : (
                                    <div style={{ width: "100%", height: "100%", background: `radial-gradient(circle at 45% 30%, ${accent}33, ${accent}06)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>
                                        {charMeta.trait === "VICTIM" ? "🎓" : charMeta.trait === "SUSPECT" ? "🕴" : charMeta.trait === "WITNESS" ? "👁" : "🔍"}
                                    </div>
                                )}
                                {/* Bottom fade to match floor */}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%", background: "linear-gradient(to top, rgba(8,6,13,0.85), transparent)", pointerEvents: "none" }} />
                                {/* Glass sheen */}
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(140deg, rgba(255,255,255,0.05) 0%, transparent 45%)", pointerEvents: "none" }} />
                            </div>

                            {/* Name tag below portrait */}
                            <div style={{
                                background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
                                border: `1px solid ${accent}33`, borderTop: "none",
                                borderRadius: "0 0 8px 8px",
                                padding: "5px 14px", textAlign: "center",
                                width: 200, boxSizing: "border-box",
                            }}>
                                <span style={{ fontFamily: "'Special Elite', cursive", fontSize: 11, letterSpacing: "0.14em", color: accent }}>{meta.name}</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Central spotlight beam */}
                    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 2, height: "100%", background: `linear-gradient(to bottom, ${accent}18, transparent 60%)`, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 340, height: "72%", background: `radial-gradient(ellipse at top, ${accent}08 0%, transparent 62%)`, pointerEvents: "none" }} />

                    {/* Player (RIGHT) — uses the game-art portrait */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                        <AnimatePresence>
                            {activeSpeaker === "player" && playerBubble && (
                                <motion.div key="player-bubble" className="sbubble"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    style={{ marginBottom: 14, maxWidth: 280 }}>
                                    <div style={{
                                        background: "rgba(8,6,14,0.94)", backdropFilter: "blur(12px)",
                                        border: "1px solid rgba(245,200,66,0.28)", borderRadius: "14px 14px 4px 14px",
                                        padding: "11px 15px", boxShadow: "0 10px 36px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                                        position: "relative", overflow: "hidden",
                                    }}>
                                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(245,200,66,0.55))" }} />
                                        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12.5, lineHeight: 1.65, color: "#f5c842" }}>
                                            {playerBubble}
                                        </div>
                                        <div style={{ position: "absolute", bottom: -9, right: 20, width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "8px solid transparent", borderTop: "9px solid rgba(8,6,14,0.94)" }} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div
                            className="player-avatar"
                            initial={{ y: 60, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.22 }}
                            style={{ position: "relative", transform: "scaleX(-1)" }}
                        >
                            {/* Amber glow halo */}
                            <div style={{
                                position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                                width: 180, height: 170,
                                background: "radial-gradient(ellipse, rgba(245,200,66,0.14) 0%, transparent 68%)",
                                pointerEvents: "none", zIndex: 0,
                            }} />

                            {/* Portrait — same card style as character */}
                            <div style={{
                                width: 170, height: 250,
                                borderRadius: "10px 10px 0 0",
                                overflow: "hidden",
                                border: "2px solid rgba(245,200,66,0.38)",
                                boxShadow: [
                                    "0 0 0 1px rgba(0,0,0,0.5)",
                                    "0 0 28px rgba(245,200,66,0.15)",
                                    "inset 0 0 40px rgba(0,0,0,0.4)",
                                ].join(", "),
                                background: "#0c0a14",
                                position: "relative", zIndex: 1,
                            }}>
                                <img
                                    src={detectiveImg}
                                    alt="Detective"
                                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
                                />
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%", background: "linear-gradient(to top, rgba(8,6,13,0.85), transparent)", pointerEvents: "none" }} />
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(140deg, rgba(255,255,255,0.05) 0%, transparent 45%)", pointerEvents: "none" }} />
                            </div>

                            {/* Name tag */}
                            <div style={{
                                background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
                                border: "1px solid rgba(245,200,66,0.28)", borderTop: "none",
                                borderRadius: "0 0 8px 8px",
                                padding: "5px 14px", textAlign: "center",
                                width: 170, boxSizing: "border-box",
                            }}>
                                <span style={{ fontFamily: "'Special Elite', cursive", fontSize: 11, letterSpacing: "0.14em", color: "rgba(245,200,66,0.88)" }}>You</span>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* ─── DIALOGUE PANEL (bottom) ─────────────────────────── */}
                <div style={{
                    position: "relative", zIndex: 25,
                    height: 340,
                    background: "linear-gradient(180deg, rgba(8,6,14,0.97), rgba(10,8,16,0.99))",
                    borderTop: `1px solid ${accent}1a`,
                    display: "flex",
                }}>
                    {/* Top accent line */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accent}44, transparent)`, pointerEvents: "none" }} />

                    {/* Chat log */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexShrink: 0 }}>
                            <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.3em", color: "rgba(245,200,66,0.3)", textTransform: "uppercase" }}>
                                // Interrogation Log
                            </span>
                            {loading && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: accent }}>Processing</span>
                                    {[0, 1, 2].map(i => <span key={i} className="dot" style={{ width: 4, height: 4, borderRadius: "50%", background: accent, display: "inline-block" }} />)}
                                </div>
                            )}
                        </div>

                        <div
                            ref={historyRef}
                            className="chat-log"
                            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, paddingRight: 4 }}
                        >
                            {messages.length === 0 && (
                                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(196,184,154,0.3)", fontStyle: "italic", paddingTop: 6 }}>
                                    Approach the suspect. Ask your first question.
                                </div>
                            )}
                            {messages.map(msg => {
                                const isPlayer = msg.sender === "player";
                                return (
                                    <div key={msg.id} style={{ display: "flex", gap: 7, alignItems: "flex-start", justifyContent: isPlayer ? "flex-end" : "flex-start" }}>
                                        {!isPlayer && (
                                            <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `1px solid ${accent}44`, overflow: "hidden", background: "#0c0a14", marginTop: 2 }}>
                                                {meta.image && <img src={meta.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                            </div>
                                        )}
                                        <div style={{
                                            maxWidth: "72%", padding: "8px 12px", fontSize: 12, lineHeight: 1.68,
                                            fontFamily: "'Courier Prime', monospace",
                                            background: isPlayer ? "rgba(245,200,66,0.07)" : "rgba(20,14,28,0.9)",
                                            border: isPlayer ? "1px solid rgba(245,200,66,0.2)" : `1px solid ${accent}22`,
                                            borderRadius: isPlayer ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                                        }}>
                                            {msg.hintInjected
                                                ? <span style={{ fontStyle: "italic", color: "rgba(245,200,66,0.82)" }}>{msg.text}</span>
                                                : <span style={{ color: isPlayer ? "#f5c842" : "#e8dcc8" }}>{msg.text}</span>
                                            }
                                            {msg.typing && <span style={{ opacity: blinkOn ? 1 : 0, color: accent }}>|</span>}
                                        </div>
                                        {isPlayer && (
                                            <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: "1px solid rgba(245,200,66,0.3)", overflow: "hidden", background: "#0c0a14", marginTop: 2 }}>
                                                <img src={detectiveImg} alt="You" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input row */}
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexShrink: 0 }}>
                            <input
                                className="q-input"
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={`Ask ${meta.name.split(" ")[0]} about the timeline, evidence, alibi...`}
                                disabled={loading}
                            />
                            <button className="send-btn" onClick={handleSend} disabled={!sessionId || loading}>
                                {loading ? "..." : "Ask ▶"}
                            </button>
                        </div>
                    </div>

                    {/* Collapsible fact graph */}
                    <AnimatePresence>
                        {showGraph && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: "easeInOut" }}
                                style={{ borderLeft: "1px solid rgba(255,255,255,0.05)", overflow: "hidden", flexShrink: 0, background: "rgba(8,6,12,0.85)" }}
                            >
                                <div style={{ padding: "10px 12px 4px", fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.3em", color: "rgba(245,200,66,0.3)", textTransform: "uppercase" }}>// Fact Graph</div>
                                <div style={{ height: "calc(100% - 28px)" }}>
                                    <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnDrag zoomOnScroll>
                                        <MiniMap style={{ background: "#0a0810" }} />
                                        <Controls />
                                        <Background gap={16} size={0.5} color={`${accent}18`} />
                                    </ReactFlow>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ─── Overlay widgets: hint + contradiction, top-right, clear of HUD ─── */}
            <div className="overlay-widgets">
                <HintButton />
                <HintCard />
                <ContradictionAlert contradictionEvent={latestContradiction} onDismiss={() => setLatestContradiction(null)} />
            </div>
        </>
    );
}