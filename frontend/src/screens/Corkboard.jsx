import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import ContradictionAlert from "../components/ContradictionAlert";
import ProgressMeter from "../components/ProgressMeter";
import { useProgress } from "../context/ProgressContext";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import { CHARACTER_DATA } from "../data/characters";

const API_BASE = "http://127.0.0.1:8000";

const CARD_SIZE = {
    width: 180,
    height: 140,
};

const CHARACTER_POSITIONS = {
    julian: { x: 430, y: 40, name: "Julian Byte", role: "Star Judge" },
    victor: { x: 170, y: 180, name: "Victor Vale", role: "Founder" },
    martha: { x: 690, y: 180, name: "Martha Keen", role: "Operations Lead" },
    rose: { x: 250, y: 420, name: "Rose Voss", role: "VIP Coordinator" },
    hayes: { x: 610, y: 420, name: "Detective Hayes", role: "Investigator" },
};

const RELATIONSHIPS = [
    { id: "victor-julian", from: "victor", to: "julian", label: "drink" },
    { id: "martha-julian", from: "martha", to: "julian", label: "inhaler" },
    { id: "rose-julian", from: "rose", to: "julian", label: "VIP kit" },
    { id: "victor-martha", from: "victor", to: "martha", label: "lounge" },
    { id: "hayes-julian", from: "hayes", to: "julian", label: "investigates" },
    { id: "hayes-victor", from: "hayes", to: "victor", label: "investigates" },
    { id: "hayes-martha", from: "hayes", to: "martha", label: "investigates" },
    { id: "hayes-rose", from: "hayes", to: "rose", label: "investigates" },
];

function getCardCenter(cardKey) {
    const card = CHARACTER_POSITIONS[cardKey];
    return {
        x: card.x + CARD_SIZE.width / 2,
        y: card.y + CARD_SIZE.height / 2,
    };
}

function CharacterCard({ id, name, role, x, y, onOpenInterview }) {
    const character = CHARACTER_DATA[id];
    return (
        <button
            onClick={() => onOpenInterview(id)}
            className="absolute rounded-xl border border-yellow-900/50 bg-[#f2e3b7] shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
            style={{
                left: x,
                top: y,
                width: CARD_SIZE.width,
                height: CARD_SIZE.height,
            }}
        >
            <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-[#2b1f12]">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#5a4330] bg-[#d6c08e] text-xl">

                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-black/20 bg-neutral-900 shadow-md">
                        <img
                            src={character.image}
                            alt={character.name}
                            className="h-full w-full object-cover"
                        />
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-sm font-bold uppercase tracking-wide">{name}</div>
                    <div className="text-xs text-[#5a4330]">{role}</div>
                </div>
            </div>
        </button>
    );
}



export default function Corkboard() {
    const navigate = useNavigate();
    const { sessionId } = useSession();
    const { setProgressData } = useProgress();

    const [activeContradictionIds, setActiveContradictionIds] = useState([]);
    const [latestContradiction, setLatestContradiction] = useState(null);
    const [gameState, setGameState] = useState({
        phase: 1,
        progress_score: 0,
        progress_label: "Cold Trail",
    });

    const seenContradictionsRef = useRef(new Set());
    const alertTimeoutRef = useRef(null);

    const relationshipsWithCoords = useMemo(() => {
        return RELATIONSHIPS.map((item) => {
            const from = getCardCenter(item.from);
            const to = getCardCenter(item.to);
            return {
                ...item,
                x1: from.x,
                y1: from.y,
                x2: to.x,
                y2: to.y,
            };
        });
    }, []);

    const progressLabel = useMemo(() => {
        const score = gameState.progress_score ?? 0;

        if (score < 10) return "Cold Trail";
        if (score < 20) return "Something's Off";
        if (score < 35) return "Threads Connecting";
        if (score < 50) return "Truth Closing In";
        return "Breakthrough";
    }, [gameState.progress_score]);

    useEffect(() => {
        if (!sessionId) return;

        const fetchGameState = async () => {
            try {
                const response = await fetch(`${API_BASE}/game-state/${sessionId}`);
                if (!response.ok) return;
                const data = await response.json();
                setGameState((prev) => ({
                    ...prev,
                    ...data,
                }));
            } catch {
            }
        };

        fetchGameState();
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) return;

        const fetchContradictions = async () => {
            try {
                const response = await fetch(`${API_BASE}/contradictions/${sessionId}`);

                if (!response.ok) return;

                const data = await response.json();
                const contradictions = Array.isArray(data) ? data : data.contradictions || [];

                let newContradiction = null;
                const nextActive = [];

                for (const item of contradictions) {
                    if (!seenContradictionsRef.current.has(item.contradiction_id)) {
                        seenContradictionsRef.current.add(item.contradiction_id);
                        newContradiction = item;
                    }

                    if (Array.isArray(item.characters) && item.characters.length >= 2) {
                        const [a, b] = item.characters;
                        nextActive.push(`${a}-${b}`, `${b}-${a}`);
                    }
                }

                if (newContradiction) {
                    setLatestContradiction(newContradiction);
                    setActiveContradictionIds(nextActive);

                    if (alertTimeoutRef.current) {
                        clearTimeout(alertTimeoutRef.current);
                    }

                    alertTimeoutRef.current = setTimeout(() => {
                        setActiveContradictionIds([]);
                    }, 3500);
                }
            } catch {
            }
        };

        fetchContradictions();
        const interval = setInterval(fetchContradictions, 3000);

        return () => {
            clearInterval(interval);
            if (alertTimeoutRef.current) {
                clearTimeout(alertTimeoutRef.current);
            }
        };
    }, [sessionId]);

    const openInterview = (characterId) => {
        navigate(`/interview/${characterId}`);
    };

    return (
        <div className="w-screen min-h-screen bg-[#2c1d12] text-white overflow-x-auto">
            <div
                className="relative min-h-screen overflow-hidden"
                style={{
                    backgroundColor: "#4b2e1f",
                    backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(255,255,255,0.04) 0 2px, transparent 2px),
            radial-gradient(circle at 75% 75%, rgba(0,0,0,0.08) 0 2px, transparent 2px),
            linear-gradient(0deg, rgba(0,0,0,0.07), rgba(255,255,255,0.02))
          `,
                    backgroundSize: "28px 28px, 32px 32px, 100% 100%",
                }}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />

                <div className="relative z-10 mx-auto h-screen w-[1100px] min-w-[1100px] px-6 py-6">
                    <div className="mb-4 flex items-start justify-between">
                        <div className="rounded-lg border border-yellow-700/30 bg-black/25 px-4 py-2 shadow-lg">
                            <div className="text-xs uppercase tracking-[0.2em] text-yellow-200/80">
                                Progress
                            </div>
                            <div className="text-lg font-semibold text-yellow-100">
                                {progressLabel}
                            </div>
                        </div>
                    </div>

                    <div className="relative mx-auto mt-2 h-[640px] w-full max-w-[1000px] rounded-2xl border border-black/20 bg-black/10 shadow-2xl">
                        <svg className="pointer-events-none absolute inset-0 h-full w-full">
                            {relationshipsWithCoords.map((line) => {
                                const isActive = activeContradictionIds.includes(line.id);

                                if (isActive) {
                                    return (
                                        <motion.line
                                            key={line.id}
                                            x1={line.x1}
                                            y1={line.y1}
                                            x2={line.x2}
                                            y2={line.y2}
                                            stroke="#ff3333"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            initial={{ opacity: 0.8 }}
                                            animate={{
                                                opacity: [0.55, 1, 0.55],
                                                strokeWidth: [4, 6, 4],
                                            }}
                                            transition={{
                                                duration: 0.9,
                                                repeat: Infinity,
                                                ease: "easeInOut",
                                            }}
                                        />
                                    );
                                }

                                return (
                                    <line
                                        key={line.id}
                                        x1={line.x1}
                                        y1={line.y1}
                                        x2={line.x2}
                                        y2={line.y2}
                                        stroke="#d7c4a1"
                                        strokeOpacity="0.65"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                        </svg>

                        {Object.entries(CHARACTER_POSITIONS).map(([id, item]) => (
                            <CharacterCard
                                key={id}
                                id={id}
                                name={item.name}
                                role={item.role}
                                x={item.x}
                                y={item.y}
                                onOpenInterview={openInterview}
                            />
                        ))}

                        {!sessionId ? (
                            <div className="absolute left-1/2 top-1/2 rounded-lg border border-red-500/30 bg-black/70 px-4 py-3 text-sm text-red-200 -translate-x-1/2 -translate-y-1/2">
                                No session found. Start from the opening scene first.
                            </div>
                        ) : null}

                        <ContradictionAlert
                            contradictionEvent={latestContradiction}
                            onDismiss={() => setLatestContradiction(null)}
                        />
                        <ProgressMeter hasContradictionAlert={!!latestContradiction} />
                        <HintButton />
                        <HintCard />
                    </div>

                    <div className="pointer-events-auto absolute bottom-8 right-8 z-20 flex gap-3">
                        {gameState.phase >= 4 ? (
                            <button
                                onClick={() => navigate("/accuse")}
                                className="rounded-xl border border-red-400/40 bg-red-900/70 px-5 py-3 text-sm font-bold uppercase tracking-[0.15em] text-red-100 shadow-xl transition hover:bg-red-800/80"
                            >
                                Make Accusation
                            </button>
                        ) : null}

                        <button
                            onClick={() =>
                                setLatestContradiction({
                                    contradiction_id: `demo-${Date.now()}`,
                                    characters: ["victor", "martha"],
                                    claim_a: "Victor said he never entered the lounge after 6 PM.",
                                    claim_b: "Martha said she saw Victor near the lounge after 6 PM.",
                                })
                            }
                            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
                        >
                            Trigger Demo Contradiction
                        </button>

                        <button
                            onClick={() =>
                                setProgressData({
                                    show: true,
                                    score: 15,
                                    label: "Something's Off",
                                    flavor_text: "You noticed a crack in their version of events.",
                                })
                            }
                            className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200"
                        >
                            Trigger Demo Progress
                        </button>

                        <div className="absolute left-6 bottom-8 z-20 flex gap-3">
                            <button
                                onClick={() => {
                                    ambientLoop.stop();
                                    ambientLoop.play();
                                }}
                                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
                            >
                                Test Ambient
                            </button>

                            <button
                                onClick={() => {
                                    typewriterClick.stop();
                                    typewriterClick.play();
                                }}
                                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
                            >
                                Test Typewriter
                            </button>

                            <button
                                onClick={() => {
                                    contradictionSpark.stop();
                                    contradictionSpark.play();
                                }}
                                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
                            >
                                Test Spark
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}