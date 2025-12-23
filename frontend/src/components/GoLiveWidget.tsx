import { useState, useEffect, useMemo } from "react";
import { auth } from "../firebase";
import { useUserSettings } from "../hooks/useUserSettings";

interface Work {
    id: string;
    regional: string;
    go_live_date: string;
    description?: string;
}

export default function GoLiveWidget() {
    const { settings, loading: settingsLoading } = useUserSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [works, setWorks] = useState<Work[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);


    // Re-fetch settings on force update (actually hook handles auth change, but we need to ensure re-render on local storage change if hook didn't catch it?)
    // actually, custom hook only updates its OWN state on setSettings. 
    // If Settings page calls hook and updates, THIS instance of hook won't know unless we sync.
    // Let's modify the hook strategy or simply re-read from localStorage on event.
    // For simplicity, let's just make the hook listen to the event too, OR just read from local storage here on event.

    // Actually, simpler: The hook I wrote `useUserSettings` has a local state. 
    // If I use it in two places, they have separate states. 
    // I should update the HOOK to listen to the event to sync state across components.
    // But for now, let's just manually re-read or reload window? No, that's bad.
    // Quick fix: Update GoLiveWidget to manually check localStorage or simply reload the hook? 
    // No, the hook `useEffect` runs on mount.
    // Let's rely on the `windows.dispatchEvent` I added. 
    // I will modify the previous hook to listen to the event. 

    // Wait, I can't modify the previous file in THIS step easily without backtracking.
    // I already wrote the hook. 
    // Let's just implement the widget logic to READ the settings.
    // If state sync is an issue, I'll fix the hook next.

    // For now:

    const fetchWorks = async () => {
        setLoading(true);
        setError(false);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setWorks(data);
            } else {
                setError(true);
            }
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch on first open
        if (isOpen && works.length === 0) {
            fetchWorks();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const upcomingGoLives = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return works
            .filter(w => {
                if (!w.go_live_date) return false;
                const d = new Date(w.go_live_date);
                return !isNaN(d.getTime()) && d >= today;
            })
            .sort((a, b) => new Date(a.go_live_date).getTime() - new Date(b.go_live_date).getTime());
    }, [works]);

    if (settingsLoading || !settings.showGoLiveWidget) {
        return null; // Return null if specific conditions are met, BUT only after all hooks are declared if possible?
        // Actually, if I return here, I MUST ensure no hooks are called below.
        // Wait, render is the last thing.
        // But in the previous step I removed the early return that was BEFORE fetchWorks/useEffect/useMemo.
        // Now fetchWorks is defined. But useMemo/useEffect are still below.
        // I must allow them to run or use a condition inside.
        // Best approach: "always invalid" approach for hooks if hidden? No.
        // Just return null at the END.
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {/* Expanded List */}
            <div className={`
                pointer-events-auto
                bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl
                w-80 transition-all duration-300 origin-bottom-right overflow-hidden
                flex flex-col
                ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none h-0'}
            `}>
                <div className="p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-white/20">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Próximos Go-Lives
                    </h3>
                </div>

                <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {loading ? (
                        <div className="p-4 text-center text-xs text-gray-500 animate-pulse">Carregando...</div>
                    ) : error ? (
                        <div className="p-4 text-center text-xs text-red-500">Erro ao carregar dados.</div>
                    ) : upcomingGoLives.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">Nenhum Go-Live futuro encontrado.</div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingGoLives.map(work => (
                                <div key={work.id} className="p-3 bg-white/50 rounded-xl hover:bg-white/80 transition-colors border border-white/40 shadow-sm flex justify-between items-center group">
                                    <div>
                                        <div className="font-bold text-gray-800 text-xs">{work.id}</div>
                                        <div className="text-[10px] text-gray-500">{work.regional}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-blue-600 text-xs">
                                            {new Date(work.go_live_date).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    pointer-events-auto
                    w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300
                    hover:scale-110 active:scale-95 border border-white/20
                    ${isOpen ? 'bg-red-500 text-white rotate-90' : 'bg-gradient-to-tr from-blue-600 to-purple-600 text-white'}
                `}
                title={isOpen ? "Fechar" : "Próximos Go-Lives"}
            >
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                    <div className="relative">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping"></span>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-blue-600"></span>
                    </div>
                )}
            </button>
        </div>
    );
}
