import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHint } from "../context/HintContext";

export default function HintCard() {
    const { hintData, setHintData } = useHint();
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!hintData?.hint_text) return;

        timeoutRef.current = setTimeout(() => {
            setHintData(null);
        }, 8000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [hintData, setHintData]);

    const handleDismiss = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setHintData(null);
    };

    return (
        <AnimatePresence>
            {hintData?.hint_text ? (
                <motion.button
                    type="button"
                    onClick={handleDismiss}
                    initial={{ y: -200, opacity: 0 }}
                    animate={{ y: 20, opacity: 1 }}
                    exit={{ y: -200, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 20 }}
                    className="fixed left-1/2 top-0 z-50 w-[360px] -translate-x-1/2 cursor-pointer text-left"
                >
                    <div className="relative overflow-hidden rounded-b-2xl rounded-t-md border border-yellow-700/40 bg-[#f6df78] p-5 shadow-2xl">
                        <div className="absolute right-0 top-0 h-10 w-10 bg-[#edd062] [clip-path:polygon(0_0,100%_0,100%_100%)]" />
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-[linear-gradient(135deg,transparent_0_14px,rgba(0,0,0,0.08)_14px_16px,transparent_16px_32px)] bg-[length:32px_16px]" />

                        <div className="mb-2 text-[11px] font-mono uppercase tracking-[0.2em] text-[#7a5b00]">
                            Active Hint
                        </div>

                        <div
                            className="text-[28px] leading-8 text-[#3e2d00]"
                            style={{ fontFamily: '"Caveat", "Patrick Hand", cursive' }}
                        >
                            {hintData.hint_text}
                        </div>

                        <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.18em] text-[#7a5b00]/80">
                            Click to dismiss
                        </div>
                    </div>
                </motion.button>
            ) : null}
        </AnimatePresence>
    );
}