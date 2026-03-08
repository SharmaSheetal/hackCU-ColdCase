import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import evidenceData from "../../../data/evidence/evidence.json";
import { useSession } from "../context/SessionContext";
import { useProgress } from "../context/ProgressContext";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import ContradictionAlert from "../components/ContradictionAlert";
import ProgressMeter from "../components/ProgressMeter";
import DetectiveHUD from "../components/DetectiveHUD";

const API_BASE = "http://127.0.0.1:8000";
const HUD_W = 248;

const evidenceItems = Array.isArray(evidenceData)
    ? evidenceData
    : evidenceData.evidence || [];

// Evidence type → icon + color
const EVIDENCE_META = {
    drink: { icon: "☕", label: "Beverage", accent: "#e67e22" },
    document: { icon: "📄", label: "Document", accent: "#3498db" },
    medical: { icon: "💊", label: "Medical", accent: "#e74c3c" },
    digital: { icon: "💻", label: "Digital", accent: "#1abc9c" },
    physical: { icon: "🔍", label: "Physical", accent: "#9b59b6" },
    note: { icon: "📝", label: "Note", accent: "#f5c842" },
    default: { icon: "🧾", label: "Evidence", accent: "#f5c842" },
};

function getEvidenceMeta(item) {
    const id = (item.id || "").toLowerCase();
    if (id.includes("drink") || id.includes("brew") || id.includes("coffee")) return EVIDENCE_META.drink;
    if (id.includes("note") || id.includes("sticky")) return EVIDENCE_META.note;
    if (id.includes("inhaler") || id.includes("medic")) return EVIDENCE_META.medical;
    if (id.includes("laptop") || id.includes("digital")) return EVIDENCE_META.digital;
    if (id.includes("doc") || id.includes("file") || id.includes("report")) return EVIDENCE_META.document;
    return EVIDENCE_META.default;
}

// ── Single evidence card ──────────────────────────────────────────────────────
function EvidenceCard({ item, unlocked, submitting, submitted, flashed, onSubmit }) {
    const meta = getEvidenceMeta(item);
    const accent = unlocked ? meta.accent : "rgba(255,255,255,0.15)";
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative",
                borderRadius: 3,
                overflow: "hidden",
                border: flashed
                    ? "1px solid rgba(26,188,156,0.6)"
                    : `1px solid ${unlocked ? `${accent}30` : "rgba(255,255,255,0.07)"}`,
                background: flashed
                    ? "linear-gradient(160deg, #041510 0%, #031a12 100%)"
                    : unlocked
                        ? `linear-gradient(160deg, #0e0b08 0%, #0a0806 100%)`
                        : "linear-gradient(160deg, #0a0a0a 0%, #080808 100%)",
                boxShadow: hovered && unlocked
                    ? `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${accent}22, 0 0 24px ${accent}10`
                    : "0 4px 20px rgba(0,0,0,0.5)",
                transition: "box-shadow 0.25s, border-color 0.25s, background 0.25s",
            }}
        >
            {/* Paper lines texture */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "repeating-linear-gradient(transparent, transparent 22px, rgba(255,255,255,0.015) 22px, rgba(255,255,255,0.015) 23px)",
            }} />
            {/* Left margin accent */}
            <div style={{
                position: "absolute", top: 0, bottom: 0, left: 0, width: 3,
                background: `linear-gradient(to bottom, ${accent}88, ${accent}22)`,
                opacity: unlocked ? 1 : 0.25,
            }} />
            {/* Corner fold */}
            <div style={{
                position: "absolute", top: 0, right: 0, width: 18, height: 18,
                background: `linear-gradient(225deg, ${unlocked ? accent : "rgba(255,255,255,0.1)"}33 50%, transparent 50%)`,
                pointerEvents: "none",
            }} />

            {/* Locked overlay */}
            <AnimatePresence>
                {!unlocked && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: "absolute", inset: 0, zIndex: 10,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(1.5px)",
                            borderRadius: 3,
                        }}
                    >
                        <div style={{ fontSize: 32, filter: "grayscale(1) opacity(0.5)" }}>🔒</div>
                        <div style={{
                            marginTop: 8, fontFamily: "'Special Elite', cursive",
                            fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase",
                            color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)",
                            padding: "3px 10px", borderRadius: 2,
                        }}>
                            Classified
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ opacity: unlocked ? 1 : 0.38, padding: "20px 18px 18px 22px", position: "relative", zIndex: 1 }}>

                {/* Evidence type icon + tag */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 3,
                        background: `radial-gradient(circle at 35% 35%, ${accent}22, ${accent}05)`,
                        border: `1px solid ${accent}28`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, flexShrink: 0,
                        boxShadow: `inset 0 0 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
                    }}>
                        {meta.icon}
                    </div>
                    <div>
                        <div style={{
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase",
                            color: `${accent}66`, marginBottom: 3,
                        }}>
                            {meta.label}
                        </div>
                        {/* Evidence ID tag */}
                        <div style={{
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 8, color: "rgba(196,184,154,0.3)",
                            letterSpacing: "0.12em",
                        }}>
                            #{(item.id || "").toUpperCase().slice(0, 12)}
                        </div>
                    </div>
                    {/* Flashed / submitted badge */}
                    <AnimatePresence>
                        {(submitted || flashed) && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                style={{
                                    marginLeft: "auto",
                                    fontFamily: "'Special Elite', cursive",
                                    fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase",
                                    color: "#1abc9c",
                                    border: "1px solid rgba(26,188,156,0.4)",
                                    background: "rgba(26,188,156,0.08)",
                                    padding: "3px 8px", borderRadius: 2,
                                    transform: "rotate(-2deg)",
                                }}>
                                ✓ Filed
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Divider */}
                <div style={{
                    height: 1,
                    background: `linear-gradient(90deg, ${accent}22, rgba(255,255,255,0.05) 60%, transparent)`,
                    marginBottom: 12,
                }} />

                {/* Name */}
                <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 16, fontWeight: 900, fontStyle: "italic",
                    color: unlocked ? (flashed ? "#1abc9c" : "#e8dcc8") : "rgba(255,255,255,0.25)",
                    lineHeight: 1.2, marginBottom: 8,
                }}>
                    {item.display_name || item.name}
                </div>

                {/* Description */}
                <div style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: 11.5, lineHeight: 1.7, minHeight: 72,
                    color: unlocked ? "rgba(196,184,154,0.72)" : "rgba(255,255,255,0.18)",
                }}>
                    {item.description}
                </div>

                {/* Submit button */}
                {unlocked && (
                    <div style={{ marginTop: 16 }}>
                        <button
                            onClick={() => onSubmit(item.id)}
                            disabled={submitting}
                            style={{
                                fontFamily: "'Special Elite', cursive",
                                fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
                                color: submitting ? "rgba(26,188,156,0.45)" : "#1abc9c",
                                background: submitting ? "rgba(26,188,156,0.04)" : "rgba(26,188,156,0.08)",
                                border: `1px solid ${submitting ? "rgba(26,188,156,0.15)" : "rgba(26,188,156,0.32)"}`,
                                borderRadius: 2, padding: "8px 16px",
                                cursor: submitting ? "not-allowed" : "crosshair",
                                display: "inline-flex", alignItems: "center", gap: 8,
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "rgba(26,188,156,0.16)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = submitting ? "rgba(26,188,156,0.04)" : "rgba(26,188,156,0.08)"; }}
                        >
                            {submitting
                                ? <><SpinnerSVG /> Submitting...</>
                                : <>▶ Submit Evidence</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function SpinnerSVG() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "spin 0.8s linear infinite" }}>
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="rgba(26,188,156,0.3)" strokeWidth="1.5" />
            <path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6" fill="none" stroke="#1abc9c" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

// ── Scrolling tape banner ─────────────────────────────────────────────────────
function TapeBanner() {
    const [off, setOff] = useState(0);
    useEffect(() => {
        let raf, o = 0;
        const tick = () => { o = (o + 0.4) % 300; setOff(o); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);
    return (
        <div style={{ overflow: "hidden", height: 22, background: "#f5e642", flexShrink: 0 }}>
            <div style={{
                whiteSpace: "nowrap", height: "100%",
                display: "flex", alignItems: "center",
                fontFamily: "'Special Elite', cursive",
                fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: "#0a0a0a",
                boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.15)",
            }}>
                <span style={{ display: "inline-block", transform: `translateX(-${off}px)` }}>
                    {"EVIDENCE LOG • CASE #0001 • CLASSIFIED FILES • SUBMIT TO ADVANCE • ".repeat(16)}
                </span>
            </div>
        </div>
    );
}

// ── Phase badge ───────────────────────────────────────────────────────────────
function PhaseBadge({ phase }) {
    const colors = ["#3498db", "#f5c842", "#e67e22", "#e74c3c", "#9b59b6"];
    const c = colors[(phase - 1) % colors.length];
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: "'Courier Prime', monospace",
            fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase",
            color: c, border: `1px solid ${c}33`,
            background: `${c}0d`,
            padding: "6px 14px", borderRadius: 2,
        }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
            Phase {phase}
        </div>
    );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ total, unlocked }) {
    const pct = total > 0 ? (unlocked / total) * 100 : 0;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: 9, letterSpacing: "0.2em",
                color: "rgba(196,184,154,0.4)", textTransform: "uppercase",
            }}>
                {unlocked}/{total} Unlocked
            </div>
            <div style={{ width: 100, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #f5c84288, #f5c842)" }}
                />
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EvidenceBoard() {
    const { sessionId, unlockedEvidence, setUnlockedEvidence, phase, setPhase } = useSession();
    const { setProgressData } = useProgress();

    const [submittingId, setSubmittingId] = useState(null);
    const [submittedMap, setSubmittedMap] = useState({});
    const [flashMap, setFlashMap] = useState({});
    const [latestContradiction, setLatestContradiction] = useState(null);
    const [error, setError] = useState("");
    const [filterUnlocked, setFilterUnlocked] = useState(false);

    const seenRef = useRef(new Set());
    const unlockedSet = useMemo(() => new Set(unlockedEvidence), [unlockedEvidence]);

    const displayedItems = filterUnlocked
        ? evidenceItems.filter(i => unlockedSet.has(i.id))
        : evidenceItems;

    useEffect(() => {
        if (!sessionId) return;
        const fetchGameState = async () => {
            try {
                const r = await fetch(`${API_BASE}/game-state/${sessionId}`);
                if (!r.ok) throw new Error("Failed to load game state");
                const d = await r.json();
                setUnlockedEvidence(d.unlocked_evidence || []);
                setPhase(d.phase || 1);
                (d.found_contradictions || []).forEach(item => {
                    if (item?.contradiction_id) seenRef.current.add(item.contradiction_id);
                });
            } catch (err) {
                setError(err.message || "Could not load evidence state.");
            }
        };
        fetchGameState();
    }, [sessionId, setPhase, setUnlockedEvidence]);

    const handleSubmitEvidence = async (evidenceId) => {
        if (!sessionId) return;
        setSubmittingId(evidenceId);
        setError("");
        try {
            const r = await fetch(`${API_BASE}/submit-evidence`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ evidence_id: evidenceId, session_id: sessionId }),
            });
            if (!r.ok) throw new Error("Failed to submit evidence");
            const d = await r.json();
            setUnlockedEvidence(d.unlocked_evidence || []);
            setPhase(d.phase || 1);
            setSubmittedMap(p => ({ ...p, [evidenceId]: true }));
            setFlashMap(p => ({ ...p, [evidenceId]: true }));
            setTimeout(() => setSubmittedMap(p => ({ ...p, [evidenceId]: false })), 1800);
            setTimeout(() => setFlashMap(p => ({ ...p, [evidenceId]: false })), 900);
            let newest = null;
            (d.found_contradictions || []).forEach(item => {
                if (item?.contradiction_id && !seenRef.current.has(item.contradiction_id)) {
                    seenRef.current.add(item.contradiction_id);
                    newest = item;
                }
            });
            if (newest) setLatestContradiction(newest);
            if (d.progress?.show) setProgressData(d.progress);
        } catch (err) {
            setError(err.message || "Could not submit evidence.");
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Special+Elite&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
                * { cursor: crosshair !important; }
                @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
                @keyframes lamp-flicker { 0%,90%,100%{opacity:1;} 91%{opacity:0.5;} 93%{opacity:0.9;} 95%{opacity:0.4;} 97%{opacity:1;} }
                @keyframes bg-grain { 0%,100%{transform:translate(0,0);} 20%{transform:translate(-1px,1px);} 40%{transform:translate(1px,-1px);} 60%{transform:translate(-1px,-1px);} 80%{transform:translate(1px,1px);} }

                .eb-root {
                    min-height: 100vh;
                    background: linear-gradient(180deg, #0a0806 0%, #070605 100%);
                    margin-left: ${HUD_W}px;
                    font-family: 'Courier Prime', monospace;
                    color: #e8dcc8;
                    position: relative;
                }
                /* Film grain */
                .eb-root::before {
                    content: ''; position: fixed; inset: 0; z-index: 9998; pointer-events: none; opacity: 0.04;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
                    background-size: 180px;
                }
                /* Vignette */
                .eb-root::after {
                    content: ''; position: fixed; inset: 0; z-index: 9997; pointer-events: none;
                    background: radial-gradient(ellipse at 50% 20%, transparent 50%, rgba(0,0,0,0.65) 100%);
                }
                .eb-filter-btn {
                    font-family: 'Special Elite', cursive;
                    font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
                    padding: 6px 14px; border-radius: 2px; border: 1px solid transparent;
                    transition: all 0.18s; cursor: crosshair !important;
                }
                .eb-filter-active {
                    color: #f5c842;
                    background: rgba(245,200,66,0.1);
                    border-color: rgba(245,200,66,0.35);
                }
                .eb-filter-inactive {
                    color: rgba(196,184,154,0.4);
                    background: transparent;
                    border-color: rgba(255,255,255,0.08);
                }
                .eb-filter-inactive:hover {
                    color: rgba(196,184,154,0.7);
                    border-color: rgba(255,255,255,0.2);
                }
                .overlay-widgets {
                    position: fixed; top: 16px; right: 20px; z-index: 9000;
                    display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
                    pointer-events: none;
                }
                .overlay-widgets > * { pointer-events: auto; }
            `}</style>

            {/* Film grain overlay */}
            <div style={{
                position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none", opacity: 0.04,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundSize: "180px",
            }} />
            {/* Vignette */}
            <div style={{
                position: "fixed", inset: 0, zIndex: 9997, pointerEvents: "none",
                background: "radial-gradient(ellipse at 50% 20%, transparent 50%, rgba(0,0,0,0.65) 100%)",
            }} />

            <DetectiveHUD />

            <div className="eb-root">

                {/* ── LAMP ── */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 18, position: "relative", zIndex: 2 }}>
                    <div style={{ width: 2, height: 40, background: "linear-gradient(to bottom, rgba(245,200,66,0.22), rgba(245,200,66,0.05))" }} />
                    <div style={{ width: 120, height: 16, background: "linear-gradient(180deg,#2c1c06,#1a0e04)", borderRadius: "0 0 50% 50%", border: "1px solid rgba(245,200,66,0.2)", boxShadow: "0 4px 30px rgba(245,200,66,0.15)", animation: "lamp-flicker 9s ease-in-out infinite" }} />
                </div>

                {/* ── HEADER ── */}
                <div style={{
                    position: "relative", zIndex: 3,
                    background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 100%)",
                    borderBottom: "1px solid rgba(245,200,66,0.08)",
                    padding: "16px 32px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                    <div>
                        <div style={{
                            fontFamily: "'Special Elite', cursive",
                            fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase",
                            color: "rgba(245,200,66,0.45)", marginBottom: 6,
                        }}>
                            ◈ Hackathon P.D. — Case Files
                        </div>
                        <div style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: 30, fontWeight: 900, fontStyle: "italic",
                            color: "#f5c842", textShadow: "0 0 30px rgba(245,200,66,0.3)",
                            lineHeight: 1.05,
                        }}>
                            Evidence Board
                        </div>
                        <div style={{
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 11, color: "rgba(196,184,154,0.45)",
                            marginTop: 4, letterSpacing: "0.04em",
                        }}>
                            Review case files and submit evidence to advance the investigation.
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <StatsBar total={evidenceItems.length} unlocked={unlockedSet.size} />
                        {sessionId && <PhaseBadge phase={phase} />}
                    </div>
                </div>

                <TapeBanner />

                {/* ── BODY ── */}
                <div style={{ padding: "24px 32px 48px", position: "relative", zIndex: 2 }}>

                    {/* Filter bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
                        <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.2em", color: "rgba(196,184,154,0.3)", textTransform: "uppercase", marginRight: 4 }}>
                            Filter:
                        </span>
                        <button
                            className={`eb-filter-btn ${!filterUnlocked ? "eb-filter-active" : "eb-filter-inactive"}`}
                            onClick={() => setFilterUnlocked(false)}
                        >
                            All Files ({evidenceItems.length})
                        </button>
                        <button
                            className={`eb-filter-btn ${filterUnlocked ? "eb-filter-active" : "eb-filter-inactive"}`}
                            onClick={() => setFilterUnlocked(true)}
                        >
                            Unlocked ({unlockedSet.size})
                        </button>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                style={{
                                    marginBottom: 18,
                                    padding: "10px 16px",
                                    borderRadius: 3,
                                    border: "1px solid rgba(231,76,60,0.3)",
                                    background: "rgba(231,76,60,0.06)",
                                    fontFamily: "'Courier Prime', monospace",
                                    fontSize: 11.5, color: "rgba(231,76,60,0.85)",
                                }}
                            >
                                ⚠ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* No session */}
                    {!sessionId && (
                        <div style={{
                            padding: "40px 24px", textAlign: "center",
                            border: "1px solid rgba(245,200,66,0.1)",
                            background: "rgba(0,0,0,0.4)",
                            borderRadius: 3,
                            fontFamily: "'Courier Prime', monospace",
                            fontSize: 13, color: "rgba(196,184,154,0.45)",
                        }}>
                            No active session. Return to the opening scene to begin the investigation.
                        </div>
                    )}

                    {/* Grid */}
                    <motion.div
                        layout
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                            gap: 18,
                        }}
                    >
                        <AnimatePresence>
                            {displayedItems.map((item, i) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.04, type: "spring", stiffness: 260, damping: 24 }}
                                >
                                    <EvidenceCard
                                        item={item}
                                        unlocked={unlockedSet.has(item.id)}
                                        submitting={submittingId === item.id}
                                        submitted={!!submittedMap[item.id]}
                                        flashed={!!flashMap[item.id]}
                                        onSubmit={handleSubmitEvidence}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>

                    {/* Empty filter state */}
                    {filterUnlocked && unlockedSet.size === 0 && (
                        <div style={{
                            padding: "60px 24px", textAlign: "center",
                            fontFamily: "'Special Elite', cursive",
                            fontSize: 14, color: "rgba(196,184,154,0.3)",
                            letterSpacing: "0.06em",
                        }}>
                            No evidence unlocked yet. Interview suspects to uncover leads.
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay: hint + contradiction */}
            <div className="overlay-widgets">
                <HintButton />
                <HintCard />
                <ContradictionAlert
                    contradictionEvent={latestContradiction}
                    onDismiss={() => setLatestContradiction(null)}
                />
            </div>

            {/* Progress meter floats freely */}
            <ProgressMeter />
        </>
    );
}