import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "../context/ProgressContext";

function getScoreColor(score, label = "") {
    const normalizedLabel = label.toLowerCase();

    if (normalizedLabel.includes("cold")) {
        return {
            text: "#60a5fa",
            bar: "#3b82f6",
            border: "rgba(96, 165, 250, 0.35)",
            bg: "#0b1220",
        };
    }

    if (score >= 50 || normalizedLabel.includes("breakthrough") || normalizedLabel.includes("truth")) {
        return {
            text: "#f87171",
            bar: "#ef4444",
            border: "rgba(248, 113, 113, 0.35)",
            bg: "#1a0d0d",
        };
    }

    return {
        text: "#fbbf24",
        bar: "#f59e0b",
        border: "rgba(251, 191, 36, 0.35)",
        bg: "#1a1408",
    };
}

export default function ProgressMeter({ hasContradictionAlert = false }) {
    const { progressData, setProgressData } = useProgress();
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!progressData) return;

        timeoutRef.current = setTimeout(() => {
            setProgressData(null);
        }, 5000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [progressData, setProgressData]);

    const handleDismiss = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setProgressData(null);
    };

    const safeScore = Math.max(0, Math.min(progressData?.score ?? 0, 100));
    const label = progressData?.label || "Cold Trail";
    const flavorText = progressData?.flavor_text || "";
    const colors = getScoreColor(safeScore, label);

    return (
        <AnimatePresence>
            {progressData ? (
                <motion.button
                    type="button"
                    onClick={handleDismiss}
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 240, damping: 24 }}
                    className="fixed right-6 z-40 w-[360px] rounded-2xl p-4 text-left shadow-2xl backdrop-blur-sm"
                    style={{
                        bottom: hasContradictionAlert ? "140px" : "24px",
                        backgroundColor: colors.bg,
                        border: `1px solid ${colors.border}`,
                    }}
                >
                    <div
                        className="text-2xl font-bold tracking-wide"
                        style={{ color: colors.text }}
                    >
                        {label}
                    </div>

                    <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-black/30">
                        <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${safeScore}%` }}
                            transition={{ duration: 1, ease: "easeInOut" }}
                            style={{ backgroundColor: colors.bar }}
                        />
                    </div>

                    <div className="mt-3 text-xs font-mono italic leading-6 text-neutral-300">
                        {flavorText}
                    </div>

                    <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                        Click to dismiss
                    </div>
                </motion.button>
            ) : null}
        </AnimatePresence>
    );
}