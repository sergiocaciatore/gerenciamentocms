import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { getAuthToken } from "../../firebase";
import type { PlanningItem, PlanningStage, PlanningActionPlan } from "../../types/Planning";
import type { EngineeringWork } from "../../types/Engineering";
import LoadingSpinner from "../../components/LoadingSpinner";
import Pagination from "../../components/Pagination";

export default function Planning() {
    // State
    const [works, setWorks] = useState<EngineeringWork[]>([]);
    const [plannings, setPlannings] = useState<PlanningItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedWorkId, setSelectedWorkId] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("planning");
    const [selectedPlanningId, setSelectedPlanningId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

    // Gantt State
    const [ganttView, setGanttView] = useState<'day' | 'week' | 'month'>('month');
    const [ganttType, setGanttType] = useState<'planning' | 'construction'>('planning');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

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
    const [planningToEdit, setPlanningToEdit] = useState<PlanningItem | null>(null);
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
        isEditingIdx: -1
    });

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

    const fetchWorks = useCallback(async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works?limit=1000`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setWorks(await response.json());
            }
        } catch (error) {
            console.error("Error fetching works:", error);
            setToast({ message: "Erro ao carregar obras.", type: "error" });
        }
    }, []);

    const fetchPlannings = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                console.log("FETCH DEBUG: Raw Plannings Data:", data);
                if (data.length > 0) {
                    console.log("FETCH DEBUG: First Item Keys:", Object.keys(data[0]));
                    console.log("FETCH DEBUG: First Item ID:", data[0].id, " _id:", data[0]._id);
                }
                setPlannings(data);
            }
        } catch (error) {
            console.error("Error fetching plannings:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Fetch
    useEffect(() => {
        fetchWorks();
        fetchPlannings();
    }, [fetchWorks, fetchPlannings]);

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
                fetchPlannings();
            } else {
                setToast({ message: "Erro ao criar planejamento.", type: "error" });
            }
        } catch (error) {
            console.error("Error creating planning:", error);
            setToast({ message: "Erro ao conectar com servidor.", type: "error" });
        }
    };

    const handleUpdatePlanning = async (id: string, updatedPlanning: PlanningItem) => {
        console.log("handleUpdatePlanning called", { idToUpdate: id, newWorkId: updatedPlanning.work_id, newStatus: updatedPlanning.status });
        try {
            const token = await getAuthToken();
            setPlannings(prev => {
                const newState = prev.map(p => {
                     const isMatch = p.id === id;
                     if (isMatch) console.log("Updating item:", p.id);
                     return isMatch ? updatedPlanning : p;
                });
                console.log("New Plannings State Sample:", newState.slice(0, 3));
                return newState;
            });

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
            fetchPlannings();
        }
    };

    const handleSaveConstructionStage = async (planningId: string, currentSchedule: PlanningStage[]) => {
        if (!newStageForm.name) {
            setToast({ message: "Nome da etapa é obrigatório.", type: "error" });
            return;
        }

        const planning = plannings.find(p => p.id === planningId);
        if (!planning) return;

        const newItem: PlanningStage = {
            id: newStageForm.isEditingIdx >= 0 && currentSchedule[newStageForm.isEditingIdx] ? currentSchedule[newStageForm.isEditingIdx].id : crypto.randomUUID(),
            name: newStageForm.name,
            sla: newStageForm.showSLA ? parseInt(newStageForm.sla) || 0 : 0,
            start_planned: newStageForm.showPlanned ? newStageForm.startPlanned : null,
            end_planned: newStageForm.showPlanned ? newStageForm.endPlanned : null,
            start_real: newStageForm.showReal ? newStageForm.startReal : null,
            end_real: newStageForm.showReal ? newStageForm.endReal : null,
            responsible: newStageForm.showResponsible ? newStageForm.responsible : null,
            sla_limit: newStageForm.showSLA ? parseInt(newStageForm.sla) || 0 : null,
            description: newStageForm.showDesc ? newStageForm.description : null
        };

        const updatedSchedule = [...currentSchedule];
        if (newStageForm.isEditingIdx >= 0) {
            updatedSchedule[newStageForm.isEditingIdx] = newItem;
        } else {
            updatedSchedule.push(newItem);
        }

        const updatedPlanning = {
            ...planning,
            data: {
                ...planning.data,
                construction_schedule: updatedSchedule
            }
        };

        await handleUpdatePlanning(planningId, updatedPlanning);
        setToast({ message: "Etapa salva com sucesso!", type: "success" });
        setIsStageModalOpen(false);
        resetStageForm();
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

        const newPlan: PlanningActionPlan = {
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

        const updatedPlanning = {
            ...planning,
            data: {
                ...planning.data,
                action_plans: updatedPlans
            }
        };

        await handleUpdatePlanning(planning.id, updatedPlanning);
        setToast({ message: "Plano de ação criado com sucesso!", type: "success" });
        setIsActionModalOpen(false);
        setActionPlanForm({
            stageId: "",
            stageName: "",
            startDate: "",
            sla: "",
            endDate: "",
            description: ""
        });
    };

    const handleDeletePlanning = async () => {
        if (planningToDelete) {
            try {
                const token = await getAuthToken();
                await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/plannings/${planningToDelete}`, {
                    headers: { Authorization: `Bearer ${token}` }
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
    };

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
        { name: "CloseOut - GoLive", sla: 0 }
    ];

    const subDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    };


    const getStatusParams = (diff: number) => {
        if (diff < 0) return { text: `Adiantado ${Math.abs(diff)} dias`, color: "bg-green-100 text-green-700" };
        if (diff > 0) return { text: `Atrasado ${Math.abs(diff)} dias`, color: "bg-red-100 text-red-700" };
        return { text: "No prazo", color: "bg-gray-100 text-gray-700" };
    };

    const calculateSchedule = (goLiveDate: string, currentSchedule: PlanningStage[] = []): PlanningStage[] => {
        if (!goLiveDate) return [];

        const safeSchedule = Array.isArray(currentSchedule) ? currentSchedule : [];
        const scheduleMap = new Map(safeSchedule.map(item => [item.name, item]));
        const calculated: PlanningStage[] = [];
        let currentEndDate = new Date(goLiveDate);
        const reversedStages = [...STAGES].reverse();

        for (const stage of reversedStages) {
            const existing = scheduleMap.get(stage.name) || ({} as Partial<PlanningStage>);
            const endPlanned = new Date(currentEndDate);
            let startPlanned = subDays(endPlanned, stage.sla);

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
            currentEndDate = startPlanned;
        }
        return calculated;
    };

    const handleScheduleChange = (planningId: string, stageName: string, field: keyof PlanningStage, value: string) => {
        const planning = plannings.find(p => p.id === planningId);
        if (!planning || !planning.data) return;

        const currentSchedule = Array.isArray(planning.data.schedule) ? planning.data.schedule : [];
        const newSchedule = currentSchedule.map((item) => {
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

    const calculateMetrics = (schedule: PlanningStage[]) => {
        if (!schedule || schedule.length === 0) return null;
        let lastCompleted: string | null = null;
        let inProgress: string | null = null;
        let nextPlanned: string | null = null;

        for (let i = 0; i < schedule.length; i++) {
            const item = schedule[i];
            if (item.start_real && item.end_real) {
                lastCompleted = item.name;
            } else if (item.start_real && !item.end_real && !inProgress) {
                inProgress = item.name;
            } else if (!item.start_real && !nextPlanned) {
                nextPlanned = item.name;
            }
        }

        const startPlanned = schedule[0]?.start_planned ? new Date(schedule[0].start_planned) : null;
        const lastItem = schedule[schedule.length - 1];
        const endPlanned = lastItem?.end_planned ? new Date(lastItem.end_planned) : null;
        const totalPlannedDays = (startPlanned && endPlanned) ? Math.ceil((endPlanned.getTime() - startPlanned.getTime()) / (1000 * 3600 * 24)) : 0;

        return {
            lastCompleted: lastCompleted || "-",
            inProgress: inProgress || "-",
            nextPlanned: nextPlanned || "-",
            totalPlannedDays: totalPlannedDays
        };
    };

    const getWorkName = (workId: string) => {
        const work = works.find(w => w.id === workId);
        return work ? `${work.id} - ${work.regional}` : `Obra ${workId}`;
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;

        const planning = plannings.find(p => p.id === draggableId);
        if (planning) {
            const newStatus = destination.droppableId as PlanningItem['status'];
            handleUpdatePlanning(planning.id, { ...planning, status: newStatus });
            setToast({ message: `Status atualizado para ${newStatus}`, type: "success" });
        }
    };

    // Filter Logic
    const [filterText, setFilterText] = useState("");
    const [filterDateRange, setFilterDateRange] = useState({ start: "", end: "" });

    const filteredPlannings = useMemo(() => {
        return plannings.filter(planning => {
            const work = works.find(w => w.id === planning.work_id);
            if (!work) return false;

            const searchText = filterText.toLowerCase();
            const addressStr = work.address ? `${work.address.street} ${work.address.city}` : "";
            const workSearchString = `${work.id} ${work.regional} ${addressStr} ${work.work_type || ''}`.toLowerCase();
            const matchesText = workSearchString.includes(searchText);

            let matchesDate = true;
            if (filterDateRange.start) {
                const workDate = work.go_live_date ? new Date(work.go_live_date) : null;
                matchesDate = matchesDate && (!!workDate && workDate >= new Date(filterDateRange.start));
            }
            if (filterDateRange.end) {
                const workDate = work.go_live_date ? new Date(work.go_live_date) : null;
                matchesDate = matchesDate && (!!workDate && workDate <= new Date(filterDateRange.end));
            }

            return matchesText && matchesDate;
        });
    }, [plannings, works, filterText, filterDateRange]);

    const paginatedPlannings = filteredPlannings.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );



    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterText, filterDateRange]);

    const toggleExpand = (id: string, planningData: PlanningItem) => {
        if (expandedId === id) {
            setExpandedId(null);
            setSelectedPlanningId(null);
        } else {
            setExpandedId(id);
            setSelectedPlanningId(id);
            setActiveTab("planning");
            if (!planningData.data?.schedule || planningData.data.schedule.length === 0) {
                const work = works.find(w => w.id === planningData.work_id);
                if (work && work.go_live_date) {
                    const newSchedule = calculateSchedule(work.go_live_date);
                    handleUpdatePlanning(planningData.id, { ...planningData, data: { ...planningData.data, schedule: newSchedule } });
                }
            }
        }
    };

    // Gantt Render Helpers
    const renderGantt = (planning: PlanningItem) => {
        const schedule = ganttType === 'planning'
            ? (Array.isArray(planning.data?.schedule) ? planning.data.schedule : [])
            : (Array.isArray(planning.data?.construction_schedule) ? planning.data.construction_schedule : []);

        // Check for empty schedule ONLY for calculating dates, not for avoiding render of the whole component
        const isEmpty = schedule.length === 0;

        const dates = schedule.map((s) => [
            s.start_planned ? new Date(s.start_planned) : null,
            s.end_planned ? new Date(s.end_planned) : null,
            s.start_real ? new Date(s.start_real) : null,
            s.end_real ? new Date(s.end_real) : null
        ]).flat().filter((d): d is Date => d !== null);

        const validDates = dates.filter((d) => !isNaN(d.getTime()));
        const hasValidDates = validDates.length > 0;

        // Default constraints (fallback if no dates)
        const minDate = hasValidDates ? new Date(Math.min(...validDates.map(d => d.getTime()))) : new Date();
        const maxDate = hasValidDates ? new Date(Math.max(...validDates.map(d => d.getTime()))) : new Date();

        // Adjust view range
        minDate.setDate(minDate.getDate() - (ganttView === 'month' ? 30 : 7));
        maxDate.setDate(maxDate.getDate() + (ganttView === 'month' ? 60 : 14));

        // Note: If empty, maxDate close to minDate, totalWidth small.
        // We will render a placeholder inside the chart area if empty or invalid.

        const pxPerDay = ganttView === 'week' ? 10 : ganttView === 'month' ? 4 : 40;
        const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
        const totalWidth = totalDays * pxPerDay; // Might be small if 0 days

        const headers: Date[] = [];
        const current = new Date(minDate);
        if (ganttView === 'week') {
            const day = current.getDay();
            const diff = current.getDate() - day + (day === 0 ? -6 : 1);
            current.setDate(diff);
        } else if (ganttView === 'month') {
            current.setDate(1);
        }
        current.setHours(0, 0, 0, 0);

        while (current <= maxDate) {
            headers.push(new Date(current));
            if (ganttView === 'week') current.setDate(current.getDate() + 7);
            else if (ganttView === 'month') current.setMonth(current.getMonth() + 1);
            else current.setDate(current.getDate() + 1);
        }

        return (
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setGanttType('planning')}
                            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${ganttType === 'planning' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Planejamento
                        </button>
                        <button
                            onClick={() => setGanttType('construction')}
                            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${ganttType === 'construction' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Obra
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Visualizar:</span>
                        <div className="flex border border-gray-200 rounded-lg overflow-hidden divide-x divide-gray-200">
                            {[
                                { id: 'day', label: 'Dia' },
                                { id: 'week', label: 'Sem' },
                                { id: 'month', label: 'Mês' }
                            ].map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setGanttView(v.id as 'day' | 'week' | 'month')}
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${ganttView === v.id ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 bg-white/50 rounded-xl border border-gray-100 border-dashed">
                        <p className="mb-4">Sem dados de cronograma.</p>
                        {ganttType === 'construction' && (
                            <button
                                onClick={() => {
                                    resetStageForm();
                                    setSelectedPlanningId(planning.id);
                                    setIsStageModalOpen(true);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2"
                            >
                                <span className="text-sm">+</span> Nova Etapa
                            </button>
                        )}
                    </div>
                ) : !hasValidDates ? (
                    <div className="text-center py-12 text-gray-400">Datas inválidas ou não definidas.</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {ganttType === 'construction' && (
                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        resetStageForm();
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
                            <div className="relative min-w-full" style={{ width: Math.max(800, totalWidth + 300) + 'px' }}>
                                {/* Header */}
                                <div className="flex border-b border-gray-200 mb-2 sticky top-0 bg-white/95 backdrop-blur-sm z-20 shadow-sm h-12">
                                    <div className="w-64 flex-shrink-0 p-3 text-xs font-bold text-gray-500 uppercase flex items-end sticky left-0 bg-white z-30 border-r border-gray-100 shadow-[1px_0_5px_-2px_rgba(0,0,0,0.1)]">Etapa</div>
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
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Rows */}
                                <div className="space-y-1 pb-4">
                                    {schedule.map((item, idx) => {
                                        const start = item.start_planned ? new Date(item.start_planned) : minDate;
                                        const end = item.end_planned ? new Date(item.end_planned) : start;
                                        const hasPlanned = !!item.start_planned;
                                        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
                                        const offsetDays = Math.ceil((start.getTime() - minDate.getTime()) / (1000 * 3600 * 24));

                                        const realStart = item.start_real ? new Date(item.start_real) : null;
                                        const realEnd = item.end_real ? new Date(item.end_real) : null;
                                        let realDuration = 0;
                                        let realOffset = 0;
                                        let barColor = "bg-gray-400";

                                        if (realStart) {
                                            const effectiveEnd = realEnd || new Date();
                                            realDuration = Math.ceil((effectiveEnd.getTime() - realStart.getTime()) / (1000 * 3600 * 24)) + 1;
                                            realOffset = Math.ceil((realStart.getTime() - minDate.getTime()) / (1000 * 3600 * 24));

                                            if (realEnd) {
                                                if (hasPlanned && realEnd <= end) barColor = "bg-green-500";
                                                else barColor = "bg-red-500";
                                            } else {
                                                barColor = "bg-amber-400";
                                            }
                                        }

                                        return (
                                            <div key={idx} className="flex items-center hover:bg-blue-50/30 group py-1.5 transition-colors relative">
                                                <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ marginLeft: '256px' }}>
                                                    {headers.map((d, hi) => {
                                                        const offset = Math.ceil((d.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
                                                        return <div key={hi} className="absolute border-l border-gray-100/50 h-full" style={{ left: `${offset * pxPerDay}px` }}></div>;
                                                    })}
                                                </div>

                                                <div className="w-64 flex-shrink-0 px-4 text-xs font-medium text-gray-700 truncate border-r border-gray-100 flex justify-between items-center bg-white/50 sticky left-0 z-10 h-full">
                                                    <span title={item.name}>{item.name}</span>
                                                    {ganttType === 'construction' && (
                                                        <button
                                                            className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 font-bold px-1"
                                                            onClick={() => {
                                                                setNewStageForm({
                                                                    name: item.name,
                                                                    showPlanned: !!item.start_planned,
                                                                    startPlanned: item.start_planned || "",
                                                                    endPlanned: item.end_planned || "",
                                                                    showReal: !!item.start_real,
                                                                    startReal: item.start_real || "",
                                                                    endReal: item.end_real || "",
                                                                    showResponsible: !!item.responsible,
                                                                    responsible: item.responsible || "",
                                                                    showSLA: !!item.sla_limit,
                                                                    sla: item.sla_limit?.toString() || "",
                                                                    showDesc: !!item.description,
                                                                    description: item.description || "",
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
                                                    {hasPlanned && (
                                                        <div
                                                            className="absolute top-0.5 h-2 rounded-full bg-blue-200 opacity-60 group-hover:opacity-100 transition-all border border-blue-300/50"
                                                            style={{ left: `${offsetDays * pxPerDay}px`, width: `${Math.max(duration * pxPerDay, 4)}px` }}
                                                        />
                                                    )}
                                                    {realStart && (
                                                        <div
                                                            className={`absolute top-2 h-3 rounded-full shadow-sm cursor-help transition-all hover:scale-y-110 hover:shadow-md z-1 ${barColor}`}
                                                            style={{ left: `${realOffset * pxPerDay}px`, width: `${Math.max(realDuration * pxPerDay, 4)}px` }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative min-h-screen w-full flex flex-col font-sans text-gray-900">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Sticky Toolbar */}
            <div className="sticky top-0 z-30 pb-4 pt-4 px-4 -mx-4 lg:-mx-8 lg:px-8 mb-6 flex flex-col lg:flex-row gap-4 justify-between items-center transition-all duration-300">
                <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto flex-1">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 sm:text-sm shadow-sm hover:shadow-md"
                            placeholder="Buscar planejamento (ID, Regional...)"
                        />
                    </div>
                    <div className="flex gap-2">
                        <input type="date" value={filterDateRange.start} onChange={(e) => setFilterDateRange({ ...filterDateRange, start: e.target.value })} className="block w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md" />
                        <input type="date" value={filterDateRange.end} onChange={(e) => setFilterDateRange({ ...filterDateRange, end: e.target.value })} className="block w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md" />
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
                    <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Lista</button>
                        <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Kanban</button>
                    </div>
                    <button
                        onClick={() => { setSelectedWorkId(""); setIsModalOpen(true); }}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Novo Planejamento
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full px-4 lg:px-8 pb-8 min-w-0 flex flex-col transition-all duration-300 relative">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {['Rascunho', 'Ativo', 'Concluído'].map(status => (
                        <div key={status} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{status}</p>
                                <p className="text-2xl font-bold text-gray-800">{filteredPlannings.filter(p => (p.status || 'Rascunho') === status).length}</p>
                            </div>
                            <div className={`w-2 h-10 rounded-full ${status === 'Ativo' ? 'bg-blue-500' : status === 'Concluído' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        </div>
                    ))}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-blue-100 mb-1">Total</p>
                            <p className="text-2xl font-bold">{filteredPlannings.length}</p>
                        </div>
                    </div>
                </div>

                <div className={viewMode === 'list' || filteredPlannings.length === 0 ? "grid grid-cols-1 gap-6" : "h-full"}>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <LoadingSpinner message="Carregando planejamentos..." />
                        </div>
                    ) : filteredPlannings.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">Nenhum planejamento encontrado.</div>
                    ) : viewMode === 'list' ? (

                        <div className="flex flex-col gap-6">
                            {paginatedPlannings.map((planning: PlanningItem) => {
                                const metrics = calculateMetrics(Array.isArray(planning.data?.schedule) ? planning.data.schedule : []);
                                return (
                                    <div key={planning.id} className={`rounded-2xl bg-white border border-gray-100 shadow-sm transition-all hover:shadow-lg overflow-hidden ${expandedId === planning.id ? 'ring-2 ring-blue-500/20' : ''}`}>
                                        <div className="p-6 cursor-pointer flex items-center justify-between" onClick={() => toggleExpand(planning.id, planning)}>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{getWorkName(planning.work_id)}</h3>
                                                <p className="text-sm text-gray-500">Status: {planning.status || 'Rascunho'}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    className="p-1.5 rounded-lg bg-white/50 hover:bg-blue-50 text-blue-600 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); setPlanningToEdit(planning); setEditForm({ status: planning.status || 'Rascunho' }); setIsEditModalOpen(true); }}
                                                    title="Editar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-lg bg-white/50 hover:bg-red-50 text-red-600 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); setPlanningToDelete(planning.id); setIsDeleteModalOpen(true); }}
                                                    title="Excluir"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {expandedId === planning.id && (
                                            <div className="border-t border-gray-100 bg-white/40">
                                                <div className="flex border-b border-gray-200">
                                                    {['planning', 'gantt', 'action_plan'].map(tab => (
                                                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-sm font-medium ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                                                            {tab === 'planning' ? 'Planejamento' : tab === 'gantt' ? 'Gantt' : 'Plano de Ação'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="p-6">
                                                    {activeTab === 'planning' && (
                                                        <div>
                                                            {metrics && (
                                                                <div className="grid grid-cols-4 gap-4 mb-6">
                                                                    <div className="p-4 bg-white/50 rounded-xl border border-blue-100/50">
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Última</p>
                                                                        <p className="text-sm font-semibold">{metrics.lastCompleted}</p>
                                                                    </div>
                                                                    <div className="p-4 bg-white/50 rounded-xl border border-blue-100/50">
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Em Andamento</p>
                                                                        <p className="text-sm font-semibold text-blue-600">{metrics.inProgress}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                                                <table className="w-full text-sm text-left table-fixed">
                                                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                                                        <tr>
                                                                            <th className="px-4 py-3 w-[20%]">Etapa</th>
                                                                            <th className="px-2 py-3 w-[12%] text-center">Início Prev.</th>
                                                                            <th className="px-2 py-3 w-[12%] text-center">Término Prev.</th>
                                                                            <th className="px-2 py-3 w-[13%] text-center">Início Real</th>
                                                                            <th className="px-2 py-3 w-[13%] text-center">Término Real</th>
                                                                            <th className="px-2 py-3 w-[10%] text-center">Status</th>
                                                                            <th className="px-4 py-3 w-[20%]">Resp.</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100 bg-white text-xs">
                                                                        {(Array.isArray(planning.data?.schedule) ? planning.data.schedule : []).map((item, idx) => {
                                                                            let startStatus = null;
                                                                            if (item.start_real && item.start_planned) {
                                                                                const diff = (new Date(item.start_real).getTime() - new Date(item.start_planned).getTime()) / (1000 * 3600 * 24);
                                                                                startStatus = getStatusParams(diff);
                                                                            }
                                                                            return (
                                                                                <tr key={idx} className="hover:bg-gray-50">
                                                                                    <td className="px-4 py-2 border-r border-gray-100">
                                                                                        <div title={item.name} className="truncate">{item.name}</div>
                                                                                        <span className="text-[10px] text-gray-400">{item.sla} dias</span>
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center text-gray-500 border-r border-gray-100 bg-gray-50/50">
                                                                                        {item.start_planned ? new Date(item.start_planned).toLocaleDateString('pt-BR') : '-'}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center text-gray-500 border-r border-gray-100 bg-gray-50/50">
                                                                                        {item.end_planned ? new Date(item.end_planned).toLocaleDateString('pt-BR') : '-'}
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                                                                        <input type="date" value={item.start_real || ""} onChange={e => handleScheduleChange(planning.id, item.name, 'start_real', e.target.value)} className="w-full text-xs border-transparent bg-transparent hover:bg-white hover:border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center" />
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                                                                        <input type="date" value={item.end_real || ""} onChange={e => handleScheduleChange(planning.id, item.name, 'end_real', e.target.value)} className="w-full text-xs border-transparent bg-transparent hover:bg-white hover:border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center" />
                                                                                    </td>
                                                                                    <td className="px-2 py-2 text-center border-r border-gray-100">
                                                                                        {startStatus && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${startStatus.color}`}>{startStatus.text}</span>}
                                                                                    </td>
                                                                                    <td className="px-4 py-2">
                                                                                        <input type="text" value={item.responsible || ""} onChange={e => handleScheduleChange(planning.id, item.name, 'responsible', e.target.value)} className="w-full text-xs border-transparent bg-transparent hover:bg-white hover:border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Nome..." />
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {activeTab === 'gantt' && renderGantt(planning)}
                                                    {activeTab === 'action_plan' && (
                                                        <div className="flex flex-col gap-6">
                                                            <div className="flex gap-3">
                                                                <button onClick={() => { setSelectedPlanningId(planning.id); setActionModalType('planning'); setIsActionModalOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Criar plano em planejamento</button>
                                                                <button onClick={() => { setSelectedPlanningId(planning.id); setActionModalType('construction'); setIsActionModalOpen(true); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Criar plano em Obra</button>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {(!planning.data?.action_plans || planning.data.action_plans.length === 0) ? (
                                                                    <div className="col-span-full py-12 text-center text-gray-400">Nenhum plano de ação.</div>
                                                                ) : (
                                                                    planning.data.action_plans.map((plan, idx) => (
                                                                        <div key={plan.id || idx} className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
                                                                            <div className={`absolute top-0 left-0 w-1 h-full ${plan.type === 'planning' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                                                            <h4 className="font-bold text-gray-900 text-sm mb-2">{plan.stage_name}</h4>
                                                                            <p className="text-gray-600 text-xs mb-4 line-clamp-2">{plan.description}</p>
                                                                            <div className="flex items-center gap-2 text-[10px] text-gray-500 border-t border-gray-100 pt-3">
                                                                                <span>{new Date(plan.start_date).toLocaleDateString()}</span>
                                                                                <span>SLA: {plan.sla}d</span>
                                                                                <span>{new Date(plan.end_date).toLocaleDateString()}</span>
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
                            })}
                            <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(filteredPlannings.length / itemsPerPage)}
                                onPageChange={setCurrentPage}
                                totalItems={filteredPlannings.length}
                                itemsPerPage={itemsPerPage}
                            />
                        </div>
                    ) : (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="flex gap-6 overflow-x-auto pb-4 h-full px-2">
                                {['Rascunho', 'Ativo', 'Concluído'].map(status => (
                                    <Droppable key={status} droppableId={status}>
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="min-w-[260px] w-1/3 bg-gray-100 rounded-2xl p-4 flex flex-col h-full border border-gray-200 shadow-inner">
                                                <h3 className="text-sm font-bold text-gray-700 mb-4">{status}</h3>
                                                <div className="flex-1 space-y-3">
                                                    {filteredPlannings.filter(p => (p.status || 'Rascunho') === status).map((planning, index) => (
                                                        <Draggable key={planning.id} draggableId={planning.id} index={index}>
                                                            {(provided) => (
                                                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow" onClick={() => toggleExpand(planning.id, planning)}>
                                                                    <p className="font-bold text-sm">{getWorkName(planning.work_id)}</p>
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

            {/* Modals */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Planejamento">
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Selecione a Obra</label>
                        <select value={selectedWorkId} onChange={(e) => setSelectedWorkId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all">
                            <option value="">Selecione...</option>
                            {works.map((work) => <option key={work.id} value={work.id}>{work.id} - {work.regional}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
                        <button onClick={handleCreatePlanning} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-200">Salvar</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title="Etapa de Obra">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Nome da Etapa</label>
                        <input type="text" value={newStageForm.name} onChange={e => setNewStageForm({ ...newStageForm, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all" placeholder="Nome" />
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                        <label className="inline-flex items-center cursor-pointer mb-3">
                            <input type="checkbox" checked={newStageForm.showPlanned} onChange={e => setNewStageForm({ ...newStageForm, showPlanned: e.target.checked })} className="sr-only peer" />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ms-3 text-sm font-semibold text-gray-700">Cronograma Planejado</span>
                        </label>
                        {newStageForm.showPlanned && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Início Planejado</label>
                                    <input type="date" value={newStageForm.startPlanned} onChange={e => setNewStageForm({ ...newStageForm, startPlanned: e.target.value })} className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Término Planejado</label>
                                    <input type="date" value={newStageForm.endPlanned} onChange={e => setNewStageForm({ ...newStageForm, endPlanned: e.target.value })} className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                        <label className="inline-flex items-center cursor-pointer mb-3">
                            <input type="checkbox" checked={newStageForm.showReal} onChange={e => setNewStageForm({ ...newStageForm, showReal: e.target.checked })} className="sr-only peer" />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ms-3 text-sm font-semibold text-gray-700">Cronograma Real</span>
                        </label>
                        {newStageForm.showReal && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Início Real</label>
                                    <input type="date" value={newStageForm.startReal} onChange={e => setNewStageForm({ ...newStageForm, startReal: e.target.value })} className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Término Real</label>
                                    <input type="date" value={newStageForm.endReal} onChange={e => setNewStageForm({ ...newStageForm, endReal: e.target.value })} className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Responsável</label>
                        <input type="text" value={newStageForm.responsible} onChange={e => setNewStageForm({ ...newStageForm, responsible: e.target.value, showResponsible: true })} placeholder="Nome do responsável" className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all" />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Descrição</label>
                        <textarea value={newStageForm.description} onChange={e => setNewStageForm({ ...newStageForm, description: e.target.value, showDesc: true })} placeholder="Descrição detalhada" className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all" rows={3} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <button onClick={() => setIsStageModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
                        <button onClick={() => { if (selectedPlanningId) { const p = plannings.find(pl => pl.id === selectedPlanningId); if (p) handleSaveConstructionStage(selectedPlanningId, p.data?.construction_schedule || []) } }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-200">Salvar</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title="Novo Plano de Ação">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Etapa</label>
                        <select value={actionPlanForm.stageId} onChange={e => setActionPlanForm({ ...actionPlanForm, stageId: e.target.value, stageName: e.target.options[e.target.selectedIndex].text })} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all">
                            <option value="">Selecione Etapa...</option>
                            {(() => {
                                const p = plannings.find(pl => pl.id === selectedPlanningId);
                                const source = actionModalType === 'planning' ? (p?.data?.schedule || []) : (p?.data?.construction_schedule || []);
                                return source.map((s, i) => <option key={s.id || i} value={s.id || s.name}>{s.name}</option>);
                            })()}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Data de Início</label>
                            <input type="date" value={actionPlanForm.startDate} onChange={e => setActionPlanForm({ ...actionPlanForm, startDate: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">SLA (dias)</label>
                            <input type="number" placeholder="Ex: 5" value={actionPlanForm.sla} onChange={e => {
                                const sla = parseInt(e.target.value);
                                const end = actionPlanForm.startDate ? new Date(new Date(actionPlanForm.startDate).setDate(new Date(actionPlanForm.startDate).getDate() + sla)).toISOString().split('T')[0] : "";
                                setActionPlanForm({ ...actionPlanForm, sla: e.target.value, endDate: end });
                            }} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Data Final (Calculada)</label>
                        <input type="date" value={actionPlanForm.endDate} disabled className="w-full bg-gray-100 border border-gray-200 text-gray-500 text-sm rounded-xl block p-2.5 cursor-not-allowed" />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Descrição</label>
                        <textarea value={actionPlanForm.description} onChange={e => setActionPlanForm({ ...actionPlanForm, description: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all" placeholder="Descrição detalhada do plano" rows={3} />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-gray-100">
                        <button onClick={() => setIsActionModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
                        <button onClick={handleSaveActionPlan} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-200">Salvar</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Excluir Planejamento">
                <div>
                    <p className="text-gray-600 mb-6">Tem certeza que deseja excluir este planejamento? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
                        <button onClick={handleDeletePlanning} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-red-200">Excluir</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Planejamento">
                <div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">Status</label>
                        <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition-all">
                            <option value="Rascunho">Rascunho</option>
                            <option value="Ativo">Ativo</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Arquivado">Arquivado</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
                        <button onClick={() => { if (planningToEdit) handleUpdatePlanning(planningToEdit.id, { ...planningToEdit, status: editForm.status } as PlanningItem).then(() => setIsEditModalOpen(false)) }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-200">Salvar</button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
