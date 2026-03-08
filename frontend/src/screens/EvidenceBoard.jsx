import { useEffect, useMemo, useRef, useState } from "react";
import evidenceData from "../../../data/evidence/evidence.json";
import { useSession } from "../context/SessionContext";
import { useProgress } from "../context/ProgressContext";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";
import ContradictionAlert from "../components/ContradictionAlert";

const API_BASE = "http://127.0.0.1:8000";

const evidenceItems = Array.isArray(evidenceData)
    ? evidenceData
    : evidenceData.evidence || [];

function Spinner() {
    return (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime-200/30 border-t-lime-200" />
    );
}

function EvidenceCard({
    item,
    unlocked,
    submitting,
    submitted,
    flashed,
    onSubmit,
}) {
    return (
        <div
            className={`relative rounded-2xl border p-5 shadow-xl transition ${flashed
                ? "border-lime-400/50 bg-lime-900/20"
                : unlocked
                    ? "border-amber-400/25 bg-[#181410] text-neutral-100"
                    : "border-white/10 bg-[#141414] text-neutral-400"
                }`}
        >
            {!unlocked ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/45 backdrop-blur-[1px]">
                    <div className="text-3xl">🔒</div>
                    <div className="mt-2 text-sm font-semibold uppercase tracking-[0.15em] text-neutral-200">
                        Locked
                    </div>
                </div>
            ) : null}

            <div className={unlocked ? "" : "grayscale opacity-60"}>
                <div className="mb-4 flex h-28 items-center justify-center rounded-xl border border-white/10 bg-neutral-900 text-5xl">
                    🧾
                </div>

                <h3 className="text-lg font-bold text-amber-300">
                    {item.display_name || item.name}
                </h3>

                <p className="mt-2 min-h-[88px] text-sm leading-6 text-neutral-300">
                    {item.description}
                </p>

                {unlocked ? (
                    <div className="mt-4">
                        <button
                            onClick={() => onSubmit(item.id)}
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-sm font-semibold text-lime-200 transition hover:bg-lime-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting ? <Spinner /> : null}
                            {submitting ? "Submitting..." : "Submit Evidence"}
                        </button>

                        {submitted ? (
                            <div className="mt-2 text-xs font-medium text-lime-300">
                                Evidence submitted
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function EvidenceBoard() {
    const {
        sessionId,
        unlockedEvidence,
        setUnlockedEvidence,
        phase,
        setPhase,
    } = useSession();
    const { setProgressData } = useProgress();

    const [submittingId, setSubmittingId] = useState(null);
    const [submittedMap, setSubmittedMap] = useState({});
    const [flashMap, setFlashMap] = useState({});
    const [latestContradiction, setLatestContradiction] = useState(null);
    const [error, setError] = useState("");

    const seenContradictionIdsRef = useRef(new Set());

    const unlockedSet = useMemo(
        () => new Set(unlockedEvidence),
        [unlockedEvidence]
    );

    useEffect(() => {
        if (!sessionId) return;

        const fetchGameState = async () => {
            try {
                const response = await fetch(`${API_BASE}/game-state/${sessionId}`);
                if (!response.ok) throw new Error("Failed to load game state");

                const data = await response.json();

                setUnlockedEvidence(data.unlocked_evidence || []);
                setPhase(data.phase || 1);

                const contradictions = data.found_contradictions || [];
                contradictions.forEach((item) => {
                    if (item?.contradiction_id) {
                        seenContradictionIdsRef.current.add(item.contradiction_id);
                    }
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
            const response = await fetch(`${API_BASE}/submit-evidence`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    evidence_id: evidenceId,
                    session_id: sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit evidence");
            }

            const data = await response.json();

            setUnlockedEvidence(data.unlocked_evidence || []);
            setPhase(data.phase || 1);

            setSubmittedMap((prev) => ({
                ...prev,
                [evidenceId]: true,
            }));

            setFlashMap((prev) => ({
                ...prev,
                [evidenceId]: true,
            }));

            setTimeout(() => {
                setSubmittedMap((prev) => ({
                    ...prev,
                    [evidenceId]: false,
                }));
            }, 1800);

            setTimeout(() => {
                setFlashMap((prev) => ({
                    ...prev,
                    [evidenceId]: false,
                }));
            }, 900);

            const contradictions = data.found_contradictions || [];
            let newestContradiction = null;

            contradictions.forEach((item) => {
                if (
                    item?.contradiction_id &&
                    !seenContradictionIdsRef.current.has(item.contradiction_id)
                ) {
                    seenContradictionIdsRef.current.add(item.contradiction_id);
                    newestContradiction = item;
                }
            });

            if (newestContradiction) {
                setLatestContradiction(newestContradiction);
            }

            if (data.progress?.show) {
                setProgressData(data.progress);
            }
        } catch (err) {
            setError(err.message || "Could not submit evidence.");
        } finally {
            setSubmittingId(null);
        }
    };

    if (!sessionId) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] p-8 text-white font-mono">
                <h1 className="text-3xl font-bold text-amber-300">Evidence Board</h1>
                <p className="mt-4 text-neutral-400">
                    No session found. Start from the opening scene first.
                </p>
                <HintButton />
                <HintCard />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d0d0d] px-6 py-8 text-white font-mono">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex items-end justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-lime-400/80">
                            Case Files
                        </p>
                        <h1 className="mt-2 text-4xl font-bold text-amber-300">
                            Evidence Board
                        </h1>
                        <p className="mt-2 text-sm text-neutral-400">
                            Review unlocked items and submit evidence to advance the case.
                        </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300">
                        Phase: <span className="font-semibold text-amber-200">{phase}</span>
                    </div>
                </div>

                {error ? (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {evidenceItems.map((item) => {
                        const unlocked = unlockedSet.has(item.id);

                        return (
                            <EvidenceCard
                                key={item.id}
                                item={item}
                                unlocked={unlocked}
                                submitting={submittingId === item.id}
                                submitted={!!submittedMap[item.id]}
                                flashed={!!flashMap[item.id]}
                                onSubmit={handleSubmitEvidence}
                            />
                        );
                    })}
                </div>
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