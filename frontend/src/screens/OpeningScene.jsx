import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";

const API_BASE = "http://127.0.0.1:8000";

export default function OpeningScene() {
    const navigate = useNavigate();
    const { setSessionId } = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleBeginInvestigation = async () => {
        setLoading(true);
        setError("");

        try {
            // Backend currently supports POST /session/start for fresh session creation.
            const response = await fetch(`${API_BASE}/session/start`, {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Failed to initialize session");
            }

            const data = await response.json();

            if (!data.session_id) {
                throw new Error("No session_id returned from backend");
            }

            setSessionId(data.session_id);
            navigate("/board");
        } catch (err) {
            setError(err.message || "Something went wrong while starting the case.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-neutral-100 font-mono">
            <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.08),transparent_35%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.08),transparent_30%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="pointer-events-none absolute inset-0 bg-black/45" />

            <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-10">
                <div className="mb-6">
                    <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                        Judges&apos; Lounge
                    </p>
                    <h1 className="mt-2 text-4xl font-bold tracking-tight text-amber-300 md:text-5xl">
                        2:07 AM
                    </h1>
                    <p className="mt-2 text-sm text-neutral-400">
                        Demo night. The room is still. The story is not.
                    </p>
                </div>

                <section className="relative mb-8 overflow-hidden rounded-2xl border border-amber-500/20 bg-neutral-900/80 shadow-2xl">
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:14px_14px]" />

                    <div className="absolute left-0 right-0 top-0 h-10 bg-yellow-300/90 text-black flex items-center justify-center text-xs font-bold tracking-[0.25em] rotate-[-2deg] origin-top">
                        POLICE TAPE • DO NOT CROSS • POLICE TAPE • DO NOT CROSS
                    </div>

                    <div className="relative grid min-h-[420px] grid-cols-1 gap-6 p-6 pt-16 md:grid-cols-12">
                        <div className="md:col-span-7 relative rounded-xl border border-white/10 bg-black/30 p-6">
                            <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />

                            <div className="relative flex h-full items-end justify-around gap-4">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="relative h-24 w-20 rounded-b-2xl rounded-t-md border border-amber-200/30 bg-gradient-to-b from-amber-200/20 to-stone-900">
                                        <div className="absolute -right-4 top-6 h-8 w-8 rounded-full border-4 border-amber-100/30" />
                                        <div className="absolute left-2 right-2 top-3 h-5 rounded bg-neutral-950/60" />
                                    </div>
                                    <p className="text-center text-xs text-amber-200">
                                        Cold Brew (??)
                                    </p>
                                </div>

                                <div className="flex flex-col items-center gap-2">
                                    <div className="relative flex h-28 w-24 items-center justify-center rounded-t-xl border border-lime-300/20 bg-gradient-to-b from-yellow-700/40 to-amber-900/40">
                                        <div className="absolute top-2 text-2xl">🏆</div>
                                        <div className="absolute bottom-0 h-8 w-full rounded-b-xl bg-amber-950/80" />
                                    </div>
                                    <p className="max-w-[110px] text-center text-xs text-lime-300">
                                        Most Disruptive Hack
                                    </p>
                                </div>

                                <div className="rotate-[-7deg] flex flex-col items-center gap-2">
                                    <div className="flex h-28 w-28 items-center justify-center border border-yellow-200/20 bg-yellow-200/85 p-3 text-center text-sm font-bold text-black shadow-lg">
                                        THIS DEMO
                                        <br />
                                        WILL KILL
                                    </div>
                                    <p className="text-xs text-yellow-200">Sticky note</p>
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-5 flex flex-col justify-center rounded-xl border border-lime-400/15 bg-neutral-950/70 p-6">
                            <h2 className="text-lg font-semibold text-amber-300">
                                The Case of the Dead Demo Judge
                            </h2>

                            <div className="mt-4 space-y-4 text-sm leading-7 text-neutral-300">
                                <p>
                                    At <span className="text-amber-300 font-semibold">2:07 AM</span>,
                                    during demo night, the star judge{" "}
                                    <span className="text-lime-300 font-semibold">
                                        Professor Julian Byte
                                    </span>{" "}
                                    is found collapsed in the judges&apos; lounge beside a
                                    half-finished cold brew, a trophy labeled{" "}
                                    <span className="text-amber-300 font-semibold">
                                        &quot;Most Disruptive Hack&quot;
                                    </span>
                                    , and a sticky note that says{" "}
                                    <span className="text-yellow-200 font-semibold">
                                        &quot;THIS DEMO WILL KILL.&quot;
                                    </span>
                                </p>

                                <p>
                                    At first, everyone assumes it is murder.
                                </p>

                                <p>
                                    The player must interrogate multiple AI-driven characters,
                                    compare contradictions in their stories, inspect evidence, and
                                    determine what really happened.
                                </p>
                            </div>

                            <div className="mt-8 flex flex-col gap-3">
                                <button
                                    onClick={handleBeginInvestigation}
                                    disabled={loading}
                                    className="rounded-lg border border-lime-400/40 bg-lime-400/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-lime-300 transition hover:bg-lime-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Initializing Case..." : "Begin Investigation"}
                                </button>

                                {error ? (
                                    <p className="text-sm text-red-400">{error}</p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}