import { useState, useEffect, useMemo, useCallback } from "react";
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

    // Management Data Structure
    const [ownerWorks, setOwnerWorks] = useState<EngineeringOwnerWork[]>([]);
    const [licenses, setLicenses] = useState<EngineeringLicense[]>([]);
    const [thermometer, setThermometer] = useState<EngineeringThermometer[]>([]);

    // Additional Info
    const [operator, setOperator] = useState("");
    const [sizeM2, setSizeM2] = useState("");
    const [floorSizeM2, setFloorSizeM2] = useState("");
    const [engineer, setEngineer] = useState("");
    const [coordinator, setCoordinator] = useState("");
    const [controlTower, setControlTower] = useState("");
    const [pm, setPm] = useState("");
    const [cm, setCm] = useState("");

    // Schedules
    const [macroSchedule, setMacroSchedule] = useState<EngineeringScheduleItem[]>([]);
    const [supplySchedule, setSupplySchedule] = useState<EngineeringScheduleItem[]>([]);

    // Advanced Info State
    const [complementaryInfo, setComplementaryInfo] = useState<EngineeringComplementaryInfo[]>([]);
    const [generalDocs, setGeneralDocs] = useState<EngineeringGeneralDocs>(initGeneralDocs());
    const [capex, setCapex] = useState<EngineeringCapex>(initCapex());
    const [dailyLog, setDailyLog] = useState<EngineeringDailyLog[]>([]);
    const [highlights, setHighlights] = useState<EngineeringHighlights>(initHighlights());

    // Preservation State (Report Fields)
    const [presentationHighlights, setPresentationHighlights] = useState("");
    const [attentionPoints, setAttentionPoints] = useState("");
    const [image1, setImage1] = useState("");
    const [image2, setImage2] = useState("");
    const [mapImage, setMapImage] = useState("");

    // Expanded Card State
    const [cardTab, setCardTab] = useState("overview");

    // Occurrences State
    const [occurrenceForm, setOccurrenceForm] = useState<EngineeringOccurrence>({
        id: '', work_id: '', date: '', description: '', type: 'Atividade', status: 'Active'
    });

    // Filter State
    const [searchText, setSearchText] = useState("");
    const [filterRegional, setFilterRegional] = useState("");

    const resetManagementData = useCallback(() => {
        setOwnerWorks(initOwnerWorks());
        setLicenses(initLicenses());
        setThermometer(initThermometer());
        setOperator("");
        setSizeM2("");
        setFloorSizeM2("");
        setEngineer("");
        setCoordinator("");
        setControlTower("");
        setPm("");
        setCm("");
        setMacroSchedule(initMacroSchedule());
        setSupplySchedule(initSupplySchedule());
        setComplementaryInfo(initComplementaryInfo());
        setGeneralDocs(initGeneralDocs());
        setCapex(initCapex());
        setDailyLog(initDailyLog());
        setHighlights(initHighlights());
        setPresentationHighlights("");
        setAttentionPoints("");
        setImage1("");
        setImage2("");
        setMapImage("");
    }, []);

    const fetchWorks = useCallback(async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setWorks(await response.json());
            }
        } catch (error) {
            console.error("Error fetching works:", error);
        }
    }, []);

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

    const fetchManagementData = useCallback(async (workId: string) => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements/${workId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && Object.keys(data).length > 0) {
                    setOwnerWorks(data.owner_works || initOwnerWorks());
                    setLicenses(data.licenses || initLicenses());
                    setThermometer(data.thermometer || initThermometer());
                    setOperator(data.operator || "");
                    setSizeM2(data.size_m2 || "");
                    setFloorSizeM2(data.floor_size_m2 || "");
                    setEngineer(data.engineer || "");
                    setCoordinator(data.coordinator || "");
                    setControlTower(data.control_tower || "");
                    setPm(data.pm || "");
                    setCm(data.cm || "");
                    setMacroSchedule(data.macro_schedule || initMacroSchedule());
                    setSupplySchedule(data.supply_schedule || initSupplySchedule());
                    setComplementaryInfo(data.complementary_info || initComplementaryInfo());
                    setGeneralDocs(data.general_docs || initGeneralDocs());
                    setCapex(data.capex || initCapex());
                    setDailyLog(data.daily_log || initDailyLog());
                    setHighlights(data.highlights || initHighlights());
                    setPresentationHighlights(data.presentation_highlights || "");
                    setAttentionPoints(data.attention_points || "");
                    setImage1(data.image_1 || "");
                    setImage2(data.image_2 || "");
                    setMapImage(data.map_image || "");
                } else {
                    resetManagementData();
                }
            } else {
                resetManagementData();
            }
        } catch (error) {
            console.error("Error fetching management:", error);
            resetManagementData();
        }
    }, [resetManagementData]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchWorks();
        fetchManagements();
        fetchOccurrences();
    }, [fetchWorks, fetchManagements, fetchOccurrences]);

    // Data Loading when selecting work (moved out of useEffect)
    // We will trigger this when selectedWorkId changes via user interaction, 
    // OR we just use useEffect but without setState of selectedWork.
    useEffect(() => {
        if (selectedWorkId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchManagementData(selectedWorkId);
        } else {
            resetManagementData();
        }
    }, [selectedWorkId, fetchManagementData, resetManagementData]);

    const handleSaveOccurrence = async () => {
        if (!occurrenceForm.description || !occurrenceForm.date || !occurrenceForm.work_id) {
            setToast({ message: "Preencha os campos obrigatórios.", type: "error" });
            return;
        }

        try {
            const token = await getAuthToken();
            const isEdit = !!occurrenceForm.id;
            const method = isEdit ? "PUT" : "POST";
            const url = isEdit
                ? `${import.meta.env.VITE_API_BASE_URL}/occurrences/${occurrenceForm.id}`
                : `${import.meta.env.VITE_API_BASE_URL}/occurrences`;

            // Generate ID if new
            const payload = isEdit ? occurrenceForm : { ...occurrenceForm, id: "occ_" + Math.random().toString(36).substr(2, 9) };

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: "Ocorrência salva!", type: "success" });
                setIsOccurrenceModalOpen(false);
                fetchOccurrences();
                setOccurrenceForm({ id: '', work_id: '', date: '', description: '', type: 'Atividade', status: 'Active' });
            } else {
                setToast({ message: "Erro ao salvar.", type: "error" });
            }
        } catch (error) {
            console.error("Error saving occurrence:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    const handleButtonClick = (type: string) => {
        setModalType(type);
        setIsModalOpen(true);
        setSelectedWorkId(""); // Reset selection
        // setActiveTab(0); // Removed unused
    };

    const handleSaveManagement = async () => {
        if (!selectedWorkId) {
            setToast({ message: "Selecione uma obra.", type: "error" });
            return;
        }

        const payload: EngineeringManagement = {
            work_id: selectedWorkId,
            owner_works: ownerWorks,
            licenses: licenses,
            thermometer: thermometer,
            operator: operator,
            size_m2: sizeM2,
            floor_size_m2: floorSizeM2,
            engineer: engineer,
            coordinator: coordinator,
            control_tower: controlTower,
            pm: pm,
            cm: cm,
            macro_schedule: macroSchedule,
            supply_schedule: supplySchedule,
            complementary_info: complementaryInfo,
            general_docs: generalDocs,
            capex: capex,
            daily_log: dailyLog,
            highlights: highlights,
            presentation_highlights: presentationHighlights,
            attention_points: attentionPoints,
            image_1: image1,
            image_2: image2,
            map_image: mapImage
        };

        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: "Gestão salva com sucesso!", type: "success" });
                setIsModalOpen(false);
                fetchManagements(); // Refresh list
            } else {
                setToast({ message: "Erro ao salvar.", type: "error" });
            }
        } catch (error) {
            console.error("Error saving:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    // Helper: Determine Date Color
    const getDateColor = (planned: string, real: string) => {
        if (!planned || !real) return "text-gray-600";
        if (real > planned) return "text-red-500 font-bold";
        return "text-green-500 font-bold";
    };

    // Inline Update Handler for Schedules
    const handleScheduleUpdate = async (workId: string, type: 'macro' | 'supply' | 'complementary' | 'daily', index: number, field: string, value: string) => {
        // 1. Update Local State
        const updatedManagements = managements.map(m => {
            if (m.work_id === workId) {
                let listName: keyof EngineeringManagement | '' = '';
                if (type === 'macro') listName = 'macro_schedule';
                else if (type === 'supply') listName = 'supply_schedule';
                else if (type === 'complementary') listName = 'complementary_info';
                else if (type === 'daily') listName = 'daily_log';

                if (!listName) return m;

                const list = [...(m[listName] as EngineeringScheduleItem[] | EngineeringComplementaryInfo[] | EngineeringDailyLog[])];
                if (!list[index]) return m;
                list[index] = { ...list[index], [field]: value };
                return { ...m, [listName]: list };
            }
            return m;
        });
        setManagements(updatedManagements);

        // 2. Persist to Backend
        const managementToSave = updatedManagements.find(m => m.work_id === workId);
        if (managementToSave) {
            try {
                const token = await getAuthToken();
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(managementToSave)
                });
            } catch (error) {
                console.error("Failed to auto-save schedule", error);
            }
        }
    };

    // Filter Logic
    const filteredManagements = useMemo(() => {
        return managements.filter(m => {
            const work = works.find(w => w.id === m.work_id);
            const regional = work?.regional || m.regional;
            const workType = work?.work_type || m.work_type;

            const searchLower = searchText.toLowerCase();
            const textMatch =
                !searchText ||
                m.work_id.toLowerCase().includes(searchLower) ||
                (regional?.toLowerCase() || "").includes(searchLower) ||
                (m.operator?.toLowerCase() || "").includes(searchLower) ||
                (workType?.toLowerCase() || "").includes(searchLower);

            if (!textMatch) return false;

            if (filterRegional && regional?.trim() !== filterRegional) return false;

            return true;
        });
    }, [managements, works, searchText, filterRegional]);

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
                                            <div className="flex items-center gap-3">
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
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 mb-1">{work?.regional || "Sem Regional"}</h3>
                                        <p className="text-sm font-medium text-gray-700 mb-0.5">{work?.work_type || "-"}</p>
                                        <p className="text-sm text-gray-500 mb-4">{m.operator || "-"}</p>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">GoLive</span>
                                                <span className="font-medium text-gray-700">{formatDate(work?.go_live_date || "")}</span>
                                            </div>
                                            {m.size_m2 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Área</span>
                                                    <span className="font-medium text-gray-700">{m.size_m2} m²</span>
                                                </div>
                                            )}
                                        </div>

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
                                                <div className="flex gap-4 mb-6 border-b border-gray-200/50 pb-2 overflow-x-auto">
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
                                                {cardTab === "overview" && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        <div className="col-span-full flex justify-end">
                                                            <button
                                                                onClick={() => handleGenerateReport(m)}
                                                                className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
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
                                                                    <div key={idx} className="flex justify-between text-sm bg-white/40 p-2 rounded-lg">
                                                                        <span className="truncate">{item.name}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-gray-500">{item.date ? formatDate(item.date) : '-'}</span>
                                                                            {renderStatusIcon(item.status)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Licenciamento</h4>
                                                            <div className="space-y-2">
                                                                {m.licenses?.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between text-sm bg-white/40 p-2 rounded-lg">
                                                                        <span className="truncate">{item.name}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-gray-500">{item.date ? formatDate(item.date) : '-'}</span>
                                                                            {renderStatusIcon(item.status)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Termômetro</h4>
                                                            <div className="space-y-2">
                                                                {m.thermometer?.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between text-sm bg-white/40 p-2 rounded-lg">
                                                                        <span className="truncate">{item.name}</span>
                                                                        {renderStatusIcon(item.status)}
                                                                    </div>
                                                                ))}
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
                                                                            <td className="text-center py-2 text-gray-500">{formatDate(item.start_planned)}</td>
                                                                            <td className={`text-center py-2 ${getDateColor(item.start_planned, item.start_real)}`}>
                                                                                <input type="date" value={item.start_real || ""} onChange={(e) => handleScheduleUpdate(m.work_id, 'macro', idx, 'start_real', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs" />
                                                                            </td>
                                                                            <td className="text-center py-2 text-gray-500">{formatDate(item.end_planned)}</td>
                                                                            <td className={`text-center py-2 ${getDateColor(item.end_planned, item.end_real)}`}>
                                                                                <input type="date" value={item.end_real || ""} onChange={(e) => handleScheduleUpdate(m.work_id, 'macro', idx, 'end_real', e.target.value)} className="bg-transparent text-center border-none w-24 p-0 focus:ring-0 text-xs" />
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
                                                                        onChange={(e) => handleScheduleUpdate(m.work_id, 'daily', dIdx, 'description', e.target.value)}
                                                                        placeholder="Atividades do dia..."
                                                                        rows={2}
                                                                        className="w-full bg-white/50 border-none rounded-lg text-sm resize-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm">Cancelar</button>
                        <button onClick={handleSaveManagement} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Salvar</button>
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
                        <button onClick={() => setIsOccurrenceModalOpen(false)} className="px-4 py-2 border rounded text-sm">Cancelar</button>
                        <button onClick={handleSaveOccurrence} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Salvar</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
