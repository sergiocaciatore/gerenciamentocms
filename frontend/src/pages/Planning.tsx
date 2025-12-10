import { useState, useEffect } from "react";
import axios from "axios";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getAuthToken } from "../firebase";

export default function Planning() {
    // State
    const [works, setWorks] = useState<any[]>([]);
    const [plannings, setPlannings] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedWorkId, setSelectedWorkId] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("planning");
    const [ganttView, setGanttView] = useState<'day' | 'week' | 'month'>('day');
    const [ganttType, setGanttType] = useState<'planning' | 'construction'>('planning'); // 'planning' | 'construction'
    const [selectedPlanningId, setSelectedPlanningId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

    // Action Plan States
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionModalType, setActionModalType] = useState<'planning' | 'construction'>('planning');
    const [actionPlanForm, setActionPlanForm] = useState({
        stageId: "",
        stageName: "",
        startDate: "",
        sla: "",
        endDate: "",
        description: ""
    });

    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Edit & Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [planningToDelete, setPlanningToDelete] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [planningToEdit, setPlanningToEdit] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ status: 'Rascunho' });

    // Construction Modal State
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [newStageForm, setNewStageForm] = useState({
        name: "",
        showPlanned: false,
        startPlanned: "",
        endPlanned: "",
        showReal: false,
        startReal: "",
        endReal: "",
        showResponsible: false,
        responsible: "",
        showSLA: false,
        sla: "",
        showDesc: false,
        description: "",
        isEditingIdx: -1 // -1 for new, >=0 for edit
    });

    // Helper to reset form
    const resetStageForm = () => {
        setNewStageForm({
            name: "",
            showPlanned: false,
            startPlanned: "",
            endPlanned: "",
            showReal: false,
            startReal: "",
            endReal: "",
            showResponsible: false,
            responsible: "",
            showSLA: false,
            sla: "",
            showDesc: false,
            description: "",
            isEditingIdx: -1
        });
    };

    const handleSaveConstructionStage = async (planningId: string, currentSchedule: any[]) => {
        if (!newStageForm.name) {
            setToast({ message: "Nome da etapa é obrigatório.", type: "error" });
            return;
        }

        const newItem = {
            id: newStageForm.isEditingIdx >= 0 ? currentSchedule[newStageForm.isEditingIdx].id : crypto.randomUUID(),
            name: newStageForm.name,
            start_planned: newStageForm.showPlanned ? newStageForm.startPlanned : null,
            end_planned: newStageForm.showPlanned ? newStageForm.endPlanned : null,
            start_real: newStageForm.showReal ? newStageForm.startReal : null,
            end_real: newStageForm.showReal ? newStageForm.endReal : null,
            responsible: newStageForm.showResponsible ? newStageForm.responsible : null,
            sla_limit: newStageForm.showSLA ? parseInt(newStageForm.sla) : null,
            description: newStageForm.showDesc ? newStageForm.description : null,
        };

        const updatedSchedule = [...currentSchedule];
        if (newStageForm.isEditingIdx >= 0) {
            updatedSchedule[newStageForm.isEditingIdx] = newItem;
        } else {
            updatedSchedule.push(newItem);
        }

        try {
            await axios.put(`${import.meta.env.VITE_API_BASE_URL}/plannings/${planningId}`, {
                ...plannings.find(p => p.id === planningId),
                data: {
                    ...plannings.find(p => p.id === planningId).data,
                    construction_schedule: updatedSchedule
                }
            }, {
                headers: { Authorization: `Bearer ${await getAuthToken()}` }
            });

            setToast({ message: "Etapa salva com sucesso!", type: "success" });
            fetchPlannings();
            setIsStageModalOpen(false);
            resetStageForm();
        } catch (error) {
            console.error("Erro ao salvar etapa:", error);
            setToast({ message: "Erro ao salvar etapa.", type: "error" });
        }
    };

    const handleSaveActionPlan = async () => {
        if (!selectedPlanningId) return;
        const planning = plannings.find(p => p.id === selectedPlanningId);
        if (!planning) return;

        if (!actionPlanForm.stageId) {
            setToast({ message: "Etapa de origem é obrigatória.", type: "error" });
            return;
        }
        if (!actionPlanForm.startDate || !actionPlanForm.sla) {
            setToast({ message: "Data de início e SLA são obrigatórios.", type: "error" });
            return;
        }

        const newPlan = {
            id: crypto.randomUUID(),
            type: actionModalType,
            stage_id: actionPlanForm.stageId,
            stage_name: actionPlanForm.stageName,
            start_date: actionPlanForm.startDate,
            sla: parseInt(actionPlanForm.sla),
            end_date: actionPlanForm.endDate,
            description: actionPlanForm.description
        };

        const currentActionPlans = planning.data.action_plans || [];
        const updatedPlans = [...currentActionPlans, newPlan];

        try {
            await axios.put(`${import.meta.env.VITE_API_BASE_URL}/plannings/${selectedPlanningId}`, {
                ...planning,
                data: {
                    ...planning.data,
                    action_plans: updatedPlans
                }
            }, {
                headers: { Authorization: `Bearer ${await getAuthToken()}` }
            });

            setToast({ message: "Plano de ação criado com sucesso!", type: "success" });
            fetchPlannings(); // Refresh data
            setIsActionModalOpen(false);
            setActionPlanForm({
                stageId: "",
                stageName: "",
                startDate: "",
                sla: "",
                endDate: "",
                description: ""
            });
        } catch (error) {
            console.error("Erro ao criar plano de ação:", error);
            setToast({ message: "Erro ao criar plano de ação.", type: "error" });
        }
    };

    // Fetch Data on Mount
    useEffect(() => {
        fetchWorks();
        fetchPlannings();
    }, []);

    const fetchWorks = async () => {
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
            setToast({ message: "Erro ao carregar obras.", type: "error" });
        }
    };

    const fetchPlannings = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setPlannings(await response.json());
            }
        } catch (error) {
            console.error("Error fetching plannings:", error);
        }
    };

    const handleNewPlanning = () => {
        setSelectedWorkId(""); // Reset selection
        setIsModalOpen(true);
    };

    const handleCreatePlanning = async () => {
        if (!selectedWorkId) {
            setToast({ message: "Selecione uma obra.", type: "error" });
            return;
        }

        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    work_id: selectedWorkId,
                    status: "Draft",
                    data: {}
                })
            });

            if (response.ok) {
                setToast({ message: `Planejamento criado para obra ID: ${selectedWorkId}`, type: "success" });
                setIsModalOpen(false);
                fetchPlannings(); // Refresh list
            } else {
                setToast({ message: "Erro ao criar planejamento.", type: "error" });
            }
        } catch (error) {
            console.error("Error creating planning:", error);
            setToast({ message: "Erro ao conectar com servidor.", type: "error" });
        }
    };

    // STAGES DEFINITION
    const STAGES = [
        { name: "Contrato Assinado", sla: 1 },
        { name: "Layout aprovado", sla: 1 },
        { name: "Projetos - Solicitação LPU", sla: 1 },
        { name: "Projetos - Recebimento LPU", sla: 2 },
        { name: "Projetos - Validação de LPU", sla: 1 },
        { name: "Projetos - Envio para aprovação LPU", sla: 1 },
        { name: "Projetos - Aprovação de custos", sla: 1 },
        { name: "Projetos - Emissão de Ordem de Compra", sla: 10 },
        { name: "Projetos - Elaboração", sla: 10 },
        { name: "Projetos - Validação técnica", sla: 3 },
        { name: "Projetos - Projeto validado", sla: 3 },
        { name: "Obras - Solicitação LPU", sla: 2 },
        { name: "Obras - Recebimento LPU", sla: 7 },
        { name: "Obras - Validação de LPU", sla: 2 },
        { name: "Obras - Envio para aprovação LPU", sla: 2 },
        { name: "Obras - Aprovação de custos", sla: 2 },
        { name: "Obras - Emissão de Ordem de Compra", sla: 15 },
        { name: "Gerenciamento - Documentação", sla: 1 },
        { name: "Gerenciamento - Integração", sla: 3 },
        { name: "Gerenciamento - Assinatura documentos", sla: 3 },
        { name: "Gerenciamento - Kickoff Construtora", sla: 1 },
        { name: "Gerenciamento - Comunicar início de obras", sla: 1 },
        { name: "Gerenciamento - Acompanhamento de obras", sla: 50 },
        { name: "Gerenciamento - Comunicar Término", sla: 1 },
        { name: "CloseOut - CheckList", sla: 15 },
        { name: "CloseOut - Vistoria", sla: 15 },
        { name: "CloseOut - GoLive", sla: 0 } // Anchor
    ];

    // Helper to calculate date minus days
    const subDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        const [y, m, d] = dateString.split("-");
        return `${d}/${m}/${y}`;
    };

    const getStatusParams = (diff: number) => {
        if (diff < 0) return { text: `Adiantado ${Math.abs(diff)} dias`, color: "bg-green-100 text-green-700" };
        if (diff > 0) return { text: `Atrasado ${Math.abs(diff)} dias`, color: "bg-red-100 text-red-700" };
        return { text: "No prazo", color: "bg-gray-100 text-gray-700" };
    };

    const calculateSchedule = (goLiveDate: string, currentSchedule: any[] = []) => {
        if (!goLiveDate) return [];

        const scheduleMap = new Map(currentSchedule.map(item => [item.name, item]));
        let calculated = [];
        // We calculate BACKWARDS from GoLive
        let currentEndDate = new Date(goLiveDate);

        // Reverse stages (GoLive first)
        const reversedStages = [...STAGES].reverse();

        for (const stage of reversedStages) {
            const existing = scheduleMap.get(stage.name) || {};

            let endPlanned = new Date(currentEndDate);
            let startPlanned = subDays(endPlanned, stage.sla);

            // For the Anchor (GoLive), Start = End
            if (stage.sla === 0) {
                startPlanned = endPlanned;
            }

            calculated.unshift({
                name: stage.name,
                sla: stage.sla,
                start_planned: startPlanned.toISOString().split('T')[0],
                end_planned: endPlanned.toISOString().split('T')[0],
                start_real: existing.start_real || "",
                end_real: existing.end_real || "",
                responsible: existing.responsible || ""
            });

            // Next stage's END is this stage's START
            currentEndDate = startPlanned;
        }
        return calculated;
    };

    // When expanding, check if we need to initialize schedule
    const toggleExpand = (id: string, planningData: any) => {
        if (expandedId === id) {
            setExpandedId(null);
            setSelectedPlanningId(null);
        } else {
            setExpandedId(id);
            setSelectedPlanningId(id);
            setActiveTab("planning");

            // Initialize Schedule if empty
            if (!planningData.data?.schedule || planningData.data.schedule.length === 0) {
                const work = works.find(w => w.id === planningData.work_id);
                if (work && work.go_live_date) {
                    const newSchedule = calculateSchedule(work.go_live_date);
                    handleUpdatePlanning(planningData.id, { ...planningData, data: { ...planningData.data, schedule: newSchedule } });
                }
            }
        }
    };

    const handleUpdatePlanning = async (id: string, updatedPlanning: any) => {
        try {
            const token = await getAuthToken();
            // Optimistic update
            setPlannings(prev => prev.map(p => p.id === id ? updatedPlanning : p));

            await fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    work_id: updatedPlanning.work_id,
                    status: updatedPlanning.status,
                    data: updatedPlanning.data
                })
            });
        } catch (error) {
            console.error("Update error:", error);
            setToast({ message: "Erro ao salvar alteração.", type: "error" });
            fetchPlannings(); // Revert on error
        }
    };

    const handleScheduleChange = (planningId: string, stageName: string, field: string, value: string) => {
        const planning = plannings.find(p => p.id === planningId);
        if (!planning) return;

        const newSchedule = planning.data.schedule.map((item: any) => {
            if (item.name === stageName) {
                return { ...item, [field]: value };
            }
            return item;
        });

        handleUpdatePlanning(planningId, {
            ...planning,
            data: { ...planning.data, schedule: newSchedule }
        });
    };

    // METRICS CALCULATION RULES
    const calculateMetrics = (schedule: any[]) => {
        if (!schedule || schedule.length === 0) return null;

        let lastCompleted = null;
        let inProgress = null;
        let nextPlanned = null;

        // Find stages states
        for (let i = 0; i < schedule.length; i++) {
            const item = schedule[i];
            if (item.start_real && item.end_real) {
                lastCompleted = item;
            } else if (item.start_real && !item.end_real) {
                inProgress = item;
                // If we found in progress, the next one without start is "Next Planned" (if not found yet)
            } else if (!item.start_real && !nextPlanned) {
                nextPlanned = item;
            }
        }
        // If no inProgress found, the first one without start is Next Planned
        // If we are fully completed, nextPlanned remains null

        // Total Planned SLA (Days) - Contract (First) to GoLive (Last)
        const startPlanned = new Date(schedule[0].start_planned);
        const endPlanned = new Date(schedule[schedule.length - 1].end_planned);
        const totalPlannedDays = Math.ceil((endPlanned.getTime() - startPlanned.getTime()) / (1000 * 3600 * 24));

        // Total Real SLA (Days) - First Real Start to Last Real End
        let totalRealDays = 0;
        let firstRealStart = null;
        let lastRealEnd = null;

        // Find earliest start and latest end
        for (const item of schedule) {
            if (item.start_real) {
                const s = new Date(item.start_real);
                if (!firstRealStart || s < firstRealStart) firstRealStart = s;
            }
            if (item.end_real) {
                const e = new Date(item.end_real);
                if (!lastRealEnd || e > lastRealEnd) lastRealEnd = e;
            }
        }

        if (firstRealStart && lastRealEnd) {
            totalRealDays = Math.ceil((lastRealEnd.getTime() - firstRealStart.getTime()) / (1000 * 3600 * 24));
        }

        return {
            lastCompleted: lastCompleted?.name || "-",
            inProgress: inProgress?.name || "-",
            nextPlanned: nextPlanned?.name || "-",
            totalPlannedDays,
            totalRealDays
        };
    };

    // Helper to get work name
    const getWorkName = (workId: string) => {
        const work = works.find(w => w.id === workId);
        return work ? `Obra ${work.id} (${work.regional})` : `Obra ${workId}`;
    };

    // Filter State
    const [filterText, setFilterText] = useState("");
    const [filterDateRange, setFilterDateRange] = useState({ start: "", end: "" });

    // Filter Logic
    const filteredPlannings = plannings.filter(planning => {
        const work = works.find(w => w.id === planning.work_id);
        if (!work) return false;

        // Text Search
        const searchText = filterText.toLowerCase();
        const workSearchString = `${work.id} ${work.regional} ${work.site || ''} ${work.address || ''} ${work.city || ''} ${work.state || ''}`.toLowerCase();
        const matchesText = workSearchString.includes(searchText);

        // Date Range
        let matchesDate = true;
        if (filterDateRange.start && filterDateRange.end) {
            const startDate = new Date(filterDateRange.start);
            const endDate = new Date(filterDateRange.end);

            // Check based on Go Live Date (Anchor)
            // Or strictly speaking, we could check if the project *duration* overlaps.
            // For now, let's check if Go Live Date is within the range, as it's the primary date.
            const targetDate = work.go_live_date ? new Date(work.go_live_date) : null;
            if (targetDate) {
                matchesDate = targetDate >= startDate && targetDate <= endDate;
            } else {
                matchesDate = false; // No date to compare
            }
        }

        return matchesText && matchesDate;
    });

    const onDragEnd = (result: any) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;

        const planning = plannings.find(p => p.id === draggableId);
        if (planning) {
            const newStatus = destination.droppableId;
            handleUpdatePlanning(planning.id, { ...planning, status: newStatus });
            setToast({ message: `Status atualizado para ${newStatus}`, type: "success" });
        }
    };

    return (
        <div className="relative min-h-full w-full">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Sidebar Actions */}
            <div className="fixed right-0 top-20 h-[calc(100vh-5rem)] w-80 p-6 overflow-y-auto z-10 hidden lg:block custom-scrollbar">
                {/* Actions Section */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl mb-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ações</h3>

                    <button
                        onClick={handleNewPlanning}
                        className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            </div>
                            Novo Planejamento
                        </div>
                    </button>

                    <div className="flex gap-2 mt-2 p-1 bg-white/50 rounded-xl border border-blue-50/50">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Lista
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Kanban
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl mb-6">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filtros</h3>

                    {/* Text Filter */}
                    <div>
                        <input
                            type="text"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            placeholder="Site, regional, endereço..."
                            className="w-full text-sm border-gray-200 rounded-lg bg-white/80 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none p-2.5 transition-all shadow-sm placeholder:text-gray-400"
                        />
                    </div>

                    {/* Date Range Filter */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">De</label>
                            <input
                                type="date"
                                value={filterDateRange.start}
                                onChange={(e) => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
                                className="w-full text-xs border-gray-200 rounded-lg bg-white/80 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none p-2 transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Até</label>
                            <input
                                type="date"
                                value={filterDateRange.end}
                                onChange={(e) => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
                                className="w-full text-xs border-gray-200 rounded-lg bg-white/80 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none p-2 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    {/* Clear Filters */}
                    {(filterText || filterDateRange.start || filterDateRange.end) && (
                        <button
                            onClick={() => { setFilterText(""); setFilterDateRange({ start: "", end: "" }); }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium underline mt-1 text-center"
                        >
                            Limpar Filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="mr-0 lg:mr-80 px-4 sm:px-8 py-8 w-auto mx-0">
                {/* Metrics Ticker */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {['Rascunho', 'Ativo', 'Concluído'].map(status => (
                        <div key={status} className="bg-white/40 backdrop-blur-xl border border-white/50 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{status}</p>
                                <p className="text-2xl font-bold text-gray-800">{filteredPlannings.filter(p => (p.status || 'Rascunho') === status).length}</p>
                            </div>
                            <div className={`w-2 h-10 rounded-full ${status === 'Ativo' ? 'bg-blue-500' : status === 'Concluído' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        </div>
                    ))}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-blue-100 mb-1">Total</p>
                            <p className="text-2xl font-bold">{filteredPlannings.length}</p>
                        </div>
                    </div>
                </div>

                {/* Active Filter Chips */}
                {(filterText || filterDateRange.start) && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {filterText && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                Busca: {filterText}
                                <button onClick={() => setFilterText("")} className="hover:text-blue-900"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </span>
                        )}
                        {filterDateRange.start && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                Período: {formatDate(filterDateRange.start)} - {formatDate(filterDateRange.end)}
                                <button onClick={() => setFilterDateRange({ start: "", end: "" })} className="hover:text-purple-900"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </span>
                        )}
                        <button onClick={() => { setFilterText(""); setFilterDateRange({ start: "", end: "" }); }} className="text-xs text-gray-500 hover:text-gray-700 underline px-2">Limpar tudo</button>
                    </div>
                )}

                <div className={viewMode === 'list' || filteredPlannings.length === 0 ? "grid grid-cols-1 gap-6" : "h-full"}>
                    {filteredPlannings.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                            <div className="flex flex-col items-center justify-center text-gray-400 py-12">
                                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <h3 className="text-lg font-medium text-gray-500">Nenhum planejamento encontrado</h3>
                                <p className="text-sm">{filterText || filterDateRange.start ? "Tente ajustar os filtros." : "Selecione 'Novo Planejamento' para começar."}</p>
                            </div>
                        </div>
                    ) : viewMode === 'list' ? (
                        filteredPlannings.map((planning) => {
                            const metrics = calculateMetrics(planning.data?.schedule || []);

                            return (
                                <div
                                    key={planning.id}
                                    className={`rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg transition-all duration-300 overflow-hidden ${expandedId === planning.id ? 'ring-2 ring-blue-500/20' : 'hover:scale-[1.01]'
                                        }`}
                                >
                                    {/* Card Header / Summary */}
                                    <div
                                        className="p-6 cursor-pointer flex items-center justify-between"
                                        onClick={() => toggleExpand(planning.id, planning)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{getWorkName(planning.work_id)}</h3>
                                                <p className="text-sm text-gray-500">Status: {planning.status || 'Rascunho'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                title="Editar"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPlanningToEdit(planning);
                                                    setEditForm({ status: planning.status || 'Rascunho' });
                                                    setIsEditModalOpen(true);
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                title="Excluir"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPlanningToDelete(planning.id);
                                                    setIsDeleteModalOpen(true);
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                            <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 transition-transform duration-300 ${expandedId === planning.id ? 'rotate-180' : ''}`}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {expandedId === planning.id && (
                                        <div className="border-t border-gray-100 bg-white/40">

                                            {/* Tabs */}
                                            <div className="flex border-b border-gray-200 overflow-x-auto">
                                                {[
                                                    { id: 'planning', label: 'Planejamento' },
                                                    { id: 'gantt', label: 'Gantt' },
                                                    { id: 'action_plan', label: 'Plano de Ação' }
                                                ].map((tab) => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id)}
                                                        className={`px-6 py-4 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.id
                                                            ? 'text-blue-600'
                                                            : 'text-gray-500 hover:text-gray-700'
                                                            }`}
                                                    >
                                                        {tab.label}
                                                        {activeTab === tab.id && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Content */}
                                            <div className="p-6">
                                                {activeTab === 'planning' && (
                                                    <div>
                                                        {/* Dashboard Metrics */}
                                                        {metrics && (
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                                                <div className="p-4 bg-white/50 rounded-xl border border-blue-100/50 shadow-sm">
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Última Concluída</p>
                                                                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{metrics.lastCompleted}</p>
                                                                </div>
                                                                <div className="p-4 bg-white/50 rounded-xl border border-blue-100/50 shadow-sm">
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Em Andamento</p>
                                                                    <p className="text-sm font-semibold text-blue-600 line-clamp-2">{metrics.inProgress}</p>
                                                                </div>
                                                                <div className="p-4 bg-white/50 rounded-xl border border-blue-100/50 shadow-sm">
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Próxima Prevista</p>
                                                                    <p className="text-sm font-semibold text-gray-500 line-clamp-2">{metrics.nextPlanned}</p>
                                                                </div>
                                                                <div className="p-4 bg-white/50 rounded-xl border border-blue-100/50 shadow-sm">
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">SLA Total</p>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-sm font-semibold text-gray-900">{metrics.totalPlannedDays}d Prev</span>
                                                                        <span className={`text-xs font-medium ${metrics.totalRealDays > metrics.totalPlannedDays ? 'text-red-500' : 'text-green-600'}`}>
                                                                            ({metrics.totalRealDays > 0 ? metrics.totalRealDays : '-'}d Real)
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                            <table className="w-full text-sm text-left table-fixed">
                                                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 text-xs uppercase tracking-wider">
                                                                    <tr>
                                                                        <th className="px-4 py-3 w-[25%]">Etapa (SLA)</th>
                                                                        <th className="px-2 py-3 w-[20%] text-center">Início</th>
                                                                        <th className="px-2 py-3 w-[20%] text-center">Término</th>
                                                                        <th className="px-2 py-3 w-[15%] text-center">Status</th>
                                                                        <th className="px-4 py-3 w-[20%]">Responsável</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 bg-white text-xs">
                                                                    {(!planning.data?.schedule || planning.data.schedule.length === 0) ? (
                                                                        <tr>
                                                                            <td colSpan={5} className="py-8 text-center text-gray-500">
                                                                                <div className="flex flex-col items-center gap-2">
                                                                                    <p>Nenhum cronograma gerado para este planejamento.</p>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const work = works.find(w => w.id === planning.work_id);
                                                                                            if (!work?.go_live_date) {
                                                                                                setToast({ message: "A obra associada não possui Data de Go-Live definida.", type: "error" });
                                                                                                return;
                                                                                            }
                                                                                            const newSchedule = calculateSchedule(work.go_live_date);
                                                                                            handleUpdatePlanning(planning.id, { ...planning, data: { ...planning.data, schedule: newSchedule } });
                                                                                            setToast({ message: "Cronograma gerado com sucesso!", type: "success" });
                                                                                        }}
                                                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                                                                                    >
                                                                                        Gerar Cronograma Automático
                                                                                    </button>
                                                                                    <p className="text-[10px] text-gray-400 mt-1">Baseado na data de Go-Live da Obra</p>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        planning.data.schedule.map((item: any, idx: number) => {
                                                                            // Calculate Status
                                                                            let startStatus = null;
                                                                            let realDuration = null;

                                                                            if (item.start_real && item.start_planned) {
                                                                                const diff = (new Date(item.start_real).getTime() - new Date(item.start_planned).getTime()) / (1000 * 3600 * 24);
                                                                                startStatus = getStatusParams(diff);
                                                                            }

                                                                            if (item.start_real && item.end_real) {
                                                                                realDuration = Math.ceil((new Date(item.end_real).getTime() - new Date(item.start_real).getTime()) / (1000 * 3600 * 24));
                                                                                if (realDuration < 0) realDuration = 0; // Sanity check
                                                                            }

                                                                            return (
                                                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                                                    <td className="px-4 py-2 font-medium text-gray-900 border-r border-gray-100">
                                                                                        <div className="line-clamp-2" title={item.name}>{item.name}</div>
                                                                                        <span className="text-[10px] text-gray-400 font-normal">{item.sla} dias</span>
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                                                                        <div className="flex flex-col gap-1 items-center">
                                                                                            <span className="text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded text-[10px] w-full max-w-[80px]">
                                                                                                Prev: {formatDate(item.start_planned)}
                                                                                            </span>
                                                                                            <input
                                                                                                type="date"
                                                                                                value={item.start_real}
                                                                                                onChange={(e) => handleScheduleChange(planning.id, item.name, 'start_real', e.target.value)}
                                                                                                className="w-full max-w-[110px] rounded border-gray-200 text-xs py-0.5 px-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-7"
                                                                                            />
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                                                                        <div className="flex flex-col gap-1 items-center">
                                                                                            <span className="text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded text-[10px] w-full max-w-[80px]">
                                                                                                Prev: {formatDate(item.end_planned)}
                                                                                            </span>
                                                                                            <input
                                                                                                type="date"
                                                                                                value={item.end_real}
                                                                                                onChange={(e) => handleScheduleChange(planning.id, item.name, 'end_real', e.target.value)}
                                                                                                className="w-full max-w-[110px] rounded border-gray-200 text-xs py-0.5 px-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-7"
                                                                                            />
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                                                                        <div className="flex flex-col gap-1 items-center">
                                                                                            {startStatus ? (
                                                                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium w-full ${startStatus.color}`}>
                                                                                                    {startStatus.text}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-gray-300">-</span>
                                                                                            )}
                                                                                            {realDuration !== null && (
                                                                                                <span className={`text-[10px] font-medium ${realDuration > item.sla ? 'text-red-600' : 'text-green-600'}`}>
                                                                                                    SLA: {realDuration} dias
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-4 py-2">
                                                                                        <input
                                                                                            type="text"
                                                                                            value={item.responsible}
                                                                                            onChange={(e) => handleScheduleChange(planning.id, item.name, 'responsible', e.target.value)}
                                                                                            placeholder="Nome..."
                                                                                            className="w-full rounded border-gray-200 text-xs py-1 px-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                                                        />
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                                {activeTab === 'gantt' && (
                                                    <div className="flex flex-col gap-6">
                                                        {/* Gantt Controls */}
                                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                                                            {/* Type Toggle */}
                                                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                                                <button
                                                                    onClick={() => setGanttType('planning')}
                                                                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${ganttType === 'planning' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    Cronograma Planejamento
                                                                </button>
                                                                <button
                                                                    onClick={() => setGanttType('construction')}
                                                                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${ganttType === 'construction' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                                                        }`}
                                                                >
                                                                    Cronograma Obra
                                                                </button>
                                                            </div>

                                                            {/* View Filters */}
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Visualizar por:</span>
                                                                <div className="flex border border-gray-200 rounded-lg overflow-hidden divide-x divide-gray-200">
                                                                    {[
                                                                        { id: 'day', label: 'Dia' },
                                                                        { id: 'week', label: 'Semana' },
                                                                        { id: 'month', label: 'Mês' }
                                                                    ].map((v) => (
                                                                        <button
                                                                            key={v.id}
                                                                            onClick={() => setGanttView(v.id as any)}
                                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${ganttView === v.id ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'
                                                                                }`}
                                                                        >
                                                                            {v.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Chart Area */}
                                                        <div className="flex flex-col gap-4">
                                                            {ganttType === 'construction' && (
                                                                <div className="flex justify-end">
                                                                    <button
                                                                        onClick={() => {
                                                                            setNewStageForm({
                                                                                name: "",
                                                                                showPlanned: false, startPlanned: "", endPlanned: "",
                                                                                showReal: false, startReal: "", endReal: "",
                                                                                showResponsible: false, responsible: "",
                                                                                showSLA: false, sla: "",
                                                                                showDesc: false, description: "",
                                                                                isEditingIdx: -1
                                                                            });
                                                                            setSelectedPlanningId(planning.id);
                                                                            setIsStageModalOpen(true);
                                                                        }}
                                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2"
                                                                    >
                                                                        <span className="text-sm">+</span> Nova Etapa
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar border rounded-xl bg-slate-50 relative shadow-inner">
                                                                {(() => {
                                                                    const schedule = ganttType === 'planning'
                                                                        ? (planning.data?.schedule || [])
                                                                        : (planning.data?.construction_schedule || []);

                                                                    if (schedule.length === 0) return <div className="text-center py-12 text-gray-400">Sem dados de cronograma.</div>;

                                                                    // 1. Calculate Timeline Range
                                                                    const dates = schedule.map((s: any) => [
                                                                        s.start_planned ? new Date(s.start_planned) : null,
                                                                        s.end_planned ? new Date(s.end_planned) : null,
                                                                        s.start_real ? new Date(s.start_real) : null,
                                                                        s.end_real ? new Date(s.end_real) : null
                                                                    ]).flat().filter((d: Date | null): d is Date => d !== null);

                                                                    const validDates = dates.filter((d: any) => !isNaN(d.getTime()));
                                                                    if (validDates.length === 0) return <div className="text-center py-12 text-gray-400">Datas inválidas ou não definidas.</div>;

                                                                    const minDate = new Date(Math.min(...validDates.map((d: any) => d.getTime())));
                                                                    const maxDate = new Date(Math.max(...validDates.map((d: any) => d.getTime())));

                                                                    // Add Buffer
                                                                    minDate.setDate(minDate.getDate() - (ganttView === 'month' ? 30 : 7));
                                                                    maxDate.setDate(maxDate.getDate() + (ganttView === 'month' ? 60 : 14));

                                                                    // Config
                                                                    const pxPerDay = ganttView === 'week' ? 10 : ganttView === 'month' ? 4 : 40;
                                                                    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
                                                                    const totalWidth = totalDays * pxPerDay;

                                                                    // 2. Generate Grid Headers
                                                                    const headers: Date[] = [];
                                                                    const current = new Date(minDate);
                                                                    if (ganttView === 'week') {
                                                                        const day = current.getDay();
                                                                        const diff = current.getDate() - day + (day === 0 ? -6 : 1);
                                                                        current.setDate(diff); // Snap to Monday
                                                                    } else if (ganttView === 'month') {
                                                                        current.setDate(1); // Snap to 1st
                                                                    }
                                                                    // Ensure start time 00:00
                                                                    current.setHours(0, 0, 0, 0);

                                                                    while (current <= maxDate) {
                                                                        headers.push(new Date(current));
                                                                        if (ganttView === 'week') current.setDate(current.getDate() + 7);
                                                                        else if (ganttView === 'month') current.setMonth(current.getMonth() + 1);
                                                                        else current.setDate(current.getDate() + 1);
                                                                    }

                                                                    return (
                                                                        <div className="relative min-w-full" style={{ width: Math.max(800, totalWidth + 300) + 'px' }}>
                                                                            {/* Header Row */}
                                                                            <div className="flex border-b border-gray-200 mb-2 sticky top-0 bg-white/95 backdrop-blur-sm z-20 shadow-sm h-12">
                                                                                <div className="w-64 flex-shrink-0 p-3 text-xs font-bold text-gray-500 uppercase flex items-end sticky left-0 bg-white z-30 border-r border-gray-100 shadow-[1px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                                                    Etapa
                                                                                </div>
                                                                                <div className="flex-1 relative h-full">
                                                                                    {headers.map((date, i) => {
                                                                                        const offset = Math.ceil((date.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
                                                                                        return (
                                                                                            <div
                                                                                                key={i}
                                                                                                className="absolute bottom-0 border-l border-gray-100 h-6 flex items-end pb-1 text-[10px] text-gray-500 font-medium whitespace-nowrap pl-1"
                                                                                                style={{ left: `${offset * pxPerDay}px` }}
                                                                                            >
                                                                                                {ganttView === 'month'
                                                                                                    ? date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                                                                                                    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                                                                                                }
                                                                                            </div>
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                            </div>

                                                                            {/* Rows */}
                                                                            <div className="space-y-1 pb-4">
                                                                                {schedule.map((item: any, idx: number) => {
                                                                                    const start = item.start_planned ? new Date(item.start_planned) : minDate;
                                                                                    const end = item.end_planned ? new Date(item.end_planned) : start;
                                                                                    const hasPlanned = !!item.start_planned;

                                                                                    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                                                                                    const offsetDays = Math.ceil((start.getTime() - minDate.getTime()) / (1000 * 3600 * 24));

                                                                                    // Realized
                                                                                    let realStart = item.start_real ? new Date(item.start_real) : null;
                                                                                    let realEnd = item.end_real ? new Date(item.end_real) : null;
                                                                                    let realDuration = 0;
                                                                                    let realOffset = 0;
                                                                                    let barColor = "bg-gray-400";
                                                                                    let statusText = "Não iniciado";

                                                                                    if (realStart) {
                                                                                        const effectiveEnd = realEnd || new Date();
                                                                                        realDuration = Math.ceil((effectiveEnd.getTime() - realStart.getTime()) / (1000 * 3600 * 24)) + 1;
                                                                                        realOffset = Math.ceil((realStart.getTime() - minDate.getTime()) / (1000 * 3600 * 24));

                                                                                        if (realEnd) {
                                                                                            statusText = "Concluído";
                                                                                            if (hasPlanned && realEnd <= end) {
                                                                                                barColor = "bg-green-500";
                                                                                                statusText += " (No prazo)";
                                                                                            } else {
                                                                                                barColor = "bg-red-500";
                                                                                                statusText += " (Atrasado)";
                                                                                            }
                                                                                        } else {
                                                                                            statusText = "Em Andamento";
                                                                                            barColor = "bg-amber-400";
                                                                                        }
                                                                                    }

                                                                                    // Reuse existing SLA logic (simplified here for brevity, keeping existing color logic roughly)
                                                                                    if (ganttType === 'construction' && item.sla_limit && realStart) {
                                                                                        const effEnd = realEnd || new Date();
                                                                                        const currDur = Math.ceil((effEnd.getTime() - realStart.getTime()) / (1000 * 3600 * 24));
                                                                                        const ratio = currDur / item.sla_limit;
                                                                                        if (ratio < 0.5) barColor = "bg-green-500";
                                                                                        else if (ratio < 0.9) barColor = "bg-yellow-500";
                                                                                        else barColor = "bg-red-500";
                                                                                        statusText += ` (SLA: ${currDur}/${item.sla_limit})`;
                                                                                    }

                                                                                    return (
                                                                                        <div key={idx} className="flex items-center hover:bg-blue-50/30 group py-1.5 transition-colors relative">
                                                                                            {/* Grid Lines */}
                                                                                            <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ marginLeft: '256px' }}>
                                                                                                {headers.map((d, hi) => {
                                                                                                    const offset = Math.ceil((d.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
                                                                                                    return (
                                                                                                        <div key={hi} className="absolute border-l border-gray-100/50 h-full" style={{ left: `${offset * pxPerDay}px` }}></div>
                                                                                                    )
                                                                                                })}
                                                                                            </div>

                                                                                            <div className="w-64 flex-shrink-0 px-4 text-xs font-medium text-gray-700 truncate border-r border-gray-100 flex justify-between items-center bg-white/50 sticky left-0 z-10 h-full">
                                                                                                <span title={item.name}>{item.name}</span>
                                                                                                {ganttType === 'construction' && (
                                                                                                    <button
                                                                                                        className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 font-bold px-1"
                                                                                                        onClick={() => {
                                                                                                            setNewStageForm({
                                                                                                                ...newStageForm,
                                                                                                                name: item.name,
                                                                                                                showPlanned: !!item.start_planned, startPlanned: item.start_planned || "", endPlanned: item.end_planned || "",
                                                                                                                showReal: !!item.start_real, startReal: item.start_real || "", endReal: item.end_real || "",
                                                                                                                showResponsible: !!item.responsible, responsible: item.responsible || "",
                                                                                                                showSLA: !!item.sla_limit, sla: item.sla_limit?.toString() || "",
                                                                                                                showDesc: !!item.description, description: item.description || "",
                                                                                                                isEditingIdx: idx
                                                                                                            });
                                                                                                            setSelectedPlanningId(planning.id);
                                                                                                            setIsStageModalOpen(true);
                                                                                                        }}
                                                                                                    >
                                                                                                        ✏️
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>

                                                                                            <div className="flex-1 relative h-6">
                                                                                                {/* Planned */}
                                                                                                {hasPlanned && (
                                                                                                    <div
                                                                                                        className="absolute top-0.5 h-2 rounded-full bg-blue-200 opacity-60 group-hover:opacity-100 transition-all border border-blue-300/50"
                                                                                                        style={{
                                                                                                            left: `${offsetDays * pxPerDay}px`,
                                                                                                            width: `${Math.max(duration * pxPerDay, 4)}px`,
                                                                                                        }}
                                                                                                    />
                                                                                                )}
                                                                                                {/* Realized */}
                                                                                                {realStart && (
                                                                                                    <div
                                                                                                        className={`absolute top-2 h-3 rounded-full shadow-sm cursor-help transition-all hover:scale-y-110 hover:shadow-md z-1 ${barColor}`}
                                                                                                        style={{
                                                                                                            left: `${realOffset * pxPerDay}px`,
                                                                                                            width: `${Math.max(realDuration * pxPerDay, 4)}px`,
                                                                                                        }}
                                                                                                        title={`${item.name}\n[REALIZADO] ${statusText}\nInício: ${formatDate(item.start_real)}\nFim: ${item.end_real ? formatDate(item.end_real) : 'Em andamento'}`}
                                                                                                    />
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>


                                                    </div>
                                                )}
                                                {activeTab === 'action_plan' && (
                                                    <div className="flex flex-col gap-6">
                                                        {/* Header Actions */}
                                                        <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                            <div className="flex gap-3">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPlanningId(planning.id);
                                                                        setActionModalType('planning');
                                                                        setIsActionModalOpen(true);
                                                                    }}
                                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                                    </svg>
                                                                    Criar plano em planejamento
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPlanningId(planning.id);
                                                                        setActionModalType('construction');
                                                                        setIsActionModalOpen(true);
                                                                    }}
                                                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                                    </svg>
                                                                    Criar plano em Obra
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Action Plans List */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {(!planning.data?.action_plans || planning.data.action_plans.length === 0) ? (
                                                                <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                                                                    Nenhum plano de ação criado ainda.
                                                                </div>
                                                            ) : (
                                                                planning.data.action_plans.map((plan: any, idx: number) => (
                                                                    <div key={plan.id || idx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                                        <div className={`absolute top-0 left-0 w-1 h-full ${plan.type === 'planning' ? 'bg-blue-500' : 'bg-green-500'}`} />

                                                                        <div className="flex justify-between items-start mb-3 pl-2">
                                                                            <div>
                                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${plan.type === 'planning' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                                                                    {plan.type === 'planning' ? 'Planejamento' : 'Obra'}
                                                                                </span>
                                                                                <h4 className="font-bold text-gray-900 mt-2 text-sm">{plan.stage_name}</h4>
                                                                            </div>
                                                                            <button className="text-gray-300 hover:text-red-500 transition-colors">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>

                                                                        <p className="text-gray-600 text-xs mb-4 line-clamp-2 pl-2 min-h-[32px]">{plan.description}</p>

                                                                        <div className="flex items-center gap-2 text-[10px] text-gray-500 pl-2 border-t border-gray-100 pt-3">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-semibold text-gray-400 uppercase text-[9px]">Início</span>
                                                                                <span>{new Date(plan.start_date).toLocaleDateString()}</span>
                                                                            </div>
                                                                            <div className="h-4 w-px bg-gray-200 mx-1"></div>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-semibold text-gray-400 uppercase text-[9px]">SLA</span>
                                                                                <span>{plan.sla} dias</span>
                                                                            </div>
                                                                            <div className="h-4 w-px bg-gray-200 mx-1"></div>
                                                                            <div className="flex flex-col">
                                                                                <span className="font-semibold text-gray-400 uppercase text-[9px]">Fim</span>
                                                                                <span className="font-semibold text-gray-700">{new Date(plan.end_date).toLocaleDateString()}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="flex gap-6 overflow-x-auto pb-4 h-full snap-x snap-mandatory px-2">
                                {['Rascunho', 'Ativo', 'Concluído'].map(status => (
                                    <Droppable key={status} droppableId={status}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className="min-w-[260px] w-full md:w-1/3 flex-1 bg-white/30 backdrop-blur-md rounded-2xl p-4 flex flex-col h-full border border-white/40 shadow-lg snap-center"
                                            >
                                                <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center justify-between sticky top-0 bg-white/20 backdrop-blur-sm p-2 rounded-lg z-10">
                                                    {status}
                                                    <span className="bg-white/80 px-2 py-0.5 rounded-full text-xs shadow-sm font-mono text-blue-600">
                                                        {filteredPlannings.filter(p => (p.status || 'Rascunho') === status).length}
                                                    </span>
                                                </h3>
                                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar p-1">
                                                    {filteredPlannings.filter(p => (p.status || 'Rascunho') === status).map((planning, index) => (
                                                        <Draggable key={planning.id} draggableId={planning.id} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    className={`p-4 rounded-xl border border-white transition-all cursor-pointer group ${snapshot.isDragging ? 'bg-blue-50 shadow-2xl rotate-2 scale-105 z-50' : 'bg-white/80 shadow-sm hover:shadow-md hover:scale-[1.02]'}`}
                                                                    onClick={() => toggleExpand(planning.id, planning)}
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <p className="font-bold text-sm text-gray-900 line-clamp-2">{getWorkName(planning.work_id)}</p>
                                                                        <div className={`w-2 h-2 rounded-full ${planning.status === 'Ativo' ? 'bg-blue-500' : planning.status === 'Concluído' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                                    </div>

                                                                    {/* Mini Metrics */}
                                                                    <div className="flex items-center gap-3 text-[10px] text-gray-500 bg-white/50 p-2 rounded-lg">
                                                                        <div className="flex flex-col">
                                                                            <span className="uppercase text-[8px] font-bold text-gray-400">Progresso</span>
                                                                            <span className="text-blue-600 font-bold">{calculateMetrics(planning.data?.schedule)?.inProgress || '-'}</span>
                                                                        </div>
                                                                        <div className="h-6 w-px bg-gray-200"></div>
                                                                        <div className="flex flex-col">
                                                                            <span className="uppercase text-[8px] font-bold text-gray-400">Próxima</span>
                                                                            <span>{calculateMetrics(planning.data?.schedule)?.nextPlanned || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            </div>
                                        )}
                                    </Droppable>
                                ))}
                            </div>
                        </DragDropContext>
                    )}
                </div>
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Planejamento">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Selecione a Obra</label>
                        <select
                            value={selectedWorkId}
                            onChange={(e) => setSelectedWorkId(e.target.value)}
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3 bg-white"
                        >
                            <option value="">Selecione...</option>
                            {works.map((work) => (
                                <option key={work.id} value={work.id}>
                                    {work.id} - {work.regional}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreatePlanning}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Construction Modal */}
            <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title="Nova Etapa de Obra">
                <div className="space-y-4 p-1">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Nome da Etapa</label>
                        <input
                            type="text"
                            value={newStageForm.name}
                            onChange={(e) => setNewStageForm({ ...newStageForm, name: e.target.value })}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Infraestrutura"
                        />
                    </div>

                    {/* Toggles Grid */}
                    <div className="space-y-3 pt-2">
                        {/* Planned Dates */}
                        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-700">Datas Planejadas</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={newStageForm.showPlanned} onChange={(e) => setNewStageForm({ ...newStageForm, showPlanned: e.target.checked })} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {newStageForm.showPlanned && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <input type="date" value={newStageForm.startPlanned} onChange={(e) => setNewStageForm({ ...newStageForm, startPlanned: e.target.value })} className="text-xs border border-gray-200 rounded p-1.5" />
                                    <input type="date" value={newStageForm.endPlanned} onChange={(e) => setNewStageForm({ ...newStageForm, endPlanned: e.target.value })} className="text-xs border border-gray-200 rounded p-1.5" />
                                </div>
                            )}
                        </div>

                        {/* Real Dates */}
                        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-700">Datas Reais</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={newStageForm.showReal} onChange={(e) => setNewStageForm({ ...newStageForm, showReal: e.target.checked })} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {newStageForm.showReal && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <input type="date" value={newStageForm.startReal} onChange={(e) => setNewStageForm({ ...newStageForm, startReal: e.target.value })} className="text-xs border border-gray-200 rounded p-1.5" />
                                    <input type="date" value={newStageForm.endReal} onChange={(e) => setNewStageForm({ ...newStageForm, endReal: e.target.value })} className="text-xs border border-gray-200 rounded p-1.5" />
                                </div>
                            )}
                        </div>

                        {/* Responsible */}
                        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-700">Responsável</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={newStageForm.showResponsible} onChange={(e) => setNewStageForm({ ...newStageForm, showResponsible: e.target.checked })} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {newStageForm.showResponsible && (
                                <input type="text" value={newStageForm.responsible} onChange={(e) => setNewStageForm({ ...newStageForm, responsible: e.target.value })} className="w-full text-xs border border-gray-200 rounded p-2" placeholder="Nome do responsável" />
                            )}
                        </div>

                        {/* SLA & Desc */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-700">Meta SLA</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={newStageForm.showSLA} onChange={(e) => setNewStageForm({ ...newStageForm, showSLA: e.target.checked })} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                {newStageForm.showSLA && (
                                    <input type="number" value={newStageForm.sla} onChange={(e) => setNewStageForm({ ...newStageForm, sla: e.target.value })} className="w-full text-xs border border-gray-200 rounded p-2" placeholder="Dias" />
                                )}
                            </div>
                            <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-700">Descrição</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={newStageForm.showDesc} onChange={(e) => setNewStageForm({ ...newStageForm, showDesc: e.target.checked })} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        {newStageForm.showDesc && (
                            <textarea value={newStageForm.description} onChange={(e) => setNewStageForm({ ...newStageForm, description: e.target.value })} className="w-full text-xs border border-gray-200 rounded p-2" placeholder="Detalhes da etapa..." rows={2} />
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-100">
                        <button onClick={() => setIsStageModalOpen(false)} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                        <button onClick={() => {
                            if (selectedPlanningId) {
                                const p = plannings.find(pl => pl.id === selectedPlanningId);
                                if (p) handleSaveConstructionStage(selectedPlanningId, p.data?.construction_schedule || []);
                            }
                        }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">Salvar</button>
                    </div>
                </div>
            </Modal>

            {/* Action Plan Modal */}
            <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={actionModalType === 'planning' ? "Criar Plano em Planejamento" : "Criar Plano em Obra"}>
                <div className="space-y-4 p-1">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Etapa de Origem</label>
                        <select
                            value={actionPlanForm.stageId}
                            onChange={(e) => setActionPlanForm({
                                ...actionPlanForm,
                                stageId: e.target.value,
                                stageName: e.target.options[e.target.selectedIndex].text
                            })}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">Selecione uma etapa...</option>
                            {(() => {
                                const planning = plannings.find(p => p.id === selectedPlanningId);
                                if (!planning) return null;
                                const source = actionModalType === 'planning' ?
                                    (planning.data?.schedule || []) :
                                    (planning.data?.construction_schedule || []);

                                return source.map((s: any, idx: number) => (
                                    <option key={s.id || idx} value={s.id || `temp-${idx}`}>{s.name || s.stage_name || `Etapa ${idx + 1}`}</option>
                                ));
                            })()}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Início</label>
                            <input
                                type="date"
                                value={actionPlanForm.startDate}
                                onChange={(e) => {
                                    const start = e.target.value;
                                    let end = "";
                                    if (start && actionPlanForm.sla) {
                                        const d = new Date(start);
                                        d.setDate(d.getDate() + parseInt(actionPlanForm.sla));
                                        end = d.toISOString().split('T')[0];
                                    }
                                    setActionPlanForm({ ...actionPlanForm, startDate: start, endDate: end });
                                }}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">SLA (Dias)</label>
                            <input
                                type="number"
                                value={actionPlanForm.sla}
                                onChange={(e) => {
                                    const sla = parseInt(e.target.value) || 0;
                                    const start = actionPlanForm.startDate;
                                    let end = "";
                                    if (start) {
                                        const d = new Date(start);
                                        d.setDate(d.getDate() + sla);
                                        end = d.toISOString().split('T')[0];
                                    }
                                    setActionPlanForm({ ...actionPlanForm, sla: e.target.value, endDate: end });
                                }}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Data de Fim (Calculada)</label>
                        <input
                            type="date"
                            value={actionPlanForm.endDate}
                            disabled
                            className="w-full text-sm border border-gray-200 bg-gray-50 rounded-lg p-2 text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Plano</label>
                        <textarea
                            value={actionPlanForm.description}
                            onChange={(e) => setActionPlanForm({ ...actionPlanForm, description: e.target.value })}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows={3}
                            placeholder="Descreva o plano de ação..."
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-100">
                        <button
                            onClick={() => setIsActionModalOpen(false)}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveActionPlan}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Custom Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Excluir Planejamento">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir este planejamento? Esta ação não pode ser desfeita e todos os dados associados (cronogramas, planos de ação) serão perdidos.
                    </p>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={async () => {
                                if (planningToDelete) {
                                    try {
                                        await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/plannings/${planningToDelete}`, {
                                            headers: { Authorization: `Bearer ${await getAuthToken()}` }
                                        });
                                        setToast({ message: "Planejamento excluído com sucesso!", type: "success" });
                                        fetchPlannings();
                                        setIsDeleteModalOpen(false);
                                        setPlanningToDelete(null);
                                    } catch (error) {
                                        console.error("Erro ao excluir:", error);
                                        setToast({ message: "Erro ao excluir planejamento.", type: "error" });
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Excluir Definitivamente
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Planning Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Planejamento">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3 bg-white"
                        >
                            <option value="Rascunho">Rascunho</option>
                            <option value="Ativo">Ativo</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Arquivado">Arquivado</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={async () => {
                                if (planningToEdit) {
                                    try {
                                        await axios.put(`${import.meta.env.VITE_API_BASE_URL}/plannings/${planningToEdit.id}`, {
                                            work_id: planningToEdit.work_id,
                                            status: editForm.status,
                                            data: planningToEdit.data
                                        }, {
                                            headers: { Authorization: `Bearer ${await getAuthToken()}` }
                                        });
                                        setToast({ message: "Planejamento atualizado!", type: "success" });
                                        fetchPlannings();
                                        setIsEditModalOpen(false);
                                    } catch (error) {
                                        console.error("Erro ao atualizar:", error);
                                        setToast({ message: "Erro ao atualizar planejamento.", type: "error" });
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
