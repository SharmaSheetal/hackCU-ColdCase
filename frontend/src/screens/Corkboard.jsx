import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import ContradictionAlert from "../components/ContradictionAlert";
import ProgressMeter from "../components/ProgressMeter";
import { useProgress } from "../context/ProgressContext";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import { CHARACTER_DATA } from "../data/characters";
import DetectiveHUD from "../components/DetectiveHUD";

const API_BASE = "http://127.0.0.1:8000";
const HUD_W = 248;
const CARD_W = 148;
const CARD_H = 210;

const CHARS = {
    julian: { x: 420, y: 28, name: "Julian Byte", role: "Star Judge", accent: "#e74c3c", shadow: "#ff000055", trait: "VICTIM", suspicion: 0 },
    victor: { x: 110, y: 190, name: "Victor Vale", role: "Founder", accent: "#e67e22", shadow: "#ff880055", trait: "SUSPECT", suspicion: 72 },
    martha: { x: 720, y: 190, name: "Martha Keen", role: "Ops Lead", accent: "#9b59b6", shadow: "#aa00ff55", trait: "SUSPECT", suspicion: 58 },
    rose: { x: 215, y: 430, name: "Rose Voss", role: "VIP Coordinator", accent: "#1abc9c", shadow: "#00ffaa44", trait: "WITNESS", suspicion: 34 },
    hayes: { x: 615, y: 430, name: "Det. Hayes", role: "Investigator", accent: "#3498db", shadow: "#0088ff44", trait: "ALLY", suspicion: 12 },
};

const RELATIONSHIPS = [
    { id: "victor-julian", from: "victor", to: "julian", label: "gave drink" },
    { id: "martha-julian", from: "martha", to: "julian", label: "inhaler" },
    { id: "rose-julian", from: "rose", to: "julian", label: "VIP kit" },
    { id: "victor-martha", from: "victor", to: "martha", label: "lounge access" },
    { id: "hayes-julian", from: "hayes", to: "julian", label: "investigates" },
    { id: "hayes-victor", from: "hayes", to: "victor", label: "investigates" },
    { id: "hayes-martha", from: "hayes", to: "martha", label: "investigates" },
    { id: "hayes-rose", from: "hayes", to: "rose", label: "investigates" },
];

const TRAIT_COLORS = { VICTIM: "#e74c3c", SUSPECT: "#e67e22", WITNESS: "#f5c842", ALLY: "#3498db" };

function cardCenter(key) {
    const c = CHARS[key];
    return { x: c.x + CARD_W / 2, y: c.y + CARD_H / 2 };
}
function curveOffset(from, to, i) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perp = { x: -dy / len, y: dx / len };
    const mag = (i % 3 - 1) * 26;
    return { mx: (from.x + to.x) / 2 + perp.x * mag, my: (from.y + to.y) / 2 + perp.y * mag };
}

// ── 3D Tilt Card ──────────────────────────────────────────────────────────────
function Card3D({ id, onOpenInterview, isContradicted }) {
    const ref = useRef(null);
    const char = CHARS[id];
    const characterData = CHARACTER_DATA?.[id];
    const [hovered, setHovered] = useState(false);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [shine, setShine] = useState({ x: 50, y: 50 });

    const handleMouseMove = (e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = (e.clientX - rect.left) / rect.width;
        const cy = (e.clientY - rect.top) / rect.height;
        setTilt({ x: (cy - 0.5) * 28, y: (cx - 0.5) * -28 });
        setShine({ x: cx * 100, y: cy * 100 });
    };
    const handleMouseLeave = () => {
        setHovered(false);
        setTilt({ x: 0, y: 0 });
        setShine({ x: 50, y: 50 });
    };

    const baseRot = (id.charCodeAt(0) % 7) - 3;

    return (
        <div style={{ position: "absolute", left: char.x, top: char.y, width: CARD_W, height: CARD_H, perspective: "700px", zIndex: hovered ? 20 : 3 }}>
            <motion.button
                ref={ref}
                onClick={() => onOpenInterview(id)}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={handleMouseLeave}
                animate={{
                    rotateX: hovered ? tilt.x : 0,
                    rotateY: hovered ? tilt.y : 0,
                    rotateZ: hovered ? 0 : baseRot,
                    scale: hovered ? 1.12 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", cursor: "crosshair", background: "transparent", border: "none", padding: 0, outline: "none", position: "relative" }}
            >
                <div style={{
                    position: "absolute", inset: 0, borderRadius: 6,
                    background: "linear-gradient(160deg,#fef9ee 0%,#f0dfc0 55%,#e4cfaa 100%)",
                    border: isContradicted ? "1.5px solid rgba(255,50,50,0.8)" : `1.5px solid rgba(255,255,255,0.15)`,
                    boxShadow: isContradicted
                        ? `0 0 0 2px #ff3333, 0 20px 50px rgba(255,0,0,0.3), 0 0 80px rgba(255,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)`
                        : hovered
                            ? `0 30px 60px rgba(0,0,0,0.7), 0 0 0 1px ${char.accent}55, 0 0 30px ${char.shadow}, inset 0 1px 0 rgba(255,255,255,0.6)`
                            : `0 8px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.45)`,
                    overflow: "hidden",
                    transition: "box-shadow 0.25s, border-color 0.25s",
                }}>
                    {/* Paper lines */}
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(transparent,transparent 20px,rgba(100,60,20,0.07) 20px,rgba(100,60,20,0.07) 21px)" }} />
                    <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1, background: "rgba(192,57,43,0.18)", pointerEvents: "none" }} />
                    {/* Shine */}
                    <div style={{ position: "absolute", inset: 0, borderRadius: 6, pointerEvents: "none", background: `radial-gradient(circle at ${shine.x}% ${shine.y}%,rgba(255,255,255,0.28) 0%,rgba(255,255,255,0.05) 40%,transparent 65%)`, opacity: hovered ? 1 : 0, transition: "opacity 0.2s", zIndex: 10 }} />
                    {/* Accent strip */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${char.accent},${char.accent}88)`, zIndex: 2 }} />
                    {/* Pushpin */}
                    <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", zIndex: 20, filter: `drop-shadow(0 3px 5px rgba(0,0,0,0.7)) drop-shadow(0 0 8px ${char.accent}88)` }}>
                        <svg width="22" height="28" viewBox="0 0 22 28">
                            <defs><radialGradient id={`pin-${id}`} cx="38%" cy="32%"><stop offset="0%" stopColor="rgba(255,255,255,0.7)" /><stop offset="100%" stopColor={char.accent} /></radialGradient></defs>
                            <circle cx="11" cy="10" r="9" fill={`url(#pin-${id})`} />
                            <circle cx="8" cy="7" r="3" fill="rgba(255,255,255,0.35)" />
                            <rect x="9.5" y="18" width="3" height="10" rx="1.5" fill="#777" />
                            <ellipse cx="11" cy="10" rx="9" ry="9" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
                        </svg>
                    </div>
                    {/* Content */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 10px 12px", gap: 8, height: "100%", position: "relative", zIndex: 3 }}>
                        {/* Avatar orb */}
                        <div style={{ position: "relative", width: 76, height: 76 }}>
                            <motion.div
                                animate={isContradicted ? { scale: [1, 1.5, 1], opacity: [0.9, 0, 0.9] } : hovered ? { scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] } : { scale: 1, opacity: 0 }}
                                transition={{ duration: isContradicted ? 0.9 : 2, repeat: Infinity }}
                                style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${isContradicted ? "#ff3333" : char.accent}`, pointerEvents: "none" }}
                            />
                            <motion.div
                                animate={hovered ? { scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] } : {}}
                                transition={{ duration: 2.2, repeat: Infinity, delay: 0.3 }}
                                style={{ position: "absolute", inset: -14, borderRadius: "50%", border: `1px solid ${char.accent}44`, pointerEvents: "none" }}
                            />
                            <div style={{ width: 76, height: 76, borderRadius: "50%", overflow: "hidden", border: `2.5px solid ${char.accent}`, boxShadow: `0 0 0 3px rgba(0,0,0,0.5),0 0 20px ${char.shadow},inset 0 -8px 20px rgba(0,0,0,0.6),inset 0 4px 10px rgba(255,255,255,0.15)`, background: "#111", position: "relative" }}>
                                {characterData?.image
                                    ? <img src={characterData.image} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                    : <div style={{ width: "100%", height: "100%", background: `radial-gradient(circle at 40% 35%,${char.accent}cc,${char.accent}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🕵️</div>
                                }
                                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none", background: "linear-gradient(135deg,rgba(255,255,255,0.25) 0%,transparent 45%,rgba(0,0,0,0.3) 100%)" }} />
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(to top,rgba(0,0,0,0.5),transparent)", borderRadius: "0 0 50% 50%", pointerEvents: "none" }} />
                            </div>
                            <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 60, height: 10, background: "radial-gradient(ellipse,rgba(0,0,0,0.4) 0%,transparent 70%)", pointerEvents: "none" }} />
                        </div>
                        {/* Trait */}
                        <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 8, letterSpacing: "0.2em", color: TRAIT_COLORS[char.trait] || "#f5c842", border: `1px solid ${TRAIT_COLORS[char.trait] || "#f5c842"}55`, padding: "2px 8px", borderRadius: 2, background: `${TRAIT_COLORS[char.trait] || "#f5c842"}11`, textTransform: "uppercase" }}>
                            {char.trait}
                        </div>
                        {/* Name */}
                        <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                            <div style={{ fontFamily: "'Special Elite',cursive", fontSize: 11, fontWeight: 700, color: "#1a0e04", letterSpacing: "0.06em", textTransform: "uppercase" }}>{char.name}</div>
                            <div style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9.5, color: "#7a5c3a", marginTop: 2 }}>{char.role}</div>
                        </div>
                        {/* Suspicion bar */}
                        {char.suspicion > 0 && (
                            <div style={{ width: "100%", paddingTop: 2 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Courier Prime',monospace", fontSize: 7.5, color: "rgba(120,80,30,0.6)", letterSpacing: "0.1em", marginBottom: 3 }}>
                                    <span>SUSPICION</span><span style={{ color: char.accent }}>{char.suspicion}%</span>
                                </div>
                                <div style={{ height: 3, background: "rgba(0,0,0,0.15)", borderRadius: 2, overflow: "hidden" }}>
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${char.suspicion}%` }} transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                                        style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg,${char.accent}88,${char.accent})`, boxShadow: `0 0 6px ${char.accent}88` }} />
                                </div>
                            </div>
                        )}
                        {/* Hover CTA */}
                        <motion.div animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 4 }} transition={{ duration: 0.15 }}
                            style={{ fontFamily: "'Courier Prime',monospace", fontSize: 8.5, letterSpacing: "0.18em", color: char.accent, textTransform: "uppercase", borderTop: `1px solid ${char.accent}33`, paddingTop: 5, width: "100%", textAlign: "center", marginTop: "auto" }}>
                            ▶ Interrogate
                        </motion.div>
                        {isContradicted && <div style={{ position: "absolute", top: 10, right: 10, width: 9, height: 9, borderRadius: "50%", background: "#ff3333", boxShadow: "0 0 8px rgba(255,50,50,0.9)", animation: "c-pulse 0.9s ease-in-out infinite" }} />}
                        <div style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, background: "linear-gradient(225deg,#c8b07a 50%,transparent 50%)", borderRadius: "0 0 6px 0", pointerEvents: "none" }} />
                    </div>
                </div>
            </motion.button>
        </div>
    );
}

// ── Scrolling police tape ─────────────────────────────────────────────────────
function TapeBanner() {
    const [off, setOff] = useState(0);
    useEffect(() => {
        let raf, o = 0;
        const tick = () => { o = (o + 0.5) % 300; setOff(o); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);
    return (
        <div style={{ overflow: "hidden", height: 24, background: "#f5e642" }}>
            <div style={{ whiteSpace: "nowrap", height: "100%", display: "flex", alignItems: "center", fontFamily: "'Special Elite',cursive", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "#0a0a0a", boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.18)" }}>
                <span style={{ display: "inline-block", transform: `translateX(-${off}px)`, whiteSpace: "nowrap" }}>
                    {"POLICE LINE • DO NOT CROSS • ACTIVE INVESTIGATION • ".repeat(18)}
                </span>
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Corkboard() {
    const navigate = useNavigate();
    const { sessionId } = useSession();
    const { setProgressData } = useProgress();

    const [activeContradictionIds, setActiveContradictionIds] = useState([]);
    const [latestContradiction, setLatestContradiction] = useState(null);
    const [contradictionCount, setContradictionCount] = useState(0);
    const [gameState, setGameState] = useState({ phase: 1, progress_score: 0 });

    const seenRef = useRef(new Set());
    const alertTO = useRef(null);

    const contradictedChars = useMemo(() => {
        const s = new Set();
        activeContradictionIds.forEach(id => { const [a, b] = id.split("-"); s.add(a); s.add(b); });
        return s;
    }, [activeContradictionIds]);

    const relsWithCoords = useMemo(() => RELATIONSHIPS.map((item, i) => {
        const from = cardCenter(item.from), to = cardCenter(item.to);
        const { mx, my } = curveOffset(from, to, i);
        return { ...item, x1: from.x, y1: from.y, x2: to.x, y2: to.y, mx, my };
    }), []);

    const progressLabel = useMemo(() => {
        const s = gameState.progress_score ?? 0;
        if (s < 10) return "Cold Trail";
        if (s < 20) return "Something's Off";
        if (s < 35) return "Threads Connecting";
        if (s < 50) return "Truth Closing In";
        return "Breakthrough";
    }, [gameState.progress_score]);

    useEffect(() => {
        if (!sessionId) return;
        fetch(`${API_BASE}/game-state/${sessionId}`).then(r => r.ok ? r.json() : null).then(d => d && setGameState(p => ({ ...p, ...d }))).catch(() => { });
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) return;
        const poll = async () => {
            try {
                const r = await fetch(`${API_BASE}/contradictions/${sessionId}`);
                if (!r.ok) return;
                const data = await r.json();
                const list = Array.isArray(data) ? data : data.contradictions || [];
                let newest = null; const nextActive = [];
                for (const item of list) {
                    if (!seenRef.current.has(item.contradiction_id)) { seenRef.current.add(item.contradiction_id); newest = item; setContradictionCount(c => c + 1); }
                    if (Array.isArray(item.characters) && item.characters.length >= 2) { const [a, b] = item.characters; nextActive.push(`${a}-${b}`, `${b}-${a}`); }
                }
                if (newest) {
                    setLatestContradiction(newest); setActiveContradictionIds(nextActive);
                    if (alertTO.current) clearTimeout(alertTO.current);
                    alertTO.current = setTimeout(() => setActiveContradictionIds([]), 3500);
                }
            } catch { }
        };
        poll(); const iv = setInterval(poll, 3000);
        return () => { clearInterval(iv); if (alertTO.current) clearTimeout(alertTO.current); };
    }, [sessionId]);

    const openInterview = id => navigate(`/interview/${id}`);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Special+Elite&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
                * { cursor: crosshair !important; }
                @keyframes c-pulse{0%,100%{box-shadow:0 0 6px rgba(255,50,50,0.8);transform:scale(1);}50%{box-shadow:0 0 16px rgba(255,50,50,1);transform:scale(1.35);}}
                @keyframes shimmer{0%,100%{opacity:0.6;}50%{opacity:0.9;}}
                @keyframes lamp-flicker{0%,90%,100%{opacity:1;}91%{opacity:0.5;}93%{opacity:0.9;}95%{opacity:0.4;}97%{opacity:1;}}
                .cork{background-color:#7a5230;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0.5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.5'/%3E%3C/svg%3E"),repeating-linear-gradient(18deg,rgba(255,255,255,0.014) 0,rgba(255,255,255,0.014) 1px,transparent 1px,transparent 8px),repeating-linear-gradient(108deg,rgba(0,0,0,0.03) 0,rgba(0,0,0,0.03) 1px,transparent 1px,transparent 10px);background-size:80px 80px,10px 10px,14px 14px;position:relative;}
                .cork::before{content:'';position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 80px rgba(0,0,0,0.5),inset 0 0 20px rgba(0,0,0,0.35);}
                .cork::after{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:900px;height:360px;pointer-events:none;background:radial-gradient(ellipse,rgba(255,215,100,0.1) 0%,transparent 68%);animation:lamp-flicker 9s ease-in-out infinite;}
                .wood{background:linear-gradient(180deg,#3a1c08 0%,#251204 45%,#3a1c08 100%);border-radius:10px;padding:16px;box-shadow:0 0 0 1px rgba(245,200,66,0.1),0 30px 90px rgba(0,0,0,0.9),inset 0 3px 0 rgba(255,200,100,0.06),inset 0 -3px 0 rgba(0,0,0,0.5);position:relative;}
                .wood::before{content:'';position:absolute;inset:0;border-radius:10px;pointer-events:none;background:repeating-linear-gradient(91deg,transparent 0,transparent 7px,rgba(255,255,255,0.012) 7px,rgba(255,255,255,0.012) 8px);}
                .bolt{position:absolute;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#bbb,#444);box-shadow:0 1px 4px rgba(0,0,0,0.7);z-index:5;}
                .debug-btn{font-family:'Courier Prime',monospace;font-size:9px;letter-spacing:0.12em;color:rgba(220,200,160,0.38);background:transparent;border:1px solid rgba(220,200,160,0.1);padding:5px 10px;cursor:crosshair!important;transition:all 0.2s;}
                .debug-btn:hover{color:rgba(220,200,160,0.7);border-color:rgba(220,200,160,0.3);}
                .accuse-btn{font-family:'Special Elite',cursive;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#ff9999;background:rgba(192,57,43,0.18);border:1px solid rgba(192,57,43,0.55);padding:10px 24px;cursor:crosshair!important;transition:all 0.2s;clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px));}
                .accuse-btn:hover{background:rgba(192,57,43,0.38);color:#ffbbbb;box-shadow:0 0 22px rgba(192,57,43,0.35);}
                /* Overlay widgets top-right */
                .overlay-widgets{position:fixed;top:16px;right:20px;z-index:9000;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;}
                .overlay-widgets>*{pointer-events:auto;}
            `}</style>

            {/* Film grain */}
            <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none", opacity: 0.045, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "180px" }} />
            {/* Vignette */}
            <div style={{ position: "fixed", inset: 0, zIndex: 9997, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 50%,transparent 42%,rgba(0,0,0,0.75) 100%)" }} />

            {/* Shared HUD */}
            <DetectiveHUD />

            {/* Main content offset by HUD */}
            <div style={{
                marginLeft: HUD_W, minHeight: "100vh",
                background: "radial-gradient(ellipse at 55% 12%,rgba(90,45,10,0.4) 0%,#060402 65%)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "20px 16px", overflowX: "auto",
            }}>
                {/* Lamp */}
                <div style={{ width: 3, height: 60, background: "linear-gradient(to bottom,rgba(245,200,66,0.22),rgba(245,200,66,0.05))", zIndex: 2, position: "relative", marginBottom: -2 }} />
                <div style={{ width: 180, height: 22, background: "linear-gradient(180deg,#2c1c06,#1a0e04)", borderRadius: "0 0 60% 60%", border: "1px solid rgba(245,200,66,0.2)", zIndex: 2, position: "relative", boxShadow: "0 6px 40px rgba(245,200,66,0.18)", marginBottom: 2 }} />

                <div className="wood" style={{ width: "100%", maxWidth: 1020 }}>
                    {[{ top: 7, left: 7 }, { top: 7, right: 7 }, { bottom: 7, left: 7 }, { bottom: 7, right: 7 }].map((s, i) => (
                        <div key={i} className="bolt" style={s} />
                    ))}

                    {/* Header */}
                    <div style={{ background: "linear-gradient(90deg,rgba(0,0,0,0.65),rgba(0,0,0,0.3) 50%,rgba(0,0,0,0.65))", borderBottom: "1px solid rgba(245,200,66,0.12)", padding: "10px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "3px 3px 0 0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 900, fontStyle: "italic", color: "#f5c842", textShadow: "0 0 24px rgba(245,200,66,0.35)" }}>Case #0001 — Investigation Board</div>
                            <span style={{ fontFamily: "'Special Elite',cursive", fontSize: 9, letterSpacing: "0.35em", color: "rgba(245,200,66,0.5)", border: "1px solid rgba(245,200,66,0.2)", padding: "3px 10px", borderRadius: 2, textTransform: "uppercase" }}>Active</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Special Elite',cursive", fontSize: 11, letterSpacing: "0.2em", color: "#f5c842", textTransform: "uppercase" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c0392b", boxShadow: "0 0 6px rgba(192,57,43,0.9)", animation: "c-pulse 2s ease-in-out infinite" }} />
                            {progressLabel}
                        </div>
                    </div>

                    <TapeBanner />

                    {/* Cork */}
                    <div className="cork" style={{ position: "relative", height: 640, overflow: "hidden" }}>
                        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2, overflow: "visible" }}>
                            <defs>
                                <filter id="red-glow">
                                    <feGaussianBlur stdDeviation="4" result="b" />
                                    <feFlood floodColor="#ff2020" floodOpacity="0.9" result="c" />
                                    <feComposite in="c" in2="b" operator="in" result="g" />
                                    <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            {relsWithCoords.map((line, i) => {
                                const isA = activeContradictionIds.includes(line.id);
                                if (isA) return (
                                    <g key={line.id}>
                                        <motion.path d={`M${line.x1} ${line.y1} Q${line.mx} ${line.my} ${line.x2} ${line.y2}`} fill="none" stroke="#ff2020" strokeWidth="3" strokeLinecap="round" filter="url(#red-glow)" animate={{ opacity: [0.7, 1, 0.7], strokeWidth: [3, 5, 3] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }} />
                                        <rect x={line.mx - 26} y={line.my - 10} width={52} height={16} rx={2} fill="rgba(180,20,20,0.8)" />
                                        <text x={line.mx} y={line.my + 3} textAnchor="middle" style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9, fill: "#ffaaaa", letterSpacing: "0.05em" }}>{line.label}</text>
                                    </g>
                                );
                                return (
                                    <g key={line.id}>
                                        <path d={`M${line.x1} ${line.y1} Q${line.mx} ${line.my} ${line.x2} ${line.y2}`} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2.5" strokeLinecap="round" transform="translate(1,2)" />
                                        <path d={`M${line.x1} ${line.y1} Q${line.mx} ${line.my} ${line.x2} ${line.y2}`} fill="none" stroke="#c8966a" strokeWidth="1.7" strokeLinecap="round" style={{ animation: `shimmer ${3 + i * 0.45}s ease-in-out infinite`, opacity: 0.7 }} />
                                        <rect x={line.mx - 25} y={line.my - 9} width={50} height={14} rx={2} fill="rgba(14,8,2,0.72)" stroke="rgba(200,150,90,0.18)" strokeWidth={0.5} />
                                        <text x={line.mx} y={line.my + 2} textAnchor="middle" style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9, fill: "rgba(205,175,125,0.75)", letterSpacing: "0.05em" }}>{line.label}</text>
                                    </g>
                                );
                            })}
                        </svg>

                        <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
                            {Object.keys(CHARS).map(id => (
                                <Card3D key={id} id={id} onOpenInterview={openInterview} isContradicted={contradictedChars.has(id)} />
                            ))}
                        </div>

                        {!sessionId && (
                            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontFamily: "'Courier Prime',monospace", fontSize: 12, color: "#ff8888", background: "rgba(0,0,0,0.88)", border: "1px solid rgba(192,57,43,0.4)", padding: "12px 20px", letterSpacing: "0.08em", zIndex: 20 }}>
                                ⚠ No session found. Return to opening scene.
                            </div>
                        )}

                        <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
                            <div style={{ pointerEvents: "auto" }}>
                                <ProgressMeter hasContradictionAlert={!!latestContradiction} />
                            </div>
                        </div>
                    </div>

                    {/* Action bar */}
                    <div style={{ background: "linear-gradient(90deg,rgba(0,0,0,0.55),rgba(0,0,0,0.28) 50%,rgba(0,0,0,0.55))", borderTop: "1px solid rgba(245,200,66,0.08)", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "0 0 3px 3px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="debug-btn" onClick={() => setLatestContradiction({ contradiction_id: `demo-${Date.now()}`, characters: ["victor", "martha"], claim_a: "Victor said he never entered the lounge after 6 PM.", claim_b: "Martha said she saw Victor near the lounge after 6 PM." })}>◈ Contradiction</button>
                            <button className="debug-btn" onClick={() => setProgressData({ show: true, score: 15, label: "Something's Off", flavor_text: "You noticed a crack in their version of events." })}>◈ Progress</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontFamily: "'Courier Prime',monospace", fontSize: 9, color: "rgba(196,184,154,0.28)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Hackathon PD — Det. File</span>
                            {gameState.phase >= 4 && <button className="accuse-btn" onClick={() => navigate("/accuse")}>⚑ Make Accusation</button>}
                        </div>
                    </div>
                </div>

                <div style={{ width: "75%", maxWidth: 950, height: 24, background: "radial-gradient(ellipse,rgba(0,0,0,0.65) 0%,transparent 72%)", marginTop: 0 }} />
            </div>

            {/* Overlay widgets — top right, above HUD */}
            <div className="overlay-widgets">
                <HintButton />
                <HintCard />
                <ContradictionAlert contradictionEvent={latestContradiction} onDismiss={() => setLatestContradiction(null)} />
            </div>
        </>
    );
}