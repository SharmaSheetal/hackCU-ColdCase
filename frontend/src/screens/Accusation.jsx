import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "../context/SessionContext";
import HintButton from "../components/HintButton";
import HintCard from "../components/HintCard";

const API_BASE = "http://127.0.0.1:8000";

const ENDING_OPTIONS = [
    {
        id: 1,
        title: "Victor is the killer.",
        subtitle: "He tampered with Julian's drink with intent to harm.",
        description:
            "This treats Victor as the sole murderer. It fits the visible sabotage, but it misses the larger chain of events.",
    },
    {
        id: 2,
        title: "It was an accidental chain reaction.",
        subtitle: "Multiple people's careless actions caused Julian's death.",
        description:
            "This recognizes that sabotage, stress, missing medical support, and panic combined into one fatal outcome.",
    },
    {
        id: 3,
        title: "Julian staged his own death.",
        subtitle: "Multiple petty acts of sabotage accidentally made the stunt real.",
        description:
            "This is the full theory: Julian planned the dramatic moment, and several independent acts turned it into a real death.",
    },
];

const CANONICAL_TRUTH = [
    "Julian Byte planned to fake a dramatic collapse during demo night.",
    "He wanted a theatrical reveal and wanted to become the center of attention.",
    'The note saying "THIS DEMO WILL KILL" was not a murder threat. It was Julian’s own dramatic note about the presentation.',
    "Victor swapped Julian's cold brew with an ultra-caffeinated sponsor drink.",
    "Rose replaced Julian's VIP kit, so his preferred meds and snacks were missing.",
    "Martha moved Julian's inhaler while filming a behind-the-scenes reel.",
    "Julian handled the novelty keyboard trophy and loosened a detachable keycap.",
    "During the fake collapse speech, he started coughing, panicked, inhaled sharply, and choked on the keycap.",
    "Caffeine overload and breathing distress made the situation worse.",
    "It was not a clean single-villain murder. It was a fake stunt that became a real death because multiple people made stupid, petty decisions.",
];

function EndingCard({ option, onChoose, loadingChoice, disabled }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-xl">
            <div className="mb-3 text-xs uppercase tracking-[0.25em] text-neutral-500">
                Ending {option.id}
            </div>

            <h2 className="text-2xl font-bold text-amber-300">{option.title}</h2>
            <p className="mt-2 text-sm font-medium text-neutral-200">{option.subtitle}</p>
            <p className="mt-4 text-sm leading-7 text-neutral-400">{option.description}</p>

            <button
                onClick={() => onChoose(option.id)}
                disabled={disabled}
                className="mt-6 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loadingChoice === option.id ? "Submitting..." : "Choose This Ending"}
            </button>
        </div>
    );
}

function RevealOverlay({ result, showTruth, onClose, onToggleTruth }) {
    return (
        <AnimatePresence>
            {result ? (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 py-8 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className="relative w-full max-w-4xl rounded-3xl border border-red-500/20 bg-[#0f0b0b] p-8 text-white shadow-2xl"
                        initial={{ scale: 0.96, y: 24 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.96, y: 24 }}
                        transition={{ type: "spring", stiffness: 180, damping: 22 }}
                    >
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 rounded-lg border border-white/10 px-3 py-1 text-sm text-neutral-300 hover:bg-white/5"
                        >
                            Close
                        </button>

                        <div className="mb-2 text-xs uppercase tracking-[0.25em] text-red-300/70">
                            Case Resolution
                        </div>

                        <h2 className="text-3xl font-bold text-red-200">Ending Reveal</h2>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                            <p className="whitespace-pre-wrap text-base leading-8 text-neutral-100">
                                {result.ending_text}
                            </p>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                                    Score
                                </div>
                                <div className="mt-2 text-2xl font-bold text-amber-300">
                                    {result.score}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                                    Hint Usage
                                </div>
                                <div className="mt-2 text-sm leading-7 text-neutral-200">
                                    {result.hints_used_note}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                onClick={onToggleTruth}
                                className="rounded-xl border border-lime-400/35 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-200 transition hover:bg-lime-400/20"
                            >
                                {showTruth ? "Hide Full Truth" : "Full Truth Reveal"}
                            </button>
                        </div>

                        <AnimatePresence>
                            {showTruth ? (
                                <motion.div
                                    className="mt-6 rounded-2xl border border-lime-400/20 bg-[#0c130d] p-5"
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 12 }}
                                >
                                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-lime-300/70">
                                        Canonical Truth
                                    </div>

                                    <div className="space-y-3 text-sm leading-7 text-neutral-200">
                                        {CANONICAL_TRUTH.map((line, index) => (
                                            <p key={index}>{line}</p>
                                        ))}
                                    </div>

                                    {result.full_truth_reveal ? (
                                        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                                            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
                                                Backend Full Truth Text
                                            </div>
                                            <p className="text-sm leading-7 text-neutral-300">
                                                {result.full_truth_reveal}
                                            </p>
                                        </div>
                                    ) : null}
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

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
            const response = await fetch(`${API_BASE}/accuse`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    ending_choice: endingChoice,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to submit accusation");
            }

            const data = await response.json();
            setResult(data);
            setShowTruth(false);
        } catch (err) {
            setError(err.message || "Could not submit accusation.");
        } finally {
            setLoadingChoice(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#090909] px-6 py-8 text-white font-mono">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <div className="text-xs uppercase tracking-[0.25em] text-red-300/70">
                        Final Decision
                    </div>
                    <h1 className="mt-2 text-4xl font-bold text-red-200">
                        Make Your Accusation, Detective.
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-400">
                        Choose the explanation you believe best fits the evidence, contradictions,
                        and the final pattern behind Julian Byte’s death.
                    </p>
                </div>

                {sessionMissing ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-5 text-sm text-red-200">
                        No session found. Start from the opening scene first.
                    </div>
                ) : null}

                {error ? (
                    <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-200">
                        {error}
                    </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-3">
                    {ENDING_OPTIONS.map((option) => (
                        <EndingCard
                            key={option.id}
                            option={option}
                            onChoose={handleChooseEnding}
                            loadingChoice={loadingChoice}
                            disabled={sessionMissing || !!loadingChoice}
                        />
                    ))}
                </div>
            </div>

            <RevealOverlay
                result={result}
                showTruth={showTruth}
                onClose={() => setResult(null)}
                onToggleTruth={() => setShowTruth((prev) => !prev)}
            />

            <HintButton />
            <HintCard />
        </div>
    );
}