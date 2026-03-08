import { useMemo, useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "../context/SessionContext";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import DetectiveHUD from "../components/DetectiveHUD";

const API_BASE = "http://127.0.0.1:8000";
const HUD_W = 248;

const ENDING_OPTIONS = [
    {
        id: 1,
        title: "Victor is the killer.",
        subtitle: "He tampered with Julian's drink with intent to harm.",
        description: "This treats Victor as the sole murderer. It fits the visible sabotage, but misses the larger chain of events.",
        accent: "#e74c3c",
        pinColor: "#c0392b",
        icon: "⚑",
        verdict: "GUILTY — SOLE PERP",
    },
    {
        id: 2,
        title: "Accidental chain reaction.",
        subtitle: "Multiple careless actions caused Julian's death.",
        description: "Sabotage, stress, missing medical support, and panic combined into one fatal outcome.",
        accent: "#e67e22",
        pinColor: "#d35400",
        icon: "⚖",
        verdict: "NEGLIGENCE — MANY",
    },
    {
        id: 3,
        title: "Julian staged his own death.",
        subtitle: "A stunt gone wrong — petty acts made it real.",
        description: "Julian planned the dramatic moment, and several independent acts turned it into a real death.",
        accent: "#9b59b6",
        pinColor: "#8e44ad",
        icon: "✦",
        verdict: "CONSPIRACY — SELF",
    },
];

// ── Horizontal roadmap steps ──────────────────────────────────────────────────
const TRUTH_STEPS = [
    { id: "plan", icon: "🎭", label: "The Plan", detail: "Julian planned to fake a dramatic collapse during demo night for a theatrical reveal.", accent: "#f5c842", type: "ORIGIN" },
    { id: "note", icon: "📝", label: "The Note", detail: '"THIS DEMO WILL KILL" — Julian\'s own dramatic note. Not a murder threat.', accent: "#f5c842", type: "CLUE" },
    { id: "victor", icon: "☕", label: "Victor's Swap", detail: "Victor swapped Julian's cold brew with an ultra-caffeinated sponsor drink.", accent: "#e67e22", type: "SABOTAGE" },
    { id: "rose", icon: "🎒", label: "Rose's Kit", detail: "Rose replaced Julian's VIP kit — removing his preferred meds and snacks.", accent: "#1abc9c", type: "SABOTAGE" },
    { id: "martha", icon: "💨", label: "Martha's Reel", detail: "Martha moved Julian's inhaler while filming a behind-the-scenes reel.", accent: "#9b59b6", type: "SABOTAGE" },
    { id: "trophy", icon: "⌨️", label: "The Keycap", detail: "Julian handled the keyboard trophy and accidentally loosened a detachable keycap.", accent: "#3498db", type: "CLUE" },
    { id: "stage", icon: "🎤", label: "The Collapse", detail: "Mid-speech he coughed, panicked, inhaled sharply, and choked on the keycap.", accent: "#e74c3c", type: "EVENT" },
    { id: "cascade", icon: "💔", label: "Cascade", detail: "Caffeine overload + breathing distress compounded. The situation became unsurvivable.", accent: "#c0392b", type: "EVENT" },
    { id: "death", icon: "☠", label: "Julian Dies", detail: "Not a single-villain murder. A fake stunt became a real death — multiple petty decisions.", accent: "#8e1a0e", type: "FINAL" },
];

// ── Typewriter ─────────────────────────────────────────────────────────────────
function useTypewriter(text, speed = 22, active = false) {
    const [displayed, setDisplayed] = useState("");
    const [done, setDone] = useState(false);
    const iRef = useRef(null);
    useEffect(() => {
        if (!active || !text) return;
        setDisplayed(""); setDone(false);
        let i = 0;
        iRef.current = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) { clearInterval(iRef.current); setDone(true); }
        }, speed);
        return () => clearInterval(iRef.current);
    }, [text, active, speed]);
    return { displayed, done };
}

function SpinnerSVG({ color = "#f5c842" }) {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke={`${color}33`} strokeWidth="1.5" />
            <path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Treasure map layout ───────────────────────────────────────────────────────
// Snake path: row1 L→R, curve down, row2 R→L, curve down, final X
// Node centres (cx, cy) — radius NR=28
const NR = 28;
const MAP_W = 860, MAP_H = 420;

// Row1: nodes 0-4 across top, Row2: nodes 5-7 across bottom, node 8 = final X
const NODE_POSITIONS = [
    { cx: 80, cy: 100 },  // 0 plan
    { cx: 220, cy: 80 },  // 1 note
    { cx: 370, cy: 108 },  // 2 victor
    { cx: 520, cy: 78 },  // 3 rose
    { cx: 670, cy: 105 },  // 4 martha
    { cx: 780, cy: 200 },  // 5 trophy  (turn corner)
    { cx: 620, cy: 300 },  // 6 stage
    { cx: 420, cy: 330 },  // 7 cascade
    { cx: 200, cy: 320 },  // 8 death   — the X
];

// Hand-crafted smooth path through all centres
const MAP_PATH = `
  M 80,100
  C 80,80 160,72 220,80
  C 280,88 310,100 370,108
  C 430,116 465,72 520,78
  C 575,84 615,96 670,105
  C 720,112 770,140 780,200
  C 790,260 720,280 620,300
  C 520,320 480,336 420,330
  C 360,324 280,320 200,320
`;


function TreasureMap({ visible, fullTruthText }) {
    const [activeId, setActiveId] = useState(null);
    const [revealed, setRevealed] = useState([]);

    useEffect(() => {
        if (!visible) { setRevealed([]); setActiveId(null); return; }
        TRUTH_STEPS.forEach((_, i) => {
            setTimeout(() => setRevealed(p => [...p, i]), 400 + i * 150);
        });
    }, [visible]);

    const activeStep = TRUTH_STEPS.find(s => s.id === activeId);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    style={{ overflow: "hidden", marginTop: 20 }}
                >
                    <div style={{ position: "relative" }}>
                        {/* Scroll curl top */}
                        <div style={{
                            height: 32, margin: "0 18px",
                            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                            background: "linear-gradient(180deg, #f0d870 0%, #c8a030 60%, #a87820 100%)",
                            boxShadow: "0 6px 18px rgba(0,0,0,0.45), inset 0 -3px 6px rgba(255,255,255,0.12)",
                            position: "relative", zIndex: 2,
                        }}>
                            <div style={{ position: "absolute", left: "18%", right: "18%", top: 7, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.2)" }} />
                        </div>

                        {/* Parchment body */}
                        <div style={{
                            margin: "0 4px",
                            background: "linear-gradient(170deg, #fef8d0 0%, #f8e898 30%, #f0d868 65%, #e8c858 100%)",
                            border: "2px solid #a87820",
                            borderTop: "none", borderBottom: "none",
                            position: "relative", overflow: "hidden",
                            boxShadow: "inset 0 0 80px rgba(160,90,10,0.18)",
                        }}>
                            {/* Paper grain */}
                            <div style={{
                                position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.07,
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                                backgroundSize: "150px",
                            }} />
                            {/* Edge burn */}
                            <div style={{
                                position: "absolute", inset: 0, pointerEvents: "none",
                                background: "radial-gradient(ellipse at 50% 50%, transparent 48%, rgba(130,70,8,0.3) 100%)"
                            }} />

                            {/* Header */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px 0" }}>
                                <div>
                                    <div style={{ fontFamily: "'Special Elite',cursive", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(80,38,6,0.5)", marginBottom: 3 }}>
                                        ◈ Canonical Truth — Evidence Trail
                                    </div>
                                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 900, fontStyle: "italic", color: "#2a1002" }}>
                                        How It Really Happened
                                    </div>
                                </div>
                                <svg width="58" height="58" viewBox="0 0 58 58" style={{ flexShrink: 0, opacity: 0.65 }}>
                                    <circle cx="29" cy="29" r="27" fill="rgba(160,110,20,0.1)" stroke="#7a4810" strokeWidth="1.5" />
                                    <circle cx="29" cy="29" r="18" fill="none" stroke="#7a4810" strokeWidth="0.8" strokeDasharray="3,2" />
                                    <polygon points="29,5 26,25 29,21 32,25" fill="#4a2006" />
                                    <polygon points="29,53 26,33 29,37 32,33" fill="#9a6828" />
                                    <polygon points="5,29 25,26 21,29 25,32" fill="#9a6828" />
                                    <polygon points="53,29 33,26 37,29 33,32" fill="#4a2006" />
                                    <circle cx="29" cy="29" r="4.5" fill="#4a2006" />
                                    <circle cx="29" cy="29" r="2" fill="#e8c050" />
                                    <text x="29" y="15" textAnchor="middle" style={{ fontFamily: "'Special Elite',cursive", fontSize: 9, fill: "#2a1002", fontWeight: 700 }}>N</text>
                                    <text x="29" y="49" textAnchor="middle" style={{ fontFamily: "'Special Elite',cursive", fontSize: 8, fill: "#7a4810" }}>S</text>
                                    <text x="9" y="33" textAnchor="middle" style={{ fontFamily: "'Special Elite',cursive", fontSize: 8, fill: "#7a4810" }}>W</text>
                                    <text x="51" y="33" textAnchor="middle" style={{ fontFamily: "'Special Elite',cursive", fontSize: 8, fill: "#7a4810" }}>E</text>
                                </svg>
                            </div>

                            {/* SVG MAP */}
                            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", display: "block" }}>
                                <defs>
                                    <filter id="ndshadow2" x="-30%" y="-30%" width="160%" height="160%">
                                        <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="rgba(50,20,0,0.45)" />
                                    </filter>
                                    <radialGradient id="nodegrad2" cx="35%" cy="30%" r="65%">
                                        <stop offset="0%" stopColor="#fffce8" />
                                        <stop offset="100%" stopColor="#e8cc60" />
                                    </radialGradient>
                                    <radialGradient id="finalnodegrad2" cx="35%" cy="30%" r="65%">
                                        <stop offset="0%" stopColor="#3c0a0a" />
                                        <stop offset="100%" stopColor="#160202" />
                                    </radialGradient>
                                    <marker id="arrtip2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                                        <polygon points="0,1 8,4 0,7" fill="rgba(90,45,8,0.7)" />
                                    </marker>
                                </defs>

                                {/* Ocean waves left */}
                                {[0, 1, 2, 3, 4].map(i => (
                                    <path key={`wa${i}`}
                                        d={`M ${-8 + i * 20},${190 + i * 4} Q ${4 + i * 20},${178 + i * 4} ${18 + i * 20},${190 + i * 4} Q ${32 + i * 20},${202 + i * 4} ${46 + i * 20},${190 + i * 4}`}
                                        fill="none" stroke="rgba(50,100,200,0.2)" strokeWidth="1.8" strokeLinecap="round" />
                                ))}
                                {/* Waves bottom right */}
                                {[0, 1, 2, 3].map(i => (
                                    <path key={`wb${i}`}
                                        d={`M ${580 + i * 26},${385 + i * 3} Q ${593 + i * 26},${373 + i * 3} ${606 + i * 26},${385 + i * 3}`}
                                        fill="none" stroke="rgba(50,100,200,0.18)" strokeWidth="1.6" strokeLinecap="round" />
                                ))}
                                {/* Octopus */}
                                <text x="8" y="195" style={{ fontSize: 46, opacity: 0.18 }}>🐙</text>
                                {/* Key */}
                                <text x="140" y="215" style={{ fontSize: 22, opacity: 0.22 }}>🗝️</text>
                                {/* Treasure near death */}
                                <text x={NODE_POSITIONS[8].cx + 36} y={NODE_POSITIONS[8].cy - 20} style={{ fontSize: 26, opacity: 0.28 }}>🪙</text>
                                {/* Palm island bottom left */}
                                <ellipse cx="72" cy={MAP_H - 22} rx="55" ry="18" fill="rgba(90,150,50,0.16)" />
                                <text x="42" y={MAP_H - 10} style={{ fontSize: 32, opacity: 0.2 }}>🌴</text>
                                {/* Sailboat right */}
                                <text x={MAP_W - 62} y="268" style={{ fontSize: 36, opacity: 0.18 }}>⛵</text>
                                {/* Starfish */}
                                <text x="370" y={MAP_H - 14} style={{ fontSize: 18, opacity: 0.18 }}>⭐</text>
                                <text x="510" y={MAP_H - 7} style={{ fontSize: 14, opacity: 0.14 }}>⭐</text>
                                {/* Mountains */}
                                <polygon points="430,390 460,345 490,390" fill="rgba(110,70,30,0.14)" />
                                <polygon points="545,395 567,355 589,395" fill="rgba(110,70,30,0.11)" />

                                {/* Dotted trail shadow */}
                                <path d={MAP_PATH} fill="none" stroke="rgba(60,25,0,0.18)"
                                    strokeWidth="7" strokeLinecap="round" transform="translate(3,4)" />
                                {/* Animated dotted line */}
                                <motion.path
                                    d={MAP_PATH} fill="none"
                                    stroke="rgba(100,50,10,0.65)"
                                    strokeWidth="3" strokeLinecap="round"
                                    strokeDasharray="7 8"
                                    markerEnd="url(#arrtip2)"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={revealed.length > 0 ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                                    transition={{ duration: 2.4, ease: "easeInOut" }}
                                />

                                {/* Nodes */}
                                {TRUTH_STEPS.map((step, i) => {
                                    const { cx, cy } = NODE_POSITIONS[i];
                                    const isActive = activeId === step.id;
                                    const isVis = revealed.includes(i);
                                    const isFinal = step.type === "FINAL";
                                    const r = isFinal ? NR + 8 : NR;
                                    const labelBelow = i <= 4;
                                    const lblY = labelBelow ? cy + r + 17 : cy - r - 20;
                                    const typeY = labelBelow ? lblY + 13 : lblY - 13;

                                    return (
                                        <motion.g
                                            key={step.id}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={isVis ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 280, damping: 22 }}
                                            style={{ transformOrigin: `${cx}px ${cy}px`, cursor: "crosshair" }}
                                            onClick={() => setActiveId(isActive ? null : step.id)}
                                        >
                                            {isFinal && (
                                                <motion.circle cx={cx} cy={cy} r={r + 14}
                                                    fill="none" stroke="rgba(192,57,43,0.5)" strokeWidth="2.5"
                                                    animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                                                    transition={{ duration: 1.8, repeat: Infinity }}
                                                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                                                />
                                            )}
                                            {isActive && (
                                                <circle cx={cx} cy={cy} r={r + 10}
                                                    fill="none" stroke={step.accent}
                                                    strokeWidth="2.5" strokeDasharray="6,3" opacity="0.9" />
                                            )}
                                            <ellipse cx={cx + 3} cy={cy + 6} rx={r + 2} ry={r * 0.55} fill="rgba(50,20,0,0.28)" />
                                            <circle cx={cx} cy={cy} r={r}
                                                fill={isFinal ? "url(#finalnodegrad2)" : "url(#nodegrad2)"}
                                                stroke={isActive ? step.accent : `${step.accent}90`}
                                                strokeWidth={isActive ? 3 : 2}
                                                filter="url(#ndshadow2)"
                                            />
                                            <circle cx={cx} cy={cy} r={r - 6}
                                                fill="none" stroke={`${step.accent}45`}
                                                strokeWidth="1.2" strokeDasharray="4,3" />
                                            <text x={cx} y={cy + (isFinal ? 10 : 9)} textAnchor="middle"
                                                style={{ fontSize: isFinal ? 26 : 20, userSelect: "none" }}>
                                                {step.icon}
                                            </text>
                                            <circle cx={cx - r + 9} cy={cy - r + 9} r={11}
                                                fill={step.accent} stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
                                            <text x={cx - r + 9} y={cy - r + 13} textAnchor="middle"
                                                style={{
                                                    fontFamily: "'Courier Prime',monospace", fontSize: 9, fontWeight: 700,
                                                    fill: isFinal ? "#fff" : "#280e00", userSelect: "none"
                                                }}>
                                                {i + 1}
                                            </text>
                                            <text x={cx} y={lblY} textAnchor="middle"
                                                style={{
                                                    fontFamily: "'Special Elite',cursive",
                                                    fontSize: isFinal ? 13 : 11, fontWeight: isFinal ? 700 : 400,
                                                    fill: isActive ? step.accent : isFinal ? "#7a1008" : "rgba(44,18,2,0.88)",
                                                    userSelect: "none"
                                                }}>
                                                {step.label}
                                            </text>
                                            <text x={cx} y={typeY} textAnchor="middle"
                                                style={{
                                                    fontFamily: "'Courier Prime',monospace", fontSize: 8,
                                                    fill: `${step.accent}aa`, letterSpacing: "0.1em", userSelect: "none"
                                                }}>
                                                {step.type}
                                            </text>
                                            {isFinal && (
                                                <text x={cx + r + 4} y={cy - r + 4} textAnchor="middle"
                                                    style={{ fontFamily: "serif", fontSize: 28, fill: "rgba(180,40,20,0.8)", fontWeight: 900, userSelect: "none" }}>
                                                    ✕
                                                </text>
                                            )}
                                        </motion.g>
                                    );
                                })}

                                {/* Tooltip */}
                                <AnimatePresence>
                                    {activeStep && (() => {
                                        const idx = TRUTH_STEPS.findIndex(s => s.id === activeStep.id);
                                        const { cx, cy } = NODE_POSITIONS[idx];
                                        const r = activeStep.type === "FINAL" ? NR + 8 : NR;
                                        const cW = 218, cH = 90;
                                        const above = cy > MAP_H * 0.52;
                                        const cX = Math.min(Math.max(cx - cW / 2, 6), MAP_W - cW - 6);
                                        const cY = above ? cy - r - cH - 14 : cy + r + 14;
                                        const tX = Math.min(Math.max(cx, cX + 12), cX + cW - 12);
                                        return (
                                            <motion.g key={activeStep.id + "-tt"}
                                                initial={{ opacity: 0, scale: 0.88 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.88 }}
                                                style={{ transformOrigin: `${cx}px ${above ? cy - r - 14 : cy + r + 14}px` }}
                                            >
                                                <polygon
                                                    points={above
                                                        ? `${tX - 7},${cY + cH} ${tX + 7},${cY + cH} ${tX},${cY + cH + 12}`
                                                        : `${tX - 7},${cY - 1} ${tX + 7},${cY - 1} ${tX},${cY - 12}`}
                                                    fill="rgba(18,8,1,0.97)"
                                                />
                                                <rect x={cX} y={cY} width={cW} height={cH} rx="5"
                                                    fill="rgba(18,8,1,0.97)"
                                                    stroke={`${activeStep.accent}65`} strokeWidth="1.3" />
                                                <rect x={cX} y={cY} width={cW} height={4} rx="5"
                                                    fill={activeStep.accent} opacity="0.9" />
                                                <foreignObject x={cX + 10} y={cY + 10} width={cW - 20} height={cH - 16}>
                                                    <div xmlns="http://www.w3.org/1999/xhtml">
                                                        <div style={{
                                                            fontFamily: "'Special Elite',cursive", fontSize: 9, letterSpacing: "0.15em",
                                                            color: `${activeStep.accent}cc`, textTransform: "uppercase", marginBottom: 5
                                                        }}>
                                                            {activeStep.type} — {activeStep.label}
                                                        </div>
                                                        <div style={{
                                                            fontFamily: "'Courier Prime',monospace", fontSize: 11, lineHeight: 1.55,
                                                            color: "rgba(228,208,160,0.95)"
                                                        }}>
                                                            {activeStep.detail}
                                                        </div>
                                                    </div>
                                                </foreignObject>
                                            </motion.g>
                                        );
                                    })()}
                                </AnimatePresence>
                            </svg>

                            <div style={{
                                padding: "0 28px 10px", fontFamily: "'Courier Prime',monospace", fontSize: 9,
                                color: "rgba(80,40,8,0.38)", letterSpacing: "0.15em", fontStyle: "italic"
                            }}>
                                ↑ Click any node to reveal the detail
                            </div>

                            {fullTruthText && (
                                <div style={{
                                    margin: "0 28px 18px", padding: "12px 16px",
                                    border: "1px solid rgba(110,60,8,0.2)", background: "rgba(0,0,0,0.06)", borderRadius: 3
                                }}>
                                    <div style={{
                                        fontFamily: "'Courier Prime',monospace", fontSize: 8, letterSpacing: "0.25em",
                                        textTransform: "uppercase", color: "rgba(80,40,8,0.38)", marginBottom: 8
                                    }}>
                                        — Backend Analysis —
                                    </div>
                                    <div style={{
                                        fontFamily: "'Courier Prime',monospace", fontSize: 11.5, lineHeight: 1.72,
                                        color: "rgba(62,28,4,0.72)", fontStyle: "italic"
                                    }}>
                                        {fullTruthText}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Scroll curl bottom */}
                        <div style={{
                            height: 32, margin: "0 18px",
                            borderRadius: "0 0 50% 50% / 0 0 100% 100%",
                            background: "linear-gradient(0deg, #f0d870 0%, #c8a030 60%, #a87820 100%)",
                            boxShadow: "0 -2px 6px rgba(0,0,0,0.2), 0 8px 22px rgba(0,0,0,0.38), inset 0 3px 6px rgba(255,255,255,0.12)",
                            position: "relative", zIndex: 2,
                        }}>
                            <div style={{ position: "absolute", left: "18%", right: "18%", bottom: 7, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.15)" }} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Score seal ─────────────────────────────────────────────────────────────────
function ScoreSeal({ score }) {
    const grade = score >= 80 ? "S" : score >= 60 ? "A" : score >= 40 ? "B" : "C";
    const color = score >= 80 ? "#f5c842" : score >= 60 ? "#1abc9c" : score >= 40 ? "#3498db" : "#e74c3c";
    return (
        <motion.div
            initial={{ scale: 0, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}
            style={{
                width: 80, height: 80, borderRadius: "50%",
                border: `2px solid ${color}66`,
                background: `radial-gradient(circle, ${color}15, ${color}05)`,
                boxShadow: `0 0 0 4px ${color}22, 0 0 30px ${color}22`,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
        >
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{grade}</div>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, color: `${color}88`, letterSpacing: "0.1em" }}>{score}pts</div>
        </motion.div>
    );
}

// ── Reveal overlay ─────────────────────────────────────────────────────────────
function RevealOverlay({ result, showTruth, onClose, onToggleTruth }) {
    const { displayed, done } = useTypewriter(result?.ending_text || "", 18, !!result);
    const [blinkOn, setBlinkOn] = useState(true);
    useEffect(() => {
        if (!result) return;
        const b = setInterval(() => setBlinkOn(v => !v), 520);
        return () => clearInterval(b);
    }, [result]);

    return (
        <AnimatePresence>
            {result && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                        position: "fixed", inset: 0, zIndex: 9500,
                        display: "flex", alignItems: "flex-start", justifyContent: "center",
                        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)",
                        padding: "28px 24px", overflowY: "auto",
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 32, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 24, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 24 }}
                        style={{
                            position: "relative", width: "100%", maxWidth: 860,
                            background: "linear-gradient(160deg, #100d08 0%, #0d0a06 100%)",
                            border: "1px solid rgba(245,200,66,0.18)", borderRadius: 3, overflow: "hidden",
                            boxShadow: "0 24px 100px rgba(0,0,0,0.95), 0 0 60px rgba(245,200,66,0.06)",
                        }}
                    >
                        {/* Paper lines */}
                        <div style={{
                            position: "absolute", inset: 0, pointerEvents: "none",
                            background: "repeating-linear-gradient(transparent, transparent 22px, rgba(255,255,255,0.012) 22px, rgba(255,255,255,0.012) 23px)",
                        }} />
                        {/* Amber top strip */}
                        <div style={{ height: 4, background: "linear-gradient(90deg, #f5c842, #f5c84288, transparent)" }} />
                        {/* Left margin */}
                        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: "linear-gradient(to bottom, #f5c842, #f5c84222)" }} />

                        <div style={{ padding: "22px 28px 28px 32px", position: "relative", zIndex: 1 }}>
                            {/* Header */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                                <div>
                                    <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(245,200,66,0.45)", marginBottom: 6 }}>
                                        ◈ Case Resolution — Hackathon P.D.
                                    </div>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, fontStyle: "italic", color: "#f5c842", lineHeight: 1.05, textShadow: "0 0 30px rgba(245,200,66,0.25)" }}>
                                        Case Closed
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    {result.score != null && <ScoreSeal score={result.score} />}
                                    <button onClick={onClose} style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(196,184,154,0.4)", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, padding: "6px 12px", cursor: "crosshair", transition: "all 0.2s" }}
                                        onMouseEnter={e => e.currentTarget.style.color = "rgba(196,184,154,0.8)"}
                                        onMouseLeave={e => e.currentTarget.style.color = "rgba(196,184,154,0.4)"}
                                    >✕ Close</button>
                                </div>
                            </div>

                            {/* Ending text */}
                            <div style={{ border: "1px solid rgba(245,200,66,0.1)", background: "rgba(0,0,0,0.3)", borderRadius: 3, padding: "16px 18px", marginBottom: 18 }}>
                                <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(245,200,66,0.2), transparent)", marginTop: -16, pointerEvents: "none" }} />
                                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, lineHeight: 1.82, color: "rgba(232,220,200,0.9)", whiteSpace: "pre-wrap" }}>
                                    {displayed}
                                    {!done && <span style={{ opacity: blinkOn ? 1 : 0, color: "#f5c842" }}>|</span>}
                                </div>
                            </div>

                            {/* Score + hints */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 18 }}>
                                <div style={{ border: "1px solid rgba(245,200,66,0.15)", background: "rgba(245,200,66,0.04)", borderRadius: 3, padding: "14px 16px" }}>
                                    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(245,200,66,0.4)", marginBottom: 8 }}>Final Score</div>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#f5c842", textShadow: "0 0 20px rgba(245,200,66,0.4)", lineHeight: 1 }}>{result.score}</div>
                                </div>
                                <div style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)", borderRadius: 3, padding: "14px 16px" }}>
                                    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(196,184,154,0.35)", marginBottom: 8 }}>Hint Usage</div>
                                    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, lineHeight: 1.65, color: "rgba(196,184,154,0.7)" }}>{result.hints_used_note}</div>
                                </div>
                            </div>

                            {/* Truth toggle */}
                            <button onClick={onToggleTruth} style={{
                                fontFamily: "'Special Elite', cursive", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
                                color: showTruth ? "#f5c842" : "rgba(245,200,66,0.55)",
                                background: showTruth ? "rgba(245,200,66,0.12)" : "rgba(245,200,66,0.05)",
                                border: `1px solid ${showTruth ? "rgba(245,200,66,0.4)" : "rgba(245,200,66,0.18)"}`,
                                borderRadius: 2, padding: "9px 18px", cursor: "crosshair", transition: "all 0.2s",
                            }}>
                                {showTruth ? "▾ Hide Truth Map" : "▸ Reveal Truth Map 🗺"}
                            </button>

                            <TreasureMap visible={showTruth} fullTruthText={result.full_truth_reveal} />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Ending card ────────────────────────────────────────────────────────────────
function EndingCard({ option, onChoose, loadingChoice, disabled, index }) {
    const [hovered, setHovered] = useState(false);
    const isLoading = loadingChoice === option.id;
    const accent = option.accent;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + index * 0.14, type: "spring", stiffness: 240, damping: 24 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative", borderRadius: 3, overflow: "hidden",
                border: hovered ? `1px solid ${accent}55` : `1px solid ${accent}22`,
                background: hovered
                    ? "linear-gradient(160deg, #fef8e8 0%, #f5e8c0 100%)"
                    : "linear-gradient(160deg, #fdf6e3 0%, #f0dfbc 100%)",
                boxShadow: hovered
                    ? `0 12px 50px rgba(0,0,0,0.5), 0 0 0 1px ${accent}22, 0 0 40px ${accent}0d`
                    : "0 6px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
                transition: "all 0.25s",
                cursor: "crosshair",
            }}
        >
            {/* Paper lines */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "repeating-linear-gradient(transparent, transparent 22px, rgba(100,60,20,0.07) 22px, rgba(100,60,20,0.07) 23px)",
            }} />
            {/* Left margin red line */}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 24, width: 1, background: "rgba(192,57,43,0.22)", pointerEvents: "none" }} />
            {/* Top accent strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}66, transparent)` }} />
            {/* Pushpin */}
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
                <svg width="20" height="24" viewBox="0 0 20 24">
                    <defs>
                        <radialGradient id={`pg-${option.id}`} cx="38%" cy="32%">
                            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                            <stop offset="100%" stopColor={option.pinColor} />
                        </radialGradient>
                    </defs>
                    <circle cx="10" cy="9" r="8" fill={`url(#pg-${option.id})`} />
                    <circle cx="7.5" cy="6.5" r="2.5" fill="rgba(255,255,255,0.35)" />
                    <rect x="8.5" y="16" width="3" height="8" rx="1.5" fill="#888" />
                </svg>
            </div>
            {/* Corner fold */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 20, height: 20, background: `linear-gradient(225deg, ${accent}44 50%, transparent 50%)`, pointerEvents: "none" }} />

            <div style={{ padding: "22px 18px 18px 32px", position: "relative", zIndex: 1 }}>
                {/* Verdict tag */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: `${accent}99` }}>
                        Theory {option.id}
                    </div>
                    <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 7.5, letterSpacing: "0.15em", textTransform: "uppercase", color: accent, border: `1px solid ${accent}44`, background: `${accent}11`, padding: "2px 8px", borderRadius: 2 }}>
                        {option.verdict}
                    </div>
                </div>

                {/* Big icon */}
                <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 12, filter: `drop-shadow(0 0 6px ${accent}66)` }}>
                    {option.icon}
                </div>

                {/* Title */}
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, fontStyle: "italic", color: "#2a1408", lineHeight: 1.2, marginBottom: 7 }}>
                    {option.title}
                </div>
                <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 10.5, color: `${accent}cc`, marginBottom: 12, lineHeight: 1.4 }}>
                    {option.subtitle}
                </div>
                <div style={{ height: 1, background: `linear-gradient(90deg, ${accent}33, rgba(0,0,0,0.08) 60%, transparent)`, marginBottom: 12 }} />
                <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11.5, lineHeight: 1.75, color: "rgba(60,30,5,0.65)", marginBottom: 20 }}>
                    {option.description}
                </div>

                {/* CTA */}
                <button
                    onClick={() => onChoose(option.id)}
                    disabled={disabled}
                    style={{
                        fontFamily: "'Special Elite', cursive", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
                        color: isLoading ? `${accent}66` : "#fff",
                        background: isLoading ? `${accent}33` : accent,
                        border: `1px solid ${accent}`,
                        borderRadius: 2, padding: "10px 20px",
                        cursor: disabled ? "not-allowed" : "crosshair",
                        transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
                        opacity: disabled && !isLoading ? 0.45 : 1,
                        width: "100%", justifyContent: "center",
                        boxShadow: isLoading ? "none" : `0 4px 16px ${accent}44`,
                    }}
                    onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(1.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                >
                    {isLoading ? <><SpinnerSVG color="#fff" /> Deliberating...</> : <>⚑ File This Accusation</>}
                </button>
            </div>
        </motion.div>
    );
}

// ── Tape banner ────────────────────────────────────────────────────────────────
function TapeBanner() {
    const [off, setOff] = useState(0);
    useEffect(() => {
        let raf, o = 0;
        const tick = () => { o = (o + 0.45) % 300; setOff(o); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);
    return (
        <div style={{ overflow: "hidden", height: 22, background: "#f5e642", flexShrink: 0 }}>
            <div style={{ whiteSpace: "nowrap", height: "100%", display: "flex", alignItems: "center", fontFamily: "'Special Elite', cursive", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: "#0a0a0a" }}>
                <span style={{ display: "inline-block", transform: `translateX(-${off}px)` }}>
                    {"FINAL ACCUSATION • CASE #0001 • CHOOSE CAREFULLY • THIS DECISION IS PERMANENT • ".repeat(14)}
                </span>
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Accusation() {
    const { sessionId } = useSession();
    const [loadingChoice, setLoadingChoice] = useState(null);
    const [result, setResult] = useState(null);
    const [showTruth, setShowTruth] = useState(false);
    const [error, setError] = useState("");
    const sessionMissing = useMemo(() => !sessionId, [sessionId]);

    const handleChooseEnding = async (endingChoice) => {
        if (!sessionId) return;
        setLoadingChoice(endingChoice);
        setError("");
        try {
            const r = await fetch(`${API_BASE}/accuse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, ending_choice: endingChoice }),
            });
            if (!r.ok) throw new Error("Failed to submit accusation");
            const data = await r.json();
            setResult(data); setShowTruth(false);
        } catch (err) {
            setError(err.message || "Could not submit accusation.");
        } finally {
            setLoadingChoice(null);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Special+Elite&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
                * { cursor: crosshair !important; }
                @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
                @keyframes lamp-flicker { 0%,90%,100%{opacity:1;} 91%{opacity:0.5;} 93%{opacity:0.85;} 95%{opacity:0.35;} 97%{opacity:1;} }
                .overlay-widgets { position:fixed; top:16px; right:20px; z-index:9000; display:flex; flex-direction:column; align-items:flex-end; gap:8px; pointer-events:none; }
                .overlay-widgets > * { pointer-events:auto; }
            `}</style>

            {/* Film grain */}
            <div style={{
                position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none", opacity: 0.045,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundSize: "180px",
            }} />
            {/* Vignette */}
            <div style={{ position: "fixed", inset: 0, zIndex: 9997, pointerEvents: "none", background: "radial-gradient(ellipse at 55% 12%, transparent 40%, rgba(0,0,0,0.78) 100%)" }} />

            <DetectiveHUD />

            <div style={{
                minHeight: "100vh",
                marginLeft: HUD_W,
                background: "radial-gradient(ellipse at 55% 12%, rgba(90,45,10,0.4) 0%, #060402 65%)",
                fontFamily: "'Courier Prime', monospace",
                color: "#e8dcc8",
                position: "relative",
            }}>
                {/* Lamp — amber like corkboard */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 18, position: "relative", zIndex: 2 }}>
                    <div style={{ width: 3, height: 60, background: "linear-gradient(to bottom, rgba(245,200,66,0.22), rgba(245,200,66,0.05))" }} />
                    <div style={{ width: 180, height: 22, background: "linear-gradient(180deg,#2c1c06,#1a0e04)", borderRadius: "0 0 60% 60%", border: "1px solid rgba(245,200,66,0.2)", boxShadow: "0 6px 40px rgba(245,200,66,0.18)", animation: "lamp-flicker 9s ease-in-out infinite", marginBottom: 2 }} />
                </div>

                {/* Wooden frame header — same as Corkboard */}
                <div style={{
                    margin: "0 24px", borderRadius: "8px 8px 0 0",
                    background: "linear-gradient(180deg,#3a1c08 0%,#251204 100%)",
                    border: "1px solid rgba(245,200,66,0.1)",
                    boxShadow: "0 0 0 1px rgba(245,200,66,0.08), 0 -4px 20px rgba(0,0,0,0.6), inset 0 3px 0 rgba(255,200,100,0.06)",
                    position: "relative", zIndex: 2,
                }}>
                    {/* Bolts */}
                    {[{ top: 8, left: 10 }, { top: 8, right: 10 }].map((s, i) => (
                        <div key={i} style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#bbb,#444)", boxShadow: "0 1px 3px rgba(0,0,0,0.7)", ...s }} />
                    ))}
                    <div style={{
                        background: "linear-gradient(90deg,rgba(0,0,0,0.65),rgba(0,0,0,0.3) 50%,rgba(0,0,0,0.65))",
                        padding: "12px 24px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                        <div>
                            <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(245,200,66,0.45)", marginBottom: 5 }}>
                                ◈ Hackathon P.D. — Final Decision
                            </div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, fontStyle: "italic", color: "#f5c842", textShadow: "0 0 24px rgba(245,200,66,0.35)", lineHeight: 1.05 }}>
                                Make Your Accusation, Detective.
                            </div>
                            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: "rgba(196,184,154,0.4)", marginTop: 4, maxWidth: 520, lineHeight: 1.7 }}>
                                Choose the explanation that best fits the evidence. Your final report goes on record.
                            </div>
                        </div>
                        {/* Stamp */}
                        <motion.div
                            initial={{ opacity: 0, rotate: -15, scale: 0.8 }}
                            animate={{ opacity: 1, rotate: -6, scale: 1 }}
                            transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 16 }}
                            style={{ fontFamily: "'Special Elite', cursive", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", textAlign: "center", color: "rgba(245,200,66,0.6)", border: "2px solid rgba(245,200,66,0.28)", borderRadius: "50%", width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1.3, padding: 6, boxShadow: "0 0 20px rgba(245,200,66,0.08)" }}
                        >
                            POINT OF NO RETURN
                        </motion.div>
                    </div>
                </div>

                <TapeBanner />

                {/* Cork board body */}
                <div style={{
                    margin: "0 24px", padding: "24px 28px 48px",
                    background: "#7a5230",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0.5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)' opacity='0.5'/%3E%3C/svg%3E"),
                        repeating-linear-gradient(18deg,rgba(255,255,255,0.014) 0,rgba(255,255,255,0.014) 1px,transparent 1px,transparent 8px)`,
                    backgroundSize: "80px 80px, 10px 10px",
                    borderRadius: "0 0 8px 8px",
                    border: "1px solid rgba(245,200,66,0.08)",
                    borderTop: "none",
                    boxShadow: "0 30px 90px rgba(0,0,0,0.85), inset 0 0 80px rgba(0,0,0,0.45)",
                    position: "relative", zIndex: 1, minHeight: 400,
                }}>
                    {/* Lamp glow on cork */}
                    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 700, height: 280, background: "radial-gradient(ellipse,rgba(255,215,100,0.08) 0%,transparent 68%)", pointerEvents: "none" }} />

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 3, border: "1px solid rgba(231,76,60,0.3)", background: "rgba(0,0,0,0.6)", fontFamily: "'Courier Prime', monospace", fontSize: 11.5, color: "rgba(231,76,60,0.85)" }}>
                                ⚠ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {sessionMissing && (
                        <div style={{ padding: "20px 16px", border: "1px solid rgba(245,200,66,0.15)", background: "rgba(0,0,0,0.5)", borderRadius: 3, fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "rgba(245,200,66,0.5)", marginBottom: 20 }}>
                            No active session. Return to the opening scene to begin the investigation.
                        </div>
                    )}

                    {/* Preamble note — looks like a pinned paper */}
                    <div style={{ marginBottom: 24, padding: "14px 18px 14px 22px", background: "linear-gradient(160deg,#fdf6e3,#f0dfbc)", borderRadius: 3, border: "1px solid rgba(200,150,70,0.3)", borderLeft: "3px solid rgba(192,57,43,0.5)", fontFamily: "'Courier Prime', monospace", fontSize: 12, lineHeight: 1.75, color: "rgba(60,30,5,0.65)", fontStyle: "italic", boxShadow: "0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)", position: "relative" }}>
                        {/* Pushpin on note */}
                        <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)" }}>
                            <svg width="16" height="20" viewBox="0 0 16 20"><circle cx="8" cy="7" r="6" fill="#e74c3c" /><circle cx="6" cy="5" r="2" fill="rgba(255,255,255,0.3)" /><rect x="7" y="12" width="2" height="8" rx="1" fill="#888" /></svg>
                        </div>
                        Julian Byte is dead. The crowd watched. The evidence is in. Three theories remain.
                        One is closer to the truth than the others. Choose wisely — your final report goes on record.
                    </div>

                    {/* Cards grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
                        {ENDING_OPTIONS.map((option, i) => (
                            <EndingCard
                                key={option.id}
                                option={option}
                                index={i}
                                onChoose={handleChooseEnding}
                                loadingChoice={loadingChoice}
                                disabled={sessionMissing || !!loadingChoice}
                            />
                        ))}
                    </div>
                </div>

                {/* Bottom shadow */}
                <div style={{ height: 24, background: "radial-gradient(ellipse,rgba(0,0,0,0.5) 0%,transparent 72%)", margin: "0 24px" }} />
            </div>

            <RevealOverlay
                result={result}
                showTruth={showTruth}
                onClose={() => setResult(null)}
                onToggleTruth={() => setShowTruth(v => !v)}
            />

            <div className="overlay-widgets">
                <HintButton />
                <HintCard />
            </div>
        </>
    );
}