import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { getAuthToken } from "../firebase";
import {
    type EngineeringWork,
    type EngineeringManagement,
    type EngineeringOwnerWork,
    type EngineeringLicense,
    type EngineeringThermometer,
    type EngineeringScheduleItem,
    type EngineeringComplementaryInfo,
    type EngineeringDailyLog,
    type EngineeringGeneralDocs,
    type EngineeringCapex,
    type EngineeringHighlights,
    type EngineeringOccurrence
} from "../types/Engineering";
import type { Oc, OcEvent } from "../types/ControlTower";

export default function Engineering() {
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState("");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);

    // Data State
    const [works, setWorks] = useState<EngineeringWork[]>([]);
    const [managements, setManagements] = useState<EngineeringManagement[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [occurrences, setOccurrences] = useState<EngineeringOccurrence[]>([]);

    // Control Tower Data
    const [ocs, setOcs] = useState<Oc[]>([]);
    const [ocEvents, setOcEvents] = useState<OcEvent[]>([]);

    // Management Form State
    const [selectedWorkId, setSelectedWorkId] = useState("");

    // Derived state for selected work
    const selectedWork = useMemo(() =>
        works.find(item => item.id === selectedWorkId) || null
        , [works, selectedWorkId]);

    // Initializers
    const initOwnerWorks = (): EngineeringOwnerWork[] => [
        { name: "Assinatura de contrato", date: "", status: "⚪️" },
        { name: "Leitura de contrato", date: "", status: "⚪️" },
        { name: "Recebimento chaves", date: "", status: "⚪️" },
        { name: "Entrada antecipada", date: "", status: "⚪️" },
        { name: "Liberação de entrada", date: "", status: "⚪️" }
    ];

    const initLicenses = (): EngineeringLicense[] => [
        { name: "AVCB", date: "", status: "⚪️" },
        { name: "Habite-se", date: "", status: "⚪️" },
        { name: "Matrícula", date: "", status: "⚪️" },
        { name: "IPTU", date: "", status: "⚪️" },
        { name: "Notificação", date: "", status: "⚪️" }
    ];

    const initThermometer = (): EngineeringThermometer[] => [
        { name: "Segurança", status: "⚪️" },
        { name: "Qualidade", status: "⚪️" },
        { name: "Cronograma", status: "⚪️" },
        { name: "Orçamento", status: "⚪️" }
    ];

    const initMacroSchedule = (): EngineeringScheduleItem[] => [
        { name: "Mobilização", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Obra Serralheria", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Inst. elétricas", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Equipamentos", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Go Live", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Check List", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Reunião final", start_planned: "", start_real: "", end_planned: "", end_real: "" }
    ];

    const initSupplySchedule = (): EngineeringScheduleItem[] => [
        { name: "Niveladoras", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Quadros elétricos", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Ventiladores", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Bate rodas", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Semáforos", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Dock Lights", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Guarda Corpo", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Demarcação de piso", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Comunicação visual", start_planned: "", start_real: "", end_planned: "", end_real: "" }
    ];

    const initComplementaryInfo = (): EngineeringComplementaryInfo[] => [
        { name: "Documentações", date: "", status: "⚪️" },
        { name: "Integração", date: "", status: "⚪️" },
        { name: "Data Kick OFF", date: "", status: "⚪️" },
        { name: "ART", date: "", status: "⚪️" },
        { name: "Seguro", date: "", status: "⚪️" },
        { name: "Projeto Elétrico", date: "", status: "⚪️" },
        { name: "Pacote Layout", date: "", status: "⚪️" },
        { name: "Fotos Site", date: "", status: "⚪️" },
        { name: "As built", date: "", status: "⚪️" }
    ];

    const initGeneralDocs = (): EngineeringGeneralDocs => ({
        layout: "", construtora: "", contato: "", periodo_obra: "", data_inicio: "", data_termino: "", dias_pendentes: ""
    });

    const initCapex = (): EngineeringCapex => ({
        planned: "", approved: "", contracted: ""
    });

    const initDailyLog = (): EngineeringDailyLog[] => [
        { day: "Segunda-feira" }, { day: "Terça-feira" }, { day: "Quarta-feira" }, { day: "Quinta-feira" },
        { day: "Sexta-feira" }, { day: "Sábado" }, { day: "Domingo" }
    ];

    const initHighlights = (): EngineeringHighlights => ({
        special_attention: "", action_plans: "", relevant_activities: "", observations: ""
    });

    // Management Data Structure - Simplified for Modal
    const [operator, setOperator] = useState("");
    const [engineer, setEngineer] = useState("");
    const [coordinator, setCoordinator] = useState("");
    const [controlTower, setControlTower] = useState("");

    // Expanded Card State
    const [cardTab, setCardTab] = useState("overview");

    // Occurrences State
    const [occurrenceForm, setOccurrenceForm] = useState<EngineeringOccurrence>({
        id: '', work_id: '', date: '', description: '', type: 'Atividade', status: 'Active'
    });


    // Filter State
    const [searchText, setSearchText] = useState("");
    const [filterRegional, setFilterRegional] = useState("");

    // Pagination & Filter State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchText);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchText]);

    const isLoadingRef = useRef(false);

    const fetchWorks = useCallback(async (pageToFetch: number, reset: boolean, searchVal: string, regionalVal: string) => {
        if (isLoadingRef.current) return; // Prevent double fetch
        isLoadingRef.current = true;
        setIsLoading(true);
        try {
            const token = await getAuthToken();
            const limit = 20;
            const offset = pageToFetch * limit;

            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString()
            });

            if (searchVal) params.append("search", searchVal);
            if (regionalVal) params.append("regional", regionalVal);

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (reset) {
                    setWorks(data);
                } else {
                    setWorks(prev => [...prev, ...data]);
                }

                setHasMore(data.length === limit);
                setPage(pageToFetch);
            }
        } catch (error) {
            console.error("Error fetching works:", error);
            setToast({ message: "Erro ao carregar obras.", type: "error" });
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    }, []); // No deps needed now

    const fetchManagements = useCallback(async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const processed = data.map((m: EngineeringManagement) => ({
                    ...m,
                    macro_schedule: (m.macro_schedule && m.macro_schedule.length > 0) ? m.macro_schedule : initMacroSchedule(),
                    supply_schedule: (m.supply_schedule && m.supply_schedule.length > 0) ? m.supply_schedule : initSupplySchedule(),
                    complementary_info: (m.complementary_info && m.complementary_info.length > 0) ? m.complementary_info : initComplementaryInfo(),
                    general_docs: m.general_docs || initGeneralDocs(),
                    capex: m.capex || initCapex(),
                    daily_log: (m.daily_log && m.daily_log.length > 0) ? m.daily_log : initDailyLog(),
                    highlights: m.highlights || initHighlights()
                }));
                setManagements(processed);
            }
        } catch (error) {
            console.error("Error fetching managements:", error);
        }
    }, []);

    const fetchOccurrences = useCallback(async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/occurrences`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setOccurrences(await response.json());
            }
        } catch (error) {
            console.error("Error fetching occurrences:", error);
        }
    }, []);

    const fetchControlTowerData = useCallback(async () => {
        try {
            const token = await getAuthToken();
            const [ocsRes, eventsRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/ocs`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/oc-events`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (ocsRes.ok) setOcs(await ocsRes.json());
            if (eventsRes.ok) setOcEvents(await eventsRes.json());
        } catch (error) {
            console.error("Error fetching control tower data:", error);
        }
    }, []);

    // Initial Fetch & Filter Change
    useEffect(() => {
        fetchWorks(0, true, debouncedSearch, filterRegional);
        fetchManagements();
        fetchOccurrences();
        fetchControlTowerData();
    }, [debouncedSearch, filterRegional, fetchWorks, fetchManagements, fetchOccurrences, fetchControlTowerData]);

    // Form Population Effect (Replaces fetchManagementData)
    useEffect(() => {
        if (selectedWorkId && managements.length > 0) {
            const m = managements.find(mg => mg.work_id === selectedWorkId);
            if (m) {
                setOperator(m.operator || "");
                setEngineer(m.engineer || "");
                setCoordinator(m.coordinator || "");
                setControlTower(m.control_tower || "");
            } else {
                // Reset if no management exists (new)
                setOperator("");
                setEngineer("");
                setCoordinator("");
                setControlTower("");
            }
        }
    }, [selectedWorkId, managements]);

    const getDateColor = (planned: string, real?: string) => {
        if (!planned) return "text-gray-400";
        if (real) {
            return real > planned ? "text-red-600 font-bold" : "text-green-600";
        }
        const today = new Date().toISOString().split('T')[0];
        return planned < today ? "text-red-600 font-bold" : "text-gray-600";
    };

    const handleInlineUpdate = (workId: string, section: keyof EngineeringManagement, indexOrField: number | string, subField: string | null, value: string) => {
        setManagements(prev => prev.map(m => {
            if (m.work_id !== workId) return m;
            const updated = { ...m };

            // Handle Array Updates (Schedule, Log)
            if ((section === 'macro_schedule' || section === 'supply_schedule' || section === 'daily_log') && Array.isArray(updated[section]) && typeof indexOrField === 'number') {
                const list = [...(updated[section] as unknown as unknown[])];
                if (list[indexOrField] && typeof list[indexOrField] === 'object') {
                    // Assert list item as Record to update key
                    const item = { ...(list[indexOrField] as Record<string, unknown>) };
                    if (subField) item[subField] = value;
                    list[indexOrField] = item;
                    (updated as unknown as Record<string, unknown>)[section] = list;
                }
            }
            // Handle Object Updates (Docs, Highlights)
            else if (typeof updated[section] === 'object' && updated[section] !== null) {
                const key = typeof indexOrField === 'string' ? indexOrField : subField;
                if (key) {
                    const sectionObj = { ...(updated[section] as unknown as Record<string, unknown>) };
                    sectionObj[key] = value;
                    (updated as unknown as Record<string, unknown>)[section] = sectionObj;
                }
            }
            // Handle Primitive Updates
            else {
                (updated as unknown as Record<string, unknown>)[section] = value;
            }
            return updated;
        }));
    };

    const handleSaveManagement = async () => {
        if (!selectedWorkId) return;
        try {
            const payload = {
                work_id: selectedWorkId,
                operator, engineer, coordinator, control_tower: controlTower
            };
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setToast({ message: "Gestão salva com sucesso!", type: "success" });
                setIsModalOpen(false);
                fetchManagements();
            } else {
                setToast({ message: "Erro ao salvar.", type: "error" });
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    const handleSaveOccurrence = async () => {
        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/occurrences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(occurrenceForm)
            });
            if (res.ok) {
                setToast({ message: "Ocorrência registrada!", type: "success" });
                setIsOccurrenceModalOpen(false);
                fetchOccurrences();
            }
        } catch {
            setToast({ message: "Erro ao salvar ocorrência.", type: "error" });
        }
    };

    const handleButtonClick = (id: string) => {
        if (id === "Nova Gestão") {
            setModalType("Nova Gestão");
            setSelectedWorkId(""); // Reset to allow selection
            setIsModalOpen(true);
        } else {
            console.log("Button clicked", id);
        }
    };

    const handleLoadMore = () => {
        fetchWorks(page + 1, false, debouncedSearch, filterRegional);
    };

    // MERGE Logic: Works (Driver) + Managements (Data)
    const filteredManagements = useMemo(() => {
        return works.map(w => {
            const m = managements.find(mg => mg.work_id === w.id);
            // Default Structure if m is missing
            const defaultM: EngineeringManagement = {
                work_id: w.id,
                owner_works: initOwnerWorks(),
                licenses: initLicenses(),
                thermometer: initThermometer(),
                operator: "", size_m2: "", floor_size_m2: "", engineer: "", coordinator: "", control_tower: "", pm: "", cm: "",
                macro_schedule: initMacroSchedule(),
                supply_schedule: initSupplySchedule(),
                complementary_info: initComplementaryInfo(),
                general_docs: initGeneralDocs(),
                capex: initCapex(),
                daily_log: initDailyLog(),
                highlights: initHighlights(),
                presentation_highlights: "", attention_points: "", image_1: "", image_2: "", map_image: "",
                // Preserve work properties in the merged object for UI to use (regional, work_type)
                ...w
            } as EngineeringManagement;

            if (m) {
                return { ...defaultM, ...m, ...w };
            }
            return defaultM;
        });
    }, [works, managements]);

    const handleCardClick = (workId: string) => {
        setModalType("Editar Gestão");
        setSelectedWorkId(workId);
        setIsModalOpen(true);
        // setActiveTab(0);
    };

    // Status Icon Helper
    const renderStatusIcon = (status: string) => {
        switch (status) {
            case "🟢": return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-500"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>;
            case "🟡": return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>;
            case "🔴": return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>;
            default: return <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>;
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => {
            const next = prev === id ? null : id;
            if (next) setCardTab("overview");
            return next;
        });
    };

    // Navigation for Ask AI
    const navigate = useNavigate();

    const handleAskAI = (work: EngineeringWork | undefined, m: EngineeringManagement) => {
        if (!work) return;
        const contextData = `Obra: ${work.regional} (${work.work_type})\nStatus Cronograma: ${m.thermometer?.find(t => t.name === "Cronograma")?.status}\nOperador: ${m.operator}\n`;
        // Navigate to Assistant with state (requires Assistant to handle location.state, or just copy to clipboard for now as MVP)
        // For MVP, we will copy to clipboard and redirect
        navigator.clipboard.writeText(`Analise esta obra: ${contextData}`);
        setToast({ message: "Dados copiados! Cole no Assistente.", type: "success" });
        setTimeout(() => navigate('/assistant'), 1000);
    };

    const handlePrintDaily = () => {
        window.print();
    };

    const handleGenerateReport = (m: EngineeringManagement) => {
        const report = `RESUMO EXECUTIVO - ${works.find(w => w.id === m.work_id)?.regional}\n\n1. Cronograma: ${m.thermometer?.find(t => t.name === "Cronograma")?.status}\n2. Principais Atividades: ${m.macro_schedule?.slice(0, 3).map(s => s.name).join(", ")}\n3. Atenção: ${m.highlights?.special_attention || "Nenhum ponto crítico."}`;
        navigator.clipboard.writeText(report);
        setToast({ message: "Relatório copiado para a área de transferência!", type: "success" });
    };

    // Map State
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [heatmapFilter, setHeatmapFilter] = useState<'all' | 'delayed' | 'critical'>('all');

    // Weather Mock Logic
    const getWeather = (regional: string) => {
        const weathers = {
            'Sul': { temp: '18°C', icon: '🌧️', condition: 'Chuvoso' },
            'Rimes': { temp: '28°C', icon: '☀️', condition: 'Ensolarado' },
            'Noneco': { temp: '32°C', icon: '🌤️', condition: 'Parc. Nublado' },
            'SPCIL': { temp: '24°C', icon: '☁️', condition: 'Nublado' }
        };
        return weathers[regional as keyof typeof weathers] || { temp: '25°C', icon: '☀️', condition: 'Ensolarado' };
    };

    return (
        <div className="relative min-h-full w-full">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Main Content */}
            <div className={`mr-80 px-8 py-8 w-auto mx-0 transition-all duration-500 ${viewMode === 'map' ? 'h-[calc(100vh-2rem)]' : ''}`}>

                {/* View Toggle */}
                <div className="flex justify-end mb-6">
                    <div className="bg-white/40 backdrop-blur-md p-1 rounded-xl flex shadow-sm border border-white/50">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            Lista
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            Mapa (Heatmap)
                        </button>
                    </div>
                </div>

                {viewMode === 'map' ? (
                    <div className="w-full h-[600px] bg-blue-50 rounded-3xl border border-white/50 shadow-xl relative overflow-hidden group">
                        {/* Mock Map Background */}
                        <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Brazil_location_map.svg/1024px-Brazil_location_map.svg.png')] bg-contain bg-center bg-no-repeat opacity-20 grayscale group-hover:grayscale-0 transition-all duration-1000"></div>

                        <div className="absolute inset-0 p-8">
                            <h3 className="text-xl font-bold text-gray-700 mb-4">Mapa de Operações</h3>

                            {/* Heatmap Controls */}
                            <div className="flex gap-2 mb-8">
                                <button onClick={() => setHeatmapFilter('all')} className={`text-xs px-3 py-1 rounded-full border transition-all ${heatmapFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/50 text-gray-600 border-gray-300'}`}>Todas</button>
                                <button onClick={() => setHeatmapFilter('delayed')} className={`text-xs px-3 py-1 rounded-full border transition-all ${heatmapFilter === 'delayed' ? 'bg-red-500 text-white border-red-500' : 'bg-white/50 text-gray-600 border-gray-300'}`}>Com Atraso</button>
                            </div>

                            {/* Pins */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {filteredManagements.map((m) => {
                                    const work = works.find(w => w.id === m.work_id);
                                    // Mock delay check
                                    const hasDelay = m.macro_schedule?.some(s => s.end_real && s.end_planned && s.end_real > s.end_planned);

                                    if (heatmapFilter === 'delayed' && !hasDelay) return null;

                                    return (
                                        <div key={m.work_id} onClick={() => { setViewMode('list'); setExpandedId(m.work_id); }} className="bg-white/90 backdrop-blur shadow-lg p-3 rounded-xl border border-white/50 cursor-pointer hover:scale-105 transition-transform">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-sm text-gray-800">{work?.regional}</span>
                                                <div className={`w-2 h-2 rounded-full ${hasDelay ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{work?.work_type}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Cards Grid
                    <div className="grid grid-cols-1 gap-6 pb-20">
                        {filteredManagements.map(m => {
                            const work = works.find(w => w.id === m.work_id);
                            const isExpanded = expandedId === m.work_id;

                            // OC & Event Data
                            const oc = ocs.find(o => o.work_id === m.work_id);
                            const ocEvts = oc ? ocEvents.filter(e => e.oc_id === oc.id) : [];
                            const activeEvent = ocEvts.length > 0 ? ocEvts[0] : null;

                            return (
                                <div
                                    key={m.work_id}
                                    className={`relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all hover:bg-white/50 group flex flex-col ${isExpanded ? 'col-span-full' : 'col-span-1'}`}
                                >
                                    {/* Action Buttons */}
                                    <div className="absolute top-4 right-4 flex gap-2 z-20">
                                        <button
                                            onClick={() => handleAskAI(work, m)}
                                            className="p-1.5 rounded-full bg-white/50 hover:bg-purple-100 text-purple-600 transition-colors shadow-sm"
                                            title="Perguntar à IA"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436A6.75 6.75 0 019.75 22.5a.75.75 0 01-.75-.75v-4.131A15.838 15.838 0 016.382 15H2.25a.75.75 0 01-.75-.75 6.75 6.75 0 017.815-6.666zM15 6.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" clipRule="evenodd" />
                                                <path d="M5.26 17.242a.75.75 0 10-.897-1.203 5.243 5.243 0 00-2.05 5.022.75.75 0 00.625.627 5.243 5.243 0 002.322-4.446z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => toggleExpand(m.work_id)}
                                            className="p-1.5 rounded-full bg-white/50 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm"
                                            title={isExpanded ? "Recolher" : "Expandir"}
                                        >
                                            {isExpanded ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                </svg>
                                            )}
                                        </button>
                                        <button onClick={() => handleCardClick(m.work_id)} className="p-1.5 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                        </button>
                                    </div>

                                    {/* Card Content */}
                                    <div className="relative z-10 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100/50 text-blue-700 border border-blue-200/50 uppercase tracking-wider">{work?.id || m.work_id}</span>

                                                {/* Weather Widget */}
                                                {work?.regional && (
                                                    <div className="flex items-center gap-2 bg-white/60 px-2 py-1 rounded-lg border border-white/50 shadow-sm" title={`Clima em ${work.regional}`}>
                                                        <span className="text-lg">{getWeather(work.regional).icon}</span>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-gray-700 leading-tight">{getWeather(work.regional).temp}</span>
                                                            <span className="text-[8px] text-gray-500 leading-tight">{getWeather(work.regional).condition}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* GoLive Widget */}
                                                {work?.go_live_date && (
                                                    <div className="flex items-center gap-2 bg-white/60 px-2 py-1 rounded-lg border border-white/50 shadow-sm">
                                                        <span className="text-lg">🚀</span>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-gray-700 leading-tight">{formatDate(work.go_live_date)}</span>
                                                            <span className="text-[8px] text-gray-500 leading-tight">GoLive</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Active Event Widget */}
                                                {activeEvent && (
                                                    <div className="flex items-center gap-2 bg-white/60 px-2 py-1 rounded-lg border border-white/50 shadow-sm max-w-[200px]">
                                                        <span className="text-lg text-blue-500">📅</span>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-[10px] font-bold text-gray-700 leading-tight truncate">{activeEvent.description}</span>
                                                            <span className="text-[8px] text-gray-500 leading-tight">{activeEvent.start_date ? formatDate(activeEvent.start_date) : 'Data n/d'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 mb-1">{work?.regional || "Sem Regional"}</h3>
                                        <p className="text-sm font-medium text-gray-700 mb-0.5">{work?.work_type || "-"}</p>
                                        <p className="text-sm text-gray-500 mb-4">{m.operator || "-"}</p>

                                        {/* Simplified CAPEX Section */}
                                        {(oc || (work?.business_case && parseFloat(work.business_case.replace(/[R$\s.]/g, '').replace(',', '.')) > 0) || (m.business_case && parseFloat(m.business_case.replace(/[R$\s.]/g, '').replace(',', '.')) > 0) || (m.capex?.approved && parseFloat(m.capex.approved) > 0) || (ocs.filter(o => o.work_id === m.work_id).length > 0)) && (() => {
                                            const parseCurrency = (val: string | undefined): number => {
                                                if (!val) return 0;
                                                const clean = val.replace(/[R$\s.]/g, '').replace(',', '.');
                                                const num = parseFloat(clean);
                                                return isNaN(num) ? 0 : num;
                                            };

                                            const totalApproved = parseCurrency(work?.business_case || m.business_case || m.capex?.approved);
                                            const workOcs = ocs.filter(o => o.work_id === m.work_id);
                                            const totalContracted = workOcs.reduce((acc, o) => acc + (o.value || 0), 0);

                                            const available = Math.max(0, totalApproved - totalContracted);

                                            let progress = 0;
                                            if (totalApproved > 0) {
                                                progress = (totalContracted / totalApproved) * 100;
                                            } else if (totalContracted > 0) {
                                                progress = 100; // Unbudgeted spend
                                            }
                                            const cappedProgress = Math.min(progress, 100);

                                            let barColor = 'bg-primary-500';
                                            if (progress >= 75 && progress < 90) barColor = 'bg-yellow-500';
                                            if (progress >= 90) barColor = 'bg-red-500';

                                            return (
                                                <div className="mb-4 bg-white/30 p-2 rounded-xl border border-white/40">
                                                    <div className="flex justify-between items-end mb-2">
                                                        {/* Available */}
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Disponível</span>
                                                            <span className="text-sm font-bold text-green-600">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(available)}
                                                            </span>
                                                        </div>
                                                        {/* Committed */}
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Comprometido</span>
                                                            <span className="text-sm font-bold text-gray-800">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(totalContracted)}
                                                            </span>
                                                            {totalApproved > 0 && <span className="text-[9px] text-gray-400 font-medium">de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(totalApproved)}</span>}
                                                        </div>
                                                    </div>

                                                    <div className="relative w-full h-2.5 bg-gray-200/50 rounded-full overflow-hidden border border-white/50">
                                                        <div
                                                            className={`${barColor} h-full rounded-full transition-all duration-1000 shadow-sm`}
                                                            style={{ width: `${cappedProgress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {m.size_m2 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Área</span>
                                                <span className="font-medium text-gray-700">{m.size_m2} m²</span>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-white/50 mt-auto">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Cronograma</span>
                                                <div className="flex items-center gap-2">
                                                    {renderStatusIcon(m.thermometer?.find(t => t.name === "Cronograma")?.status || "⚪️")}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="mt-8 pt-6 border-t border-gray-200/50 animate-fadeIn">
                                                {/* Tabs Navigation */}
                                                <div className="flex flex-wrap gap-4 mb-6 border-b border-gray-200/50 pb-2">
                                                    {['overview', 'macro', 'supply', 'docs', 'daily', 'occurrences', 'highlights'].map(tab => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => setCardTab(tab)}
                                                            className={`text-sm font-bold uppercase tracking-wide transition-colors whitespace-nowrap ${cardTab === tab ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                        >
                                                            {tab === 'overview' ? 'Visão Geral' : tab === 'macro' ? 'Cronograma' : tab === 'supply' ? 'Suprimentos' : tab === 'docs' ? 'Documentação' : tab === 'daily' ? 'Diário' : tab === 'occurrences' ? 'Ocorrências' : 'Destaques'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Overview */}
                                                {/* Overview */}
                                                {cardTab === "overview" && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        <div className="col-span-full flex justify-end">
                                                            <button
                                                                onClick={() => handleGenerateReport(m)}
                                                                className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50/50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                                </svg>
                                                                Copiar Relatório Executivo
                                                            </button>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Obras Proprietário</h4>
                                                            <div className="space-y-2">
                                                                {m.owner_works?.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between text-sm bg-white/40 p-2 rounded-lg items-center">
                                                                        <span className="truncate flex-1">{item.name}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="date"
                                                                                value={item.date || ""}
                                                                                onChange={(e) => handleInlineUpdate(m.work_id, 'owner_works', idx, 'date', e.target.value)}
                                                                                className="bg-transparent border-none text-[10px] text-gray-500 w-20 p-0 focus:ring-0 text-right"
                                                                            />
                                                                            <div className="cursor-pointer" onClick={() => handleInlineUpdate(m.work_id, 'owner_works', idx, 'status', item.status === '🟢' ? '⚪️' : item.status === '⚪️' ? '🟢' : '⚪️')}>
                                                                                {renderStatusIcon(item.status)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Licenciamento</h4>
                                                            <div className="space-y-2">
                                                                {m.licenses?.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between text-sm bg-white/40 p-2 rounded-lg items-center">
                                                                        <span className="truncate flex-1">{item.name}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="date"
                                                                                value={item.date || ""}
                                                                                onChange={(e) => handleInlineUpdate(m.work_id, 'licenses', idx, 'date', e.target.value)}
                                                                                className="bg-transparent border-none text-[10px] text-gray-500 w-20 p-0 focus:ring-0 text-right"
                                                                            />
                                                                            <div className="cursor-pointer" onClick={() => handleInlineUpdate(m.work_id, 'licenses', idx, 'status', item.status === '🟢' ? '⚪️' : item.status === '⚪️' ? '🟢' : '⚪️')}>
                                                                                {renderStatusIcon(item.status)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Termômetro</h4>
                                                            <div className="space-y-2">
                                                                {m.thermometer?.map((item, idx) => {
                                                                    const statuses = ['⚪️', '🟢', '🟡', '🔴'];
                                                                    const nextStatus = statuses[(statuses.indexOf(item.status) + 1) % statuses.length];
                                                                    return (
                                                                        <div key={idx} className="flex justify-between text-sm bg-white/40 p-2 rounded-lg items-center">
                                                                            <span className="truncate flex-1">{item.name}</span>
                                                                            <div className="cursor-pointer" onClick={() => handleInlineUpdate(m.work_id, 'thermometer', idx, 'status', nextStatus)}>
                                                                                {renderStatusIcon(item.status)}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Macro */}
                                                {cardTab === "macro" && (
                                                    <div>
                                                        <div className="flex justify-end mb-2">
                                                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                                                <span className="w-2 h-2 rounded-full bg-red-100 border border-red-300"></span> Caminho Crítico (Atraso)
                                                            </div>
                                                        </div>
                                                        <table className="w-full text-xs">
                                                            <thead className="text-gray-500 border-b border-gray-200">
                                                                <tr>
                                                                    <th className="text-left py-2 font-medium">Etapa</th>
                                                                    <th className="text-center py-2 font-medium">Início Planejado</th>
                                                                    <th className="text-center py-2 font-medium">Início Real</th>
                                                                    <th className="text-center py-2 font-medium">Fim Planejado</th>
                                                                    <th className="text-center py-2 font-medium">Fim Real</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {m.macro_schedule?.map((item, idx) => {
                                                                    const isCritical = item.end_real && item.end_planned && item.end_real > item.end_planned;
                                                                    return (
                                                                        <tr key={idx} className={`group transition-colors ${isCritical ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-white/40'}`}>
                                                                            <td className="py-2 flex items-center gap-2">
                                                                                {item.name}
                                                                                {isCritical && <span className="text-[8px] font-bold text-red-500 uppercase tracking-wide border border-red-200 px-1 rounded">Atraso</span>}
                                                                            </td>
                                                                            <td className="text-center py-2">
                                                                                <input type="date" value={item.start_planned || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'macro_schedule', idx, 'start_planned', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs text-gray-500" />
                                                                            </td>
                                                                            <td className={`text-center py-2 ${getDateColor(item.start_planned, item.start_real)}`}>
                                                                                <input type="date" value={item.start_real || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'macro_schedule', idx, 'start_real', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs" />
                                                                            </td>
                                                                            <td className="text-center py-2">
                                                                                <input type="date" value={item.end_planned || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'macro_schedule', idx, 'end_planned', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs text-gray-500" />
                                                                            </td>
                                                                            <td className={`text-center py-2 ${getDateColor(item.end_planned, item.end_real)}`}>
                                                                                <input type="date" value={item.end_real || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'macro_schedule', idx, 'end_real', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs" />
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {/* Occurences */}
                                                {cardTab === "occurrences" && (
                                                    <div>
                                                        <div className="flex justify-between items-center mb-4">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ocorrências da Obra</h4>
                                                            <button onClick={() => { setIsOccurrenceModalOpen(true); setOccurrenceForm(prev => ({ ...prev, work_id: m.work_id })); }} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Adicionar</button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {occurrences.filter(o => o.work_id === m.work_id).length === 0 ? (
                                                                <p className="text-xs text-gray-400">Nenhuma ocorrência registrada.</p>
                                                            ) : (
                                                                occurrences.filter(o => o.work_id === m.work_id).map(occ => (
                                                                    <div key={occ.id} className="text-sm bg-white/40 p-3 rounded-lg flex justify-between">
                                                                        <div>
                                                                            <span className="block font-medium">{occ.description}</span>
                                                                            <span className="text-xs text-gray-500">{formatDate(occ.date)}</span>
                                                                        </div>
                                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${occ.type === 'Incidente' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{occ.type}</span>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Daily */}
                                                {/* Daily */}
                                                {cardTab === "daily" && (
                                                    <div>
                                                        <div className="flex justify-between items-center mb-4">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diário de Obra</h4>
                                                            <button
                                                                onClick={handlePrintDaily}
                                                                className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                                                                </svg>
                                                                Imprimir / PDF
                                                            </button>
                                                        </div>
                                                        <div className="space-y-4">
                                                            {m.daily_log?.map((day, dIdx) => (
                                                                <div key={dIdx} className="bg-white/40 p-4 rounded-xl">
                                                                    <h5 className="font-bold text-sm text-gray-800 mb-2">{day.day}</h5>
                                                                    <textarea
                                                                        value={day.description || ""}
                                                                        onChange={(e) => handleInlineUpdate(m.work_id, 'daily_log', dIdx, 'description', e.target.value)}
                                                                        placeholder="Atividades do dia..."
                                                                        rows={2}
                                                                        className="w-full bg-white/50 border-none rounded-lg text-sm resize-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Supply */}
                                                {/* Supply */}
                                                {cardTab === "supply" && (
                                                    <div>
                                                        <table className="w-full text-xs">
                                                            <thead className="text-gray-500 border-b border-gray-200">
                                                                <tr>
                                                                    <th className="text-left py-2 font-medium">Item</th>
                                                                    <th className="text-center py-2 font-medium">Início Planejado</th>
                                                                    <th className="text-center py-2 font-medium">Início Real</th>
                                                                    <th className="text-center py-2 font-medium">Fim Planejado</th>
                                                                    <th className="text-center py-2 font-medium">Fim Real</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {m.supply_schedule?.map((item, idx) => (
                                                                    <tr key={idx} className="hover:bg-white/40 transition-colors">
                                                                        <td className="py-2 text-gray-700">{item.name}</td>
                                                                        <td className="text-center py-2">
                                                                            <input type="date" value={item.start_planned || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'supply_schedule', idx, 'start_planned', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs text-gray-500" />
                                                                        </td>
                                                                        <td className={`text-center py-2 ${getDateColor(item.start_planned, item.start_real)}`}>
                                                                            <input type="date" value={item.start_real || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'supply_schedule', idx, 'start_real', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs text-gray-700" />
                                                                        </td>
                                                                        <td className="text-center py-2">
                                                                            <input type="date" value={item.end_planned || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'supply_schedule', idx, 'end_planned', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs text-gray-500" />
                                                                        </td>
                                                                        <td className={`text-center py-2 ${getDateColor(item.end_planned, item.end_real)}`}>
                                                                            <input type="date" value={item.end_real || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'supply_schedule', idx, 'end_real', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs text-gray-700" />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {/* Docs */}
                                                {cardTab === "docs" && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Documentações Gerais</h4>
                                                            <div className="space-y-2 text-sm">
                                                                <div className="bg-white/40 p-2 rounded-lg flex items-center justify-between">
                                                                    <span className="block text-xs text-gray-500">Layout</span>
                                                                    <input type="text" value={m.general_docs?.layout || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'general_docs', 'layout', null, e.target.value)} className="bg-transparent border-none text-right text-sm font-medium w-32 p-0 focus:ring-0" placeholder="-" />
                                                                </div>
                                                                <div className="bg-white/40 p-2 rounded-lg flex items-center justify-between">
                                                                    <span className="block text-xs text-gray-500">Construtora</span>
                                                                    <input type="text" value={m.general_docs?.construtora || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'general_docs', 'construtora', null, e.target.value)} className="bg-transparent border-none text-right text-sm font-medium w-full ml-4 p-0 focus:ring-0" placeholder="-" />
                                                                </div>
                                                                <div className="bg-white/40 p-2 rounded-lg flex items-center justify-between">
                                                                    <span className="block text-xs text-gray-500">Contato</span>
                                                                    <input type="text" value={m.general_docs?.contato || ""} onChange={(e) => handleInlineUpdate(m.work_id, 'general_docs', 'contato', null, e.target.value)} className="bg-transparent border-none text-right text-sm font-medium w-full ml-4 p-0 focus:ring-0" placeholder="-" />
                                                                </div>
                                                                {/* Period fields if needed */}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Informações Complementares</h4>
                                                            <div className="space-y-2">
                                                                {m.complementary_info?.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center text-sm bg-white/40 p-2 rounded-lg">
                                                                        <span className="truncate flex-1">{item.name}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="date"
                                                                                value={item.date || ""}
                                                                                onChange={(e) => handleInlineUpdate(m.work_id, 'complementary_info', idx, 'date', e.target.value)}
                                                                                className="bg-transparent border-none text-[10px] text-gray-500 w-20 p-0 focus:ring-0 text-right"
                                                                            />
                                                                            <div className="cursor-pointer" onClick={() => handleInlineUpdate(m.work_id, 'complementary_info', idx, 'status', item.status === '🟢' ? '⚪️' : item.status === '⚪️' ? '🟢' : '⚪️')}>
                                                                                {renderStatusIcon(item.status)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Highlights */}
                                                {cardTab === "highlights" && (
                                                    <div className="space-y-4">
                                                        <div className="bg-white/40 p-4 rounded-xl">
                                                            <h5 className="font-bold text-sm text-gray-700 mb-2">Atenção Especial</h5>
                                                            <textarea
                                                                value={m.highlights?.special_attention || ""}
                                                                onChange={(e) => handleInlineUpdate(m.work_id, 'highlights', 'special_attention', null, e.target.value)}
                                                                placeholder="Descreva pontos de atenção..."
                                                                rows={2}
                                                                className="w-full bg-white/50 border-none rounded-lg text-sm resize-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="bg-white/40 p-4 rounded-xl">
                                                            <h5 className="font-bold text-sm text-gray-700 mb-2">Planos de Ação</h5>
                                                            <textarea
                                                                value={m.highlights?.action_plans || ""}
                                                                onChange={(e) => handleInlineUpdate(m.work_id, 'highlights', 'action_plans', null, e.target.value)}
                                                                placeholder="Descreva planos de ação..."
                                                                rows={2}
                                                                className="w-full bg-white/50 border-none rounded-lg text-sm resize-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="bg-white/40 p-4 rounded-xl">
                                                            <h5 className="font-bold text-sm text-gray-700 mb-2">Atividades Relevantes</h5>
                                                            <textarea
                                                                value={m.highlights?.relevant_activities || ""}
                                                                onChange={(e) => handleInlineUpdate(m.work_id, 'highlights', 'relevant_activities', null, e.target.value)}
                                                                placeholder="Descreva atividades relevantes..."
                                                                rows={2}
                                                                className="w-full bg-white/50 border-none rounded-lg text-sm resize-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}


                        {/* Load More Button */}
                        {hasMore && (
                            <div className="flex justify-center pb-20 mt-8">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                    className="px-6 py-3 bg-white/50 hover:bg-white text-blue-600 font-bold rounded-full shadow-lg backdrop-blur-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Carregando...
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                            </svg>
                                            Carregar Mais
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Sidebar */}
            <div className="fixed right-8 top-32 flex flex-col gap-6 w-64 z-10">
                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl">
                    <h3 className="text-sm font-bold text-gray-700 px-2 mb-1 uppercase tracking-wider">Ações</h3>
                    <button onClick={() => handleButtonClick("Nova Gestão")} className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group">
                        Nova Gestão
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V3a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={() => { setIsOccurrenceModalOpen(true); setOccurrenceForm({ id: '', work_id: '', date: '', description: '', type: 'Atividade', status: 'Active' }); }} className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group">
                        Nova Ocorrência
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-yellow-600"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                </div>

                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl">
                    <h3 className="text-sm font-bold text-gray-700 px-2 mb-1 uppercase tracking-wider">Filtros</h3>
                    <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Buscar..." className="w-full rounded-xl bg-white/80 pl-4 pr-10 py-3 text-sm font-medium text-gray-900 shadow-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-500" />
                    <select value={filterRegional} onChange={(e) => setFilterRegional(e.target.value)} className="w-full rounded-xl bg-white/80 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm focus:bg-white outline-none">
                        <option value="">Todas Regionais</option>
                        <option value="Rimes">Rimes</option>
                        <option value="Noneco">Noneco</option>
                        <option value="SPCIL">SPCIL</option>
                        <option value="Sul">Sul</option>
                    </select>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalType}>
                {/* Form Logic matching existing logic but cleaned up */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Obra</label>
                        <select value={selectedWorkId} onChange={(e) => setSelectedWorkId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2">
                            <option value="">Selecione...</option>
                            {works.map(w => <option key={w.id} value={w.id}>{w.id} - {w.regional}</option>)}
                        </select>
                    </div>
                    {selectedWork && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-medium">Operador</label><input type="text" value={operator} onChange={(e) => setOperator(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 p-2 text-xs" /></div>
                            <div><label className="block text-xs font-medium">Engenheiro</label><input type="text" value={engineer} onChange={(e) => setEngineer(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 p-2 text-xs" /></div>
                            <div><label className="block text-xs font-medium">Coordenador</label><input type="text" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 p-2 text-xs" /></div>
                            <div><label className="block text-xs font-medium">Torre de Controle</label><input type="text" value={controlTower} onChange={(e) => setControlTower(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 p-2 text-xs" /></div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button onClick={handleSaveManagement} className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all">Salvar Gestão</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isOccurrenceModalOpen} onClose={() => setIsOccurrenceModalOpen(false)} title="Nova Ocorrência">
                <div className="space-y-4">
                    <select value={occurrenceForm.work_id} onChange={(e) => setOccurrenceForm({ ...occurrenceForm, work_id: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm">
                        <option value="">Selecione a Obra...</option>
                        {works.map(w => <option key={w.id} value={w.id}>{w.id}</option>)}
                    </select>
                    <input type="date" value={occurrenceForm.date} onChange={(e) => setOccurrenceForm({ ...occurrenceForm, date: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm" />
                    <textarea value={occurrenceForm.description} onChange={(e) => setOccurrenceForm({ ...occurrenceForm, description: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm" placeholder="Descrição da ocorrência..." rows={3} />
                    <select value={occurrenceForm.type} onChange={(e) => setOccurrenceForm({ ...occurrenceForm, type: e.target.value })} className="block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm">
                        <option value="Atividade">Atividade</option>
                        <option value="Incidente">Incidente</option>
                        <option value="Atraso">Atraso</option>
                        <option value="Outro">Outro</option>
                    </select>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsOccurrenceModalOpen(false)} className="px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                        <button onClick={handleSaveOccurrence} className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all">Salvar</button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
