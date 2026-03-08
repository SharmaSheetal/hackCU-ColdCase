import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { contradictionSpark } from "../audio/sounds";

export default function ContradictionAlert({ contradictionEvent, onDismiss }) {
    const timeoutRef = useRef(null);
    const lastShownIdRef = useRef(null);

    useEffect(() => {
        if (!contradictionEvent) return;

        if (lastShownIdRef.current !== contradictionEvent.contradiction_id) {
            lastShownIdRef.current = contradictionEvent.contradiction_id;
            try {
                contradictionSpark.stop();
                contradictionSpark.play();
            } catch {
            }
        }

        timeoutRef.current = setTimeout(() => {
            onDismiss?.();
        }, 6000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [contradictionEvent, onDismiss]);

    const handleDismiss = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        onDismiss?.();
    };

    return (
        <AnimatePresence>
            {contradictionEvent ? (
                <motion.button
                    type="button"
                    onClick={handleDismiss}
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    className="fixed bottom-6 right-6 z-50 w-[420px] rounded-2xl border border-red-500/35 bg-[#140b0b]/95 p-4 text-left text-white shadow-2xl backdrop-blur-sm"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-xl text-red-300">
                            ⚡
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-red-300/80">
                                Contradiction Detected
                            </div>
                            <div className="mt-1 text-sm font-semibold text-red-100">
                                {(contradictionEvent.characters || []).join(" vs ")}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-red-400/20 bg-black/20 p-3">
                            <div className="mb-2 text-xs uppercase tracking-wide text-red-200/70">
                                Claim A
                            </div>
                            <div className="text-sm leading-6 text-red-50">
                                {contradictionEvent.claim_a}
                            </div>
                        </div>

                        <div className="rounded-xl border border-red-400/20 bg-black/20 p-3">
                            <div className="mb-2 text-xs uppercase tracking-wide text-red-200/70">
                                Claim B
                            </div>
                            <div className="text-sm leading-6 text-red-50">
                                {contradictionEvent.claim_b}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-red-200/65">
                        Click to dismiss
                    </div>
                </motion.button>
            ) : null}
        </AnimatePresence>
    );
}