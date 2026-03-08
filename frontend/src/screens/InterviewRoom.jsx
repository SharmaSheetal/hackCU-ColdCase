import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";

import { useSession } from "../context/SessionContext";
import { useProgress } from "../context/ProgressContext";
import { typewriterClick } from "../audio/sounds";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import ContradictionAlert from "../components/ContradictionAlert";
import { CHARACTER_DATA } from "../data/characters";

const API_BASE = "http://127.0.0.1:8000";

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

function stressBarColor(stress) {
    if (stress < 0.33) return "#65a30d";
    if (stress < 0.66) return "#f59e0b";
    return "#ef4444";
}

function buildNodes(facts) {
    return facts.map((fact) => ({
        id: fact.id,
        position: { x: fact.x, y: fact.y },
        data: { label: fact.label },
        style: {
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "12px",
            padding: "10px 14px",
            background: "#1a1a1a",
            color: "#f5f5f5",
            width: 150,
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        },
    }));
}

function buildEdges(facts) {
    const edges = [];
    for (let i = 0; i < facts.length - 1; i++) {
        edges.push({
            id: `edge-${facts[i].id}-${facts[i + 1].id}`,
            source: facts[i].id,
            target: facts[i + 1].id,
            animated: false,
            style: { stroke: "rgba(245, 158, 11, 0.35)", strokeWidth: 2 },
        });
    }
    return edges;
}

function highlightNodeStyle() {
    return {
        border: "1px solid rgba(255, 80, 80, 0.75)",
        borderRadius: "12px",
        padding: "10px 14px",
        background: "#2b1111",
        color: "#fff5f5",
        width: 150,
        fontSize: 12,
        boxShadow: "0 0 0 2px rgba(255, 51, 51, 0.25), 0 0 24px rgba(255, 51, 51, 0.45)",
    };
}

function normalNodeStyle() {
    return {
        border: "1px solid rgba(245, 158, 11, 0.35)",
        borderRadius: "12px",
        padding: "10px 14px",
        background: "#1a1a1a",
        color: "#f5f5f5",
        width: 150,
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    };
}

export default function InterviewRoom() {
    const { characterId } = useParams();
    const { sessionId } = useSession();
    const { setProgressData } = useProgress();

    const meta = CHARACTER_DATA[characterId] || {
        name: characterId || "Unknown",
        role: "Unknown Role",
        image: null,
        border: "border-white/20",
    };

    const [stressLevel, setStressLevel] = useState(0.12);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [activeFactIds, setActiveFactIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [latestContradiction, setLatestContradiction] = useState(null);

    const historyRef = useRef(null);
    const typingIntervalRef = useRef(null);
    const highlightTimeoutRef = useRef(null);

    const stressPercent = useMemo(
        () => `${Math.max(0, Math.min(1, stressLevel)) * 100}%`,
        [stressLevel]
    );

    useEffect(() => {
        const fetchFacts = async () => {
            try {
                const response = await fetch(`${API_BASE}/facts/${characterId}`);
                if (!response.ok) throw new Error("facts endpoint unavailable");
                const data = await response.json();
                const facts = Array.isArray(data) ? data : data.facts || [];
                const safeFacts = facts.length ? facts : (FALLBACK_FACTS[characterId] || []);
                setNodes(buildNodes(safeFacts));
                setEdges(buildEdges(safeFacts));
            } catch {
                const fallback = FALLBACK_FACTS[characterId] || [];
                setNodes(buildNodes(fallback));
                setEdges(buildEdges(fallback));
            }
        };

        fetchFacts();

        return () => {
            if (typingIntervalRef.current) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
            }

            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }

            try {
                typewriterClick.stop();
            } catch {
            }
        };
    }, [characterId]);

    useEffect(() => {
        if (!activeFactIds.length) return;

        setNodes((prev) =>
            prev.map((node) =>
                activeFactIds.includes(node.id)
                    ? { ...node, style: highlightNodeStyle() }
                    : node
            )
        );

        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
        }

        highlightTimeoutRef.current = setTimeout(() => {
            setNodes((prev) =>
                prev.map((node) =>
                    activeFactIds.includes(node.id)
                        ? { ...node, style: normalNodeStyle() }
                        : node
                )
            );
            setActiveFactIds([]);
        }, 3000);
    }, [activeFactIds]);

    useEffect(() => {
        if (!historyRef.current) return;
        historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }, [messages]);

    const runTypewriter = (fullText, hintInjected) => {
        if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
        }

        try {
            typewriterClick.stop();
        } catch {
        }


        const responseId = `resp-${Date.now()}`;
        let index = 0;

        setMessages((prev) => [
            ...prev,
            {
                id: responseId,
                sender: "character",
                text: "",
                fullText,
                hintInjected,
                typing: true,
            },
        ]);

        typingIntervalRef.current = setInterval(() => {
            index += 1;

            if (index % 4 === 0) {
                try {
                    typewriterClick.stop();
                    typewriterClick.play();
                } catch {
                }
            }

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === responseId
                        ? {
                            ...msg,
                            text: fullText.slice(0, index),
                        }
                        : msg
                )
            );

            if (index >= fullText.length) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;

                try {
                    typewriterClick.stop();
                } catch {
                }

                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === responseId
                            ? {
                                ...msg,
                                text: fullText,
                                typing: false,
                            }
                            : msg
                    )
                );
            }
        }, 38);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || !sessionId || loading) return;

        setMessages((prev) => [
            ...prev,
            {
                id: `player-${Date.now()}`,
                sender: "player",
                text: trimmed,
            },
        ]);

        setInput("");
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/interview`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    character_id: characterId,
                    player_message: trimmed,
                    session_id: sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error("Interview request failed");
            }

            const data = await response.json();

            setLoading(false);
            setStressLevel(data.stress_level ?? 0);
            setActiveFactIds(data.active_fact_ids || []);
            runTypewriter(data.response_text || "", !!data.hint_injected);

            if (data.contradiction_event) {
                setLatestContradiction(data.contradiction_event);
            }

            if (data.progress?.show) {
                setProgressData(data.progress);
            }
        } catch {
            setLoading(false);
            runTypewriter(
                "The character pauses, but the room gives you nothing useful back yet.",
                false
            );
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-white">
            <div className="mx-auto flex min-h-screen max-w-[1440px]">
                <section className="w-[60%] border-r border-white/10 bg-[#111111] px-6 py-6">
                    <div className="mb-6 flex items-center gap-4">
                        <motion.div
                            animate={
                                loading
                                    ? { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }
                                    : { scale: 1, opacity: 1 }
                            }
                            transition={
                                loading
                                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                                    : { duration: 0.2 }
                            }
                            className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border ${meta.border} bg-neutral-900 shadow-lg`}
                        >
                            {meta.image ? (
                                <img
                                    src={meta.image}
                                    alt={meta.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-xl text-neutral-200">?</span>
                            )}
                        </motion.div>

                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-lime-400/80">
                                Interview Room
                            </p>
                            <h1 className="mt-2 text-3xl font-bold text-amber-300">
                                {meta.name}
                            </h1>
                            <p className="mt-1 text-sm text-neutral-400">{meta.role}</p>
                            {loading ? (
                                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-amber-200/70">
                                    Thinking...
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
                            Stress Indicator
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: stressPercent,
                                    backgroundColor: stressBarColor(stressLevel),
                                }}
                            />
                        </div>
                    </div>

                    <div
                        ref={historyRef}
                        className="mb-5 h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                        {messages.length === 0 ? (
                            <p className="text-sm text-neutral-500">
                                Start questioning {meta.name}.
                            </p>
                        ) : null}

                        <div className="space-y-4">
                            {messages.map((msg) => {
                                const isPlayer = msg.sender === "player";

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg ${isPlayer
                                                ? "border border-lime-500/25 bg-lime-700/25 text-lime-100"
                                                : "border border-amber-400/20 bg-neutral-900 text-neutral-100"
                                                }`}
                                        >
                                            {msg.hintInjected ? (
                                                <div className="whitespace-pre-wrap">
                                                    <span className="italic text-amber-200/85">
                                                        {msg.text}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="whitespace-pre-wrap">{msg.text}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about the timeline, the lounge, the evidence..."
                            className="flex-1 rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-amber-400/40"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!sessionId || loading}
                            className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Thinking..." : "Send"}
                        </button>
                    </div>
                </section>

                <aside className="w-[40%] bg-[#0a0a0a] px-4 py-4">
                    <div className="mb-3">
                        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                            Fact Graph
                        </p>
                    </div>

                    <div className="h-[88vh] overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            fitView
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable={false}
                            panOnDrag
                            zoomOnScroll
                        >
                            <MiniMap />
                            <Controls />
                            <Background gap={18} size={1} />
                        </ReactFlow>
                    </div>
                </aside>
            </div>

            <HintButton />
            <HintCard />
            <ContradictionAlert
                contradictionEvent={latestContradiction}
                onDismiss={() => setLatestContradiction(null)}
            />
        </div>
    );
}