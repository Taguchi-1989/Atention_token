'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchRuns, submitSus } from '@/lib/api';
import { CheckCircle, AlertOctagon, HelpCircle } from 'lucide-react';

const SUS_QUESTIONS = [
    "I think that I would like to use this system frequently.",
    "I found the system unnecessarily complex.",
    "I thought the system was easy to use.",
    "I think that I would need the support of a technical person to be able to use this system.",
    "I found the various functions in this system were well integrated.",
    "I thought there was too much inconsistency in this system.",
    "I would imagine that most people would learn to use this system very quickly.",
    "I found the system very cumbersome to use.",
    "I felt very confident using the system.",
    "I needed to learn a lot of things before I could get going with this system."
];

export default function SusPage() {
    const [history, setHistory] = useState<any[]>([]);
    const [selectedRun, setSelectedRun] = useState<any>(null);
    const [responses, setResponses] = useState<number[]>(new Array(10).fill(3)); // Default 3 (Neutral)
    const [submitting, setSubmitting] = useState(false);
    const [resultScore, setResultScore] = useState<number | null>(null);

    useEffect(() => {
        fetchRuns().then(setHistory).catch(console.error);
    }, []);

    const handleRunSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const run = history.find(h => h.id.toString() === e.target.value);
        setSelectedRun(run || null);
        setResultScore(null);
        // Reset responses if needed, or keep? Defaulting reset to neutral
        setResponses(new Array(10).fill(3));
    };

    const handleResponseChange = (index: number, value: number) => {
        const newResponses = [...responses];
        newResponses[index] = value;
        setResponses(newResponses);
    };

    const handleSubmit = async () => {
        if (!selectedRun) return;
        setSubmitting(true);
        try {
            const res = await submitSus(selectedRun.task_id, selectedRun.baseline_id, responses);
            setResultScore(res.sus_score);
            alert(`SUS Submitted! Score: ${res.sus_score}`);
        } catch (e) {
            console.error(e);
            alert("Failed to submit SUS score.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        System Usability Scale (SUS)
                    </h2>
                    <p className="text-text-muted mt-2">
                        Collect subjective usability feedback for specific agent execution runs.
                    </p>
                </header>

                <div className="glass-panel p-6 mb-8">
                    <h3 className="text-lg font-semibold mb-4 text-white">1. Select Execution Run</h3>
                    <select 
                        className="w-full bg-surface-highlight border border-white/10 rounded px-4 py-3 text-white focus:outline-none focus:border-primary"
                        onChange={handleRunSelect}
                        defaultValue=""
                    >
                        <option value="" disabled>-- Choose a recent task run --</option>
                        {history.map(run => (
                            <option key={run.id} value={run.id}>
                                {new Date(run.executed_at).toLocaleString()} - {run.task_id} ({run.success ? 'Success' : 'Failed'})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedRun && (
                    <div className="glass-panel p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-white">2. Survey Questions</h3>
                            {resultScore !== null && (
                                <div className="bg-primary/20 text-primary px-4 py-2 rounded-lg border border-primary/30 font-bold">
                                    Score: {resultScore} / 100
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {SUS_QUESTIONS.map((q, idx) => (
                                <div key={idx} className="pb-4 border-b border-white/5 last:border-0">
                                    <p className="mb-3 text-sm md:text-base">{idx + 1}. {q}</p>
                                    <div className="flex justify-between items-center gap-2 max-w-xl">
                                        <span className="text-xs text-text-muted">Strongly Disagree</span>
                                        <div className="flex gap-2 bg-surface-highlight/30 p-1 rounded-full">
                                            {[1, 2, 3, 4, 5].map(val => (
                                                <button
                                                    key={val}
                                                    onClick={() => handleResponseChange(idx, val)}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                                                        responses[idx] === val 
                                                        ? 'bg-primary text-background shadow-[0_0_10px_rgba(0,242,255,0.4)] scale-110' 
                                                        : 'hover:bg-white/10 text-text-muted'
                                                    }`}
                                                >
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                        <span className="text-xs text-text-muted">Strongly Agree</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button 
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="btn-primary px-8 py-3 flex items-center gap-2"
                            >
                                {submitting ? 'Submitting...' : 'Submit Evaluation'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
