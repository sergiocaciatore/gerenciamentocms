import { useState, useEffect, useMemo, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { auth } from "../firebase";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import type { Oc, OcEvent, Alert, ControlTowerWork, OcEventDefinition } from "../types/ControlTower";
import OcCard from "../components/ControlTower/OcCard";




// --- HUD Component ---
const ControlTowerHUD = ({ ocs, onFilterClick }: { ocs: Oc[], onFilterClick: (type: string) => void }) => {
    const total = ocs.length;

    // Calculate metrics
    const totalValue = ocs.reduce((acc, oc) => acc + (oc.value || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div
                onClick={() => onFilterClick("all")}
                className="bg-white/40 backdrop-blur-xl border border-white/50 p-4 rounded-2xl shadow-lg cursor-pointer hover:bg-white/60 transition-all group"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total OCs</span>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-gray-800">{total}</span>
                    <span className="text-xs text-gray-500 mb-1">registros</span>
                </div>
            </div>

            <div
                className="bg-white/40 backdrop-blur-xl border border-white/50 p-4 rounded-2xl shadow-lg cursor-pointer hover:bg-white/60 transition-all group"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Total</span>
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-800">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact" }).format(totalValue)}
                    </span>
                </div>
            </div>

            <div
                className="bg-white/40 backdrop-blur-xl border border-white/50 p-4 rounded-2xl shadow-lg cursor-pointer hover:bg-white/60 transition-all group"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status Crítico</span>
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-gray-800">{ocs.filter(o => (o.type && o.type.toLowerCase().includes('crítico')) || (o.description && o.description.toLowerCase().includes('urgente'))).length}</span>
                    <span className="text-xs text-gray-500 mb-1">atenção</span>
                </div>
            </div>

            <div
                className="bg-white/40 backdrop-blur-xl border border-white/50 p-4 rounded-2xl shadow-lg cursor-pointer hover:bg-white/60 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 group"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sem Obra</span>
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-gray-800">{ocs.filter(o => !o.work_id).length}</span>
                    <span className="text-xs text-gray-500 mb-1">pendentes</span>
                </div>
            </div>
        </div>
    );
};

// --- Timeline Component ---
const TimelineView = ({ ocs, events }: { ocs: Oc[], events: OcEvent[] }) => {
    // Filter events for visible OCs
    const visibleEvents = events.filter(evt => ocs.some(oc => oc.id === evt.oc_id));

    if (visibleEvents.length === 0) return <div className="p-8 text-center text-gray-500 bg-white/40 rounded-2xl backdrop-blur-md">Nenhum evento com data encontrado para as OCs filtradas.</div>;

    // Dates
    const dates = visibleEvents.map(e => [
        e.start_date ? new Date(e.start_date) : null,
        e.end_date ? new Date(e.end_date) : null
    ].filter(d => d && !isNaN(d.getTime()))).flat() as Date[];

    if (dates.length === 0) return <div className="p-8 text-center text-gray-500 bg-white/40 rounded-2xl backdrop-blur-md">Eventos filtrados não possuem datas definidas.</div>;

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Add buffer (7 days)
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    const totalMs = maxDate.getTime() - minDate.getTime();
    if (totalMs <= 0) return <div className="p-4">Intervalo de datas inválido</div>;

    const getLeft = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 0;
        return Math.max(0, ((d.getTime() - minDate.getTime()) / totalMs) * 100);
    };

    const getWidth = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
        const width = ((e.getTime() - s.getTime()) / totalMs) * 100;
        return Math.max(width, 0.5); // Min 0.5% visibility
    };

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[calc(100vh-250px)]">
            {/* Header Dates */}
            <div className="flex border-b border-white/30 p-4 bg-white/20">
                <div className="w-48 shrink-0 font-bold text-gray-600 text-xs uppercase">OC / Obra</div>
                <div className="flex-1 relative h-6">
                    <span className="absolute left-0 text-[10px] text-gray-500 transform -translate-x-1/2">{minDate.toLocaleDateString()}</span>
                    <span className="absolute right-0 text-[10px] text-gray-500 transform translate-x-1/2">{maxDate.toLocaleDateString()}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
                {ocs.map(oc => {
                    const ocEvts = visibleEvents.filter(e => e.oc_id === oc.id);
                    if (ocEvts.length === 0) return null;

                    return (
                        <div key={oc.id} className="flex items-center gap-4 group hover:bg-white/20 p-2 rounded-lg transition-colors">
                            <div className="w-48 shrink-0 overflow-hidden">
                                <div className="text-xs font-bold text-gray-700 truncate" title={oc.description}>{oc.description}</div>
                                <div className="text-[10px] text-gray-500 truncate">{oc.work_id || "Sem Obra"}</div>
                            </div>

                            <div className="flex-1 relative h-8 bg-white/30 rounded-lg border border-white/40 overflow-hidden">
                                {ocEvts.map(evt => (
                                    <div
                                        key={evt.id}
                                        className="absolute top-1 bottom-1 bg-blue-500/80 rounded-sm border border-blue-400 shadow-sm hover:bg-blue-600 transition-colors cursor-pointer group/evt z-10"
                                        style={{
                                            left: `${getLeft(evt.start_date || "")}%`,
                                            width: `${getWidth(evt.start_date || "", evt.end_date || "")}%`
                                        }}
                                        title={`${evt.description} (${evt.start_date || "?"} - ${evt.end_date || "?"})`}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Kanban Component ---
const KanbanBoard = ({ ocs, statuses, onDragEnd }: { ocs: Oc[], statuses: string[], onDragEnd: (result: DropResult) => void }) => {
    // Group OCs by status
    const columns = statuses.reduce((acc: Record<string, Oc[]>, status) => {
        acc[status] = ocs.filter(oc => (oc.status || "Pendente") === status);
        return acc;
    }, {});

    // Ensure "Pendente" or missing status are handled if not in statuses list
    // If we assume statuses list covers everything, fine. If not, maybe a "Outros" column?
    // For simplicity, we just iterate provided statuses.

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
                {statuses.map(status => (
                    <div key={status} className="min-w-[300px] w-[300px] flex flex-col bg-white/20 backdrop-blur-md rounded-2xl border border-white/30">
                        {/* Column Header */}
                        <div className="p-4 border-b border-white/20 bg-white/10 rounded-t-2xl flex justify-between items-center sticky top-0 backdrop-blur-md z-10">
                            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">{status}</h3>
                            <span className="bg-white/40 px-2 py-0.5 rounded-full text-xs font-bold text-gray-600">
                                {columns[status]?.length || 0}
                            </span>
                        </div>

                        {/* Droppable Area */}
                        <Droppable droppableId={status}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-1 p-3 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent ${snapshot.isDraggingOver ? 'bg-blue-50/20' : ''}`}
                                >
                                    {columns[status]?.map((oc: Oc, index: number) => (
                                        <Draggable key={oc.id} draggableId={oc.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`bg-white/80 p-4 rounded-xl shadow-sm border border-white/60 hover:shadow-md hover:border-blue-300/50 hover:scale-[1.02] transition-all duration-200 group cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'rotate-2 shadow-xl ring-2 ring-blue-400 z-50' : ''}`}
                                                    style={{ ...provided.draggableProps.style }}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                                            {oc.work_id || "S/ Obra"}
                                                        </span>
                                                        {oc.value > 0 && (
                                                            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact" }).format(oc.value)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-2" title={oc.description}>
                                                        {oc.description}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                                        <span className="text-[10px] text-gray-500">{oc.type}</span>
                                                        {oc.events && oc.events.length > 0 && (
                                                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                {oc.events.length}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
};

export default function ControlTower() {
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [expandedOcId, setExpandedOcId] = useState<string | null>(null);

    // Data State
    const [works, setWorks] = useState<ControlTowerWork[]>([]);
    const [ocs, setOcs] = useState<Oc[]>([]);
    const [existingEvents, setExistingEvents] = useState<OcEventDefinition[]>([]);
    const [ocEvents, setOcEvents] = useState<OcEvent[]>([]);

    // Form State (OC)
    const [selectedWorkId, setSelectedWorkId] = useState("");
    const [ocType, setOcType] = useState("");
    const [ocDescription, setOcDescription] = useState("Projeto Elétrico");
    const [ocDetails, setOcDetails] = useState("");
    const [ocValue, setOcValue] = useState("");

    // Edit State (OC)
    const [editingOcId, setEditingOcId] = useState<string | null>(null);

    // Event Modal State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [currentOcId, setCurrentOcId] = useState<string | null>(null);

    // Event Management Modal State
    const [isManageEventsModalOpen, setIsManageEventsModalOpen] = useState(false);
    const [editingDefinitionId, setEditingDefinitionId] = useState<string | null>(null);

    // Event Form State
    // Shared with Management Modal for creating/editing definitions
    const [eventDescription, setEventDescription] = useState("");
    const [selectedDefinitionId, setSelectedDefinitionId] = useState("");

    // Optional Fields (Restored for Defaults in Templates)
    const [useStartDate, setUseStartDate] = useState(false);
    const [eventStartDate, setEventStartDate] = useState("");

    const [useEndDate, setUseEndDate] = useState(false);
    const [eventEndDate, setEventEndDate] = useState("");

    const [useStatus, setUseStatus] = useState(false);
    const [eventStatus, setEventStatus] = useState("");

    const [useProtocol, setUseProtocol] = useState(false);
    const [eventProtocol, setEventProtocol] = useState("");

    // Status Options for Management
    const [customStatusOptions, setCustomStatusOptions] = useState<string[]>([]);
    const [newStatusOption, setNewStatusOption] = useState("");

    // --- Alerts State ---
    const [alerts, setAlerts] = useState<Alert[]>(() => {
        const saved = localStorage.getItem('controlTowerAlerts');
        return saved ? JSON.parse(saved) : [];
    });
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
    const [alertWorkId, setAlertWorkId] = useState("");
    const [alertEventFilter, setAlertEventFilter] = useState("");
    const [alertRecurrenceDays, setAlertRecurrenceDays] = useState(7);
    const [alertRecurrenceActive, setAlertRecurrenceActive] = useState(false);
    const [alertLeadTimeDays, setAlertLeadTimeDays] = useState(3);
    const [alertLeadTimeActive, setAlertLeadTimeActive] = useState(false);

    // Persist Alerts
    useEffect(() => {
        localStorage.setItem('controlTowerAlerts', JSON.stringify(alerts));
    }, [alerts]);

    // Check Alerts (Mock Logic)
    useEffect(() => {
        // Backend Sync: In production, fetch from /api/alerts
        if (alerts.length > 0) {
            setToast({ message: `${alerts.length} alertas ativos monitorando suas obras.`, type: "success" });
        }
    }, [alerts.length]);

    const handleSaveAlert = () => {
        const newAlert: Alert = {
            id: editingAlert ? editingAlert.id : Date.now().toString(),
            workId: alertWorkId,
            eventFilter: alertEventFilter,
            recurrenceDays: alertRecurrenceDays,
            recurrenceActive: alertRecurrenceActive,
            leadTimeDays: alertLeadTimeDays,
            leadTimeActive: alertLeadTimeActive,
            createdAt: Date.now()
        };

        if (editingAlert) {
            setAlerts(prev => prev.map(a => a.id === editingAlert.id ? newAlert : a));
            setToast({ message: "Alerta atualizado com sucesso!", type: "success" });
        } else {
            setAlerts(prev => [...prev, newAlert]);
            setToast({ message: "Alerta criado com sucesso!", type: "success" });
        }
        setIsAlertModalOpen(false);
        setEditingAlert(null);
        resetAlertForm();
    };

    const resetAlertForm = () => {
        setAlertWorkId("");
        setAlertEventFilter("");
        setAlertRecurrenceDays(7);
        setAlertRecurrenceActive(false);
        setAlertLeadTimeDays(3);
        setAlertLeadTimeActive(false);
        setEditingAlert(null);
    };

    const handleEditAlert = (alert: Alert) => {
        setEditingAlert(alert);
        setAlertWorkId(alert.workId);
        setAlertEventFilter(alert.eventFilter);
        setAlertRecurrenceDays(alert.recurrenceDays);
        setAlertRecurrenceActive(alert.recurrenceActive);
        setAlertLeadTimeDays(alert.leadTimeDays);
        setAlertLeadTimeActive(alert.leadTimeActive);
        setIsAlertModalOpen(true);
    };

    const handleDeleteAlert = (id: string) => {
        if (confirm("Excluir este alerta?")) {
            setAlerts(prev => prev.filter(a => a.id !== id));
            setToast({ message: "Alerta excluído.", type: "success" });
        }
    };




    // Filter State
    const [filterText, setFilterText] = useState("");
    const [filterOverdue, setFilterOverdue] = useState(false);
    const [filterNearDeadline, setFilterNearDeadline] = useState(false);
    const [filterStatus, setFilterStatus] = useState("");

    // View Mode State
    const [isGroupedView, setIsGroupedView] = useState(false); // Existing
    const [isKanbanView, setIsKanbanView] = useState(false);   // Existing
    const [isTimelineView, setIsTimelineView] = useState(false); // New

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const { source, destination, draggableId } = result;

        if (source.droppableId !== destination.droppableId) {
            // Moved to new status
            const newStatus = destination.droppableId;

            // Optimistic Update
            setOcs(prev => prev.map(oc =>
                oc.id === draggableId ? { ...oc, status: newStatus } : oc
            ));

            // API Call (Mocked/Future)
            console.log(`Moved OC ${draggableId} to ${newStatus}`);
            // await updateOcStatus(draggableId, newStatus);
        }
    };

    const descriptionOptions = [
        "Projeto Elétrico",
        "Projeto Estrutural",
        "Obras",
        "Aditivo",
        "Medição",
        "Orçamento",
        "Compra de Material",
        "Contratação de Serviço",
        "Laudos",
        "Vistoria",
        "Outros"
    ];

    // Helper: Calculate Time Elapsed Percentage
    const calculateTimeElapsed = (startStr: string, endStr: string): number => {
        if (!startStr || !endStr) return 0;
        const start = new Date(startStr).getTime();
        const end = new Date(endStr).getTime();
        const now = new Date().getTime();

        if (isNaN(start) || isNaN(end) || end <= start) return 0;

        const totalDuration = end - start;
        const elapsed = now - start;

        return (elapsed / totalDuration) * 100;
    };

    // Helper: Check if Overdue
    const isOverdue = (endStr: string): boolean => {
        if (!endStr) return false;
        const end = new Date(endStr).getTime();
        const now = new Date().getTime();
        // Overdue if end date is in the past (ignoring today?) -> usually < now
        // Let's assume strict inequality
        return end < now;
    };

    // Filter Logic
    const availableStatuses = useMemo(() => Array.from(new Set(ocEvents.map(e => e.status).filter((s): s is string => !!s))), [ocEvents]);

    const filteredOcs = useMemo(() => ocs.filter(oc => {
        const work = works.find(w => w.id === oc.work_id);
        const searchString = `${oc.description} ${oc.type} ${work?.id} ${work?.regional} `.toLowerCase();

        // 1. Text Filter
        if (filterText && !searchString.includes(filterText.toLowerCase())) {
            // Deep check: Do any events match?
            const events = ocEvents.filter(e => e.oc_id === oc.id);
            const hasEventMatch = events.some(e => e.description.toLowerCase().includes(filterText.toLowerCase()));
            if (!hasEventMatch) return false;
        }

        // Get events for this OC to check toggle criteria
        const events = ocEvents.filter(e => e.oc_id === oc.id);

        // 2. Overdue Toggle
        if (filterOverdue) {
            const hasOverdueEvent = events.some(e => isOverdue(e.end_date || ""));
            if (!hasOverdueEvent) return false;
        }

        // 3. Near Deadline Toggle (>= 50% elapsed)
        if (filterNearDeadline) {
            const hasNearDeadlineEvent = events.some(e => {
                const pct = calculateTimeElapsed(e.start_date || "", e.end_date || "");
                return pct >= 50 && !isOverdue(e.end_date || ""); // Only "Near" deadline, exclude already overdue? OR include?
                // User said "a partir de 50% entra nesse ponto". Usually simpler to just say >= 50.
            });
            if (!hasNearDeadlineEvent) return false;
        }

        // 4. Status Filter
        if (filterStatus) {
            const hasStatusMatch = events.some(e => e.status === filterStatus);
            if (!hasStatusMatch) return false;
        }

        return true;
    }), [ocs, works, ocEvents, filterText, filterOverdue, filterNearDeadline, filterStatus]);



    const fetchData = useCallback(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token} ` };

            const [worksRes, ocsRes, eventsRes, definitionsRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/ocs`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/oc-events`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/event-definitions`, { headers })
            ]);

            if (worksRes.ok) setWorks(await worksRes.json());
            if (ocsRes.ok) setOcs(await ocsRes.json());
            if (eventsRes.ok) setOcEvents(await eventsRes.json());
            if (definitionsRes.ok) setExistingEvents(await definitionsRes.json());

        } catch (error) {
            console.error("Error fetching data:", error);
            setToast({ message: "Erro ao carregar dados.", type: "error" });
        }
    }, [])

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleButtonClick = (label: string) => {
        setEditingOcId(null);
        setModalType(label);
        // Reset form
        setSelectedWorkId("");
        setOcType("");
        setOcDescription("Projeto Elétrico");
        setOcDetails("");
        setOcValue("");
        setIsModalOpen(true);
    };

    const handleEdit = (oc: Oc) => {
        setEditingOcId(oc.id);
        setModalType("Editar OC");
        setSelectedWorkId(oc.work_id);
        setOcType(oc.type);
        setOcDescription(oc.description);
        setOcDetails(oc.details || "");
        setOcValue(oc.value ? oc.value.toString() : "");
        setIsModalOpen(true);
    };

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'oc' | 'event' | 'definition' } | null>(null);

    const handleDeleteClick = (id: string, type: 'oc' | 'event' | 'definition') => {
        setDeleteTarget({ id, type });
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { id, type } = deleteTarget;

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            let endpoint = "";
            if (type === 'oc') endpoint = `/ocs/${id}`;
            else if (type === 'event') endpoint = `/oc-events/${id}`;
            else if (type === 'definition') endpoint = `/event-definitions/${id}`;

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                setToast({ message: "Excluído com sucesso!", type: "success" });
                setIsDeleteModalOpen(false);
                setDeleteTarget(null);
                fetchData();
            } else {
                setToast({ message: "Erro ao excluir.", type: "error" });
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            setToast({ message: "Erro ao conectar com o servidor.", type: "error" });
        }
    };

    const handleSave = async () => {
        if (!selectedWorkId) {
            setToast({ message: "Selecione uma obra.", type: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                setToast({ message: "Usuário não autenticado.", type: "error" });
                setIsSaving(false);
                return;
            }

            const payload = {
                work_id: selectedWorkId,
                type: ocType,
                description: ocDescription,
                details: ocDetails,
                value: parseFloat(ocValue) || 0
            };

            const url = editingOcId
                ? `${import.meta.env.VITE_API_BASE_URL}/ocs/${editingOcId}`
                : `${import.meta.env.VITE_API_BASE_URL}/ocs`;

            const method = editingOcId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: editingOcId ? "OC atualizada com sucesso!" : "OC criada com sucesso!", type: "success" });
                setIsModalOpen(false);
                fetchData();
            } else {
                const errorData = await response.json();
                setToast({ message: `Erro ao salvar: ${errorData.detail || "Erro desconhecido"}`, type: "error" });
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setToast({ message: "Erro ao conectar com o servidor.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Event Logic ---
    const handleAddEvent = (ocId: string) => {
        setCurrentOcId(ocId);
        // Default to selection mode
        setEventDescription("");
        setSelectedDefinitionId("");

        setIsEventModalOpen(true);
    };

    const handleAddCustomStatusOption = () => {
        if (newStatusOption.trim()) {
            setCustomStatusOptions([...customStatusOptions, newStatusOption.trim()]);
            setNewStatusOption("");
        }
    };

    const handleRemoveCustomStatusOption = (option: string) => {
        setCustomStatusOptions(customStatusOptions.filter(o => o !== option));
    };

    const handleSaveEvent = async () => {
        if (!currentOcId) return;

        // Validation
        if (!selectedDefinitionId) {
            setToast({ message: "Selecione um evento da biblioteca.", type: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            // 1. Get Definition Data
            let finalDescription = "";
            let finalStatusOptions: string[] = [];

            const def = existingEvents.find(e => e.id === selectedDefinitionId);
            if (def) {
                finalDescription = def.description;
                finalStatusOptions = def.default_status_options || [];
            } else {
                setToast({ message: "Definição de evento não encontrada.", type: "error" });
                setIsSaving(false);
                return;
            }

            // 2. Create OC Event Instance
            const payload = {
                oc_id: currentOcId,
                description: finalDescription,
                status_options: finalStatusOptions
            };

            // Add optional instance-specific fields if toggled
            // (Even though we are linking, we might want to start with specific values)
            // But per request "creates instance copying data" 
            // The prompt "button + novo evento só exibirá um modal para escolher um evento já cadastrado"
            // Suggests removing the complex form from here too? 
            // "só exibirá um modal para escolher um evento já cadastrado" -> Sounds like JUST the dropdown.
            // But maybe they still want to set the start date? 
            // Let's keep the optional fields for the *instance* (Start Date, etc) as that makes sense for an instance.
            // But DEFINITELY remove the "New Event" creation form (Name, Status Options creation).

            // Actually, if we just want to "pick an event", maybe we don't set dates yet?
            // "só exibirá um modal para escolher um evento já cadastrado"
            // I will keep the optional fields invisible/removed based on strict reading, 
            // or keep them as "Link & Configure". 
            // Re-reading: "só exibirá um modal para escolher um evento já cadastrado" implies simplest possible UI.
            // The user can edit the details INLINE on the card afterwards.
            // So I will REMOVE the optional fields from this modal to make it super fast.

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/oc-events`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: "Evento vinculado com sucesso!", type: "success" });
                setIsEventModalOpen(false);
                fetchData();
            } else {
                setToast({ message: "Erro ao adicionar evento.", type: "error" });
            }

        } catch (error) {
            console.error("Erro ao salvar evento:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateEvent = async (event: OcEvent, field: string, value: string) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const updatedEvent = { ...event, [field]: value };
            const { id, ...payload } = updatedEvent;

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/oc-events/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setOcEvents(prev => prev.map(e => e.id === id ? updatedEvent : e));
            } else {
                setToast({ message: "Erro ao atualizar evento.", type: "error" });
                fetchData();
            }
        } catch (error) {
            console.error("Error updating event:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    // --- Management Logic ---
    const openManageEvents = () => {
        setEditingDefinitionId(null);
        setEventDescription("");
        setCustomStatusOptions([]);
        setNewStatusOption("");
        setIsManageEventsModalOpen(true);
    };

    const handleEditDefinition = (def: OcEventDefinition) => {
        setEditingDefinitionId(def.id);
        setEventDescription(def.description);
        setCustomStatusOptions(def.default_status_options || []);
        setNewStatusOption("");
    };

    const handleSaveDefinition = async () => {
        if (!eventDescription) {
            setToast({ message: "Descrição é obrigatória.", type: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const payload = {
                description: eventDescription,
                default_status_options: customStatusOptions
            };

            const url = editingDefinitionId
                ? `${import.meta.env.VITE_API_BASE_URL}/event-definitions/${editingDefinitionId}`
                : `${import.meta.env.VITE_API_BASE_URL}/event-definitions`;

            const method = editingDefinitionId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: "Definição salva com sucesso!", type: "success" });
                // Reset form but keep modal open or switch to new?
                // Let's reset form logic for next add
                if (editingDefinitionId) {
                    setEditingDefinitionId(null); // Return to add mode
                    setEventDescription("");
                    setCustomStatusOptions([]);
                }
                fetchData();
            } else {
                setToast({ message: "Erro ao salvar definição.", type: "error" });
            }
        } catch (error) {
            console.error("Erro ao salvar definição:", error);
        } finally {
            setIsSaving(false);
        }
    };


    // Toggle Component
    const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`${checked ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
        >
            <span
                className={`${checked ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
        </button>
    );

    // --- Helper Logic for OC Rendering ---
    // Moved to OcCard component for performance


    // --- Grouped View Logic ---
    const groupedOcs = isGroupedView
        ? Object.values(filteredOcs.reduce((acc: Record<string, Oc[]>, oc: Oc) => {
            const workId = oc.work_id || "Sem Obra";
            if (!acc[workId]) acc[workId] = [];
            acc[workId].push(oc);
            return acc;
        }, {}))
        : [];

    const GroupedOcCard = ({ ocs }: { ocs: Oc[] }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        const workId = ocs[0]?.work_id;
        const work = works.find(w => w.id === workId);

        return (
            <div className={`relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl transition-all ${isExpanded ? 'bg-white/60' : 'hover:bg-white/50'} group`}>
                <div className="p-6">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <h3 className="text-2xl font-bold text-gray-800">{workId || "Sem Obra"}</h3>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Regional</span>
                                <span className="text-sm font-medium text-gray-700">{work?.regional || "-"}</span>
                            </div>
                            <div className="flex flex-col pl-4 border-l border-gray-300">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ocorrências</span>
                                <span className="text-sm font-bold text-blue-600">{ocs.length} Card{ocs.length > 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-2 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors"
                            title={isExpanded ? "Recolher" : "Expandir"}
                        >
                            {isExpanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="px-6 pb-6 pt-0 space-y-4 border-t border-white/30 mt-2 bg-black/5 rounded-b-2xl">
                        <div className="pt-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cartões da Obra</div>
                        <div className="grid grid-cols-1 gap-4">
                            {ocs.map(oc => (
                                <OcCard
                                    key={oc.id}
                                    oc={oc}
                                    ocEvents={ocEvents}
                                    expandedOcId={expandedOcId}
                                    onExpand={setExpandedOcId}
                                    onEdit={handleEdit}
                                    onDelete={(id) => handleDeleteClick(id, 'oc')}
                                    onAddEvent={handleAddEvent}
                                    onUpdateEvent={handleUpdateEvent}
                                    onDeleteEvent={(id) => handleDeleteClick(id, 'event')}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {/* Visual Accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isExpanded ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-200'} transition-colors`}></div>
            </div>
        );
    };

    return (
        <div className="relative min-h-full w-full">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Main Content Area */}
            <div className="mr-80 px-8 py-8 w-auto mx-0">
                {/* ... Header ... */}

                {/* HUD Section */}
                <ControlTowerHUD ocs={ocs} onFilterClick={(type) => {
                    console.log("Filter clicked:", type);
                    // Minimal logic: if 'all', clear filters
                    if (type === 'all') {
                        setFilterText("");
                        setFilterStatus("");
                        setFilterOverdue(false);
                        setFilterNearDeadline(false);
                    }
                }} />

                <div className="grid grid-cols-1 gap-6">
                    {isKanbanView ? (
                        <KanbanBoard ocs={filteredOcs} statuses={availableStatuses} onDragEnd={handleDragEnd} />
                    ) : isTimelineView ? (
                        <TimelineView ocs={filteredOcs} events={ocEvents} />
                    ) : isGroupedView ? (
                        groupedOcs.map((group: Oc[], idx: number) => (
                            <GroupedOcCard key={group[0]?.work_id || idx} ocs={group} />
                        ))
                    ) : (
                        filteredOcs.map((oc) => (
                            <OcCard
                                key={oc.id}
                                oc={oc}
                                ocEvents={ocEvents}
                                expandedOcId={expandedOcId}
                                onExpand={setExpandedOcId}
                                onEdit={handleEdit}
                                onDelete={(id) => handleDeleteClick(id, 'oc')}
                                onAddEvent={handleAddEvent}
                                onUpdateEvent={handleUpdateEvent}
                                onDeleteEvent={(id) => handleDeleteClick(id, 'event')}
                            />
                        ))
                    )}
                </div>

                {filteredOcs.length === 0 && (
                    <div className="p-12 text-center rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl mt-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Nenhum resultado encontrado</h3>
                        <p className="text-xs text-gray-500">Tente ajustar seus filtros de busca.</p>
                    </div>
                )}
            </div>

            {/* Floating Sidebar */}
            <div className="fixed right-8 top-32 flex flex-col gap-4 w-72 z-20">
                {/* Actions Section */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ações</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleButtonClick("Nova OC")}
                            className="flex flex-col items-center justify-center p-3 bg-white/60 hover:bg-white/80 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                <span className="text-blue-600 text-lg font-bold">+</span>
                            </div>
                            <span className="text-[10px] font-medium text-gray-600">Nova OC</span>
                        </button>
                        <button
                            onClick={openManageEvents}
                            className="flex flex-col items-center justify-center p-3 bg-white/60 hover:bg-white/80 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <span className="text-[10px] font-medium text-gray-600">Eventos</span>
                        </button>

                        <button
                            onClick={() => setIsAlertModalOpen(true)}
                            className="col-span-2 flex items-center justify-center gap-2 p-2.5 bg-yellow-50/80 hover:bg-yellow-100/80 rounded-xl border border-yellow-200/50 shadow-sm hover:shadow-md transition-all group mt-1"
                        >
                            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <span className="text-xs font-semibold text-yellow-700">Criar Alerta</span>
                        </button>
                    </div>
                </div>

                {/* Filters Section (New) */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filtros</h3>

                    <div className="space-y-3">
                        {/* Text Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-white/60 border border-white/50 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-400"
                            />
                            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="text-xs font-medium text-gray-700">Agrupar por Obra</span>
                                </div>
                                <ToggleSwitch checked={isGroupedView} onChange={(v) => { setIsGroupedView(v); if (v) { setIsKanbanView(false); setIsTimelineView(false); } }} />
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                    <span className="text-xs font-medium text-gray-700">Modo Kanban</span>
                                </div>
                                <ToggleSwitch checked={isKanbanView} onChange={(v) => { setIsKanbanView(v); if (v) { setIsGroupedView(false); setIsTimelineView(false); } }} />
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-xs font-medium text-gray-700">Modo Timeline</span>
                                </div>
                                <ToggleSwitch checked={isTimelineView} onChange={(v) => { setIsTimelineView(v); if (v) { setIsGroupedView(false); setIsKanbanView(false); } }} />
                            </div>
                        </div>

                        {/* Smart Tags Filter */}
                        <div className="pt-2">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFilterOverdue(!filterOverdue)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${filterOverdue ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105' : 'bg-white/40 text-gray-600 border-white/50 hover:bg-white/60'}`}
                                >
                                    🚨 Atrasado
                                </button>
                                <button
                                    onClick={() => setFilterNearDeadline(!filterNearDeadline)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${filterNearDeadline ? 'bg-yellow-500 text-white border-yellow-600 shadow-md transform scale-105' : 'bg-white/40 text-gray-600 border-white/50 hover:bg-white/60'}`}
                                >
                                    ⚠️ Próximo
                                </button>

                                {availableStatuses.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${filterStatus === s ? 'bg-blue-500 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white/40 text-gray-600 border-white/50 hover:bg-white/60'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts Section (Sidebar) */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl mt-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Meus Alertas</h3>
                    {alerts.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nenhum alerta configurado.</p>
                    ) : (
                        <div className="space-y-2">
                            {alerts.map(alert => (
                                <div key={alert.id} className="bg-white/60 p-2 rounded-lg border border-white/50 shadow-sm flex justify-between items-center group">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700">{alert.workId === '' ? 'Todas Obras' : alert.workId}</span>
                                        <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{alert.eventFilter || "Qualquer evento"}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditAlert(alert)} className="p-1 hover:bg-blue-100 rounded text-blue-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                        <button onClick={() => handleDeleteAlert(alert.id)} className="p-1 hover:bg-red-100 rounded text-red-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Modal for OC */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalType}
            >
                {/* ... (OC Form - same as before) ... */}
                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Obra</label>
                        <select
                            value={selectedWorkId}
                            onChange={(e) => setSelectedWorkId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                        >
                            <option value="">Selecione uma obra</option>
                            {works.map((work) => (
                                <option key={work.id} value={work.id}>
                                    {work.id} - {work.regional}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                        <input
                            type="text"
                            value={ocType}
                            onChange={(e) => setOcType(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                            placeholder="Digite o tipo"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Categoria</label>
                        <select
                            value={ocDescription}
                            onChange={(e) => setOcDescription(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                        >
                            {descriptionOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descrição</label>
                        <textarea
                            value={ocDetails}
                            onChange={(e) => setOcDetails(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200 min-h-[80px]"
                            placeholder="Detalhes adicionais..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Valor (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={ocValue}
                            onChange={(e) => setOcValue(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                        >
                            {isSaving ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal for Events */}
            <Modal
                isOpen={isEventModalOpen}
                onClose={() => setIsEventModalOpen(false)}
                title="Adicionar Evento"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Buscar na Biblioteca</label>
                        <select
                            value={selectedDefinitionId}
                            onChange={(e) => setSelectedDefinitionId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                        >
                            <option value="">Selecione um modelo de evento</option>
                            {existingEvents.map((evt) => (
                                <option key={evt.id} value={evt.id}>
                                    {evt.description}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-500">
                            Selecione um evento da biblioteca para vincular a esta OC. Você poderá editar os detalhes no card.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setIsEventModalOpen(false)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveEvent}
                            disabled={isSaving}
                            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                        >
                            {isSaving ? "Vinculando..." : "Vincular Evento"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal for Managing Event Library */}
            <Modal
                isOpen={isManageEventsModalOpen}
                onClose={() => setIsManageEventsModalOpen(false)}
                title="Gerenciar Biblioteca de Eventos"
            >
                <div className="space-y-6">
                    {/* Add/Edit Form Section */}

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h4 className="text-sm font-bold text-gray-700 mb-3">{editingDefinitionId ? "Editar Evento" : "Novo Modelo de Evento"}</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Evento</label>
                                <input
                                    type="text"
                                    value={eventDescription}
                                    onChange={(e) => setEventDescription(e.target.value)}
                                    className="w-full rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base p-3 transition-all hover:border-gray-300"
                                    placeholder="Ex: Instalação Elétrica"
                                />
                            </div>

                            {/* Optional Fields Container */}
                            <div className="grid grid-cols-1 gap-4 bg-white/50 p-4 rounded-xl border border-gray-200/50">
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Configurações Padrão</h5>

                                <div className="flex items-center justify-between p-2 hover:bg-white/50 rounded-lg transition-colors">
                                    <span className="text-sm font-medium text-gray-700">Data de Início</span>
                                    <div className="flex items-center gap-3">
                                        <div className={`transition-all duration-300 overflow-hidden ${useStartDate ? 'w-40 opacity-100' : 'w-0 opacity-0'}`}>
                                            <input type="date" value={eventStartDate} onChange={e => setEventStartDate(e.target.value)} className="w-full text-sm p-1.5 border-gray-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                        </div>
                                        <ToggleSwitch checked={useStartDate} onChange={setUseStartDate} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-2 hover:bg-white/50 rounded-lg transition-colors">
                                    <span className="text-sm font-medium text-gray-700">Data de Fim</span>
                                    <div className="flex items-center gap-3">
                                        <div className={`transition-all duration-300 overflow-hidden ${useEndDate ? 'w-40 opacity-100' : 'w-0 opacity-0'}`}>
                                            <input type="date" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)} className="w-full text-sm p-1.5 border-gray-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                        </div>
                                        <ToggleSwitch checked={useEndDate} onChange={setUseEndDate} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-2 hover:bg-white/50 rounded-lg transition-colors">
                                    <span className="text-sm font-medium text-gray-700">Protocolo</span>
                                    <div className="flex items-center gap-3">
                                        <div className={`transition-all duration-300 overflow-hidden ${useProtocol ? 'w-40 opacity-100' : 'w-0 opacity-0'}`}>
                                            <input type="text" value={eventProtocol} onChange={e => setEventProtocol(e.target.value)} className="w-full text-sm p-1.5 border-gray-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Protocolo" />
                                        </div>
                                        <ToggleSwitch checked={useProtocol} onChange={setUseProtocol} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/50 p-4 rounded-xl border border-gray-200/50 space-y-3">
                                <label className="block text-sm font-medium text-gray-600">Opções de Status</label>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newStatusOption}
                                        onChange={(e) => setNewStatusOption(e.target.value)}
                                        placeholder="Nova opção (ex: Em Andamento)"
                                        className="flex-1 rounded-xl border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 transition-all hover:border-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddCustomStatusOption}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                                    >
                                        Adicionar
                                    </button>
                                </div>

                                {customStatusOptions.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {customStatusOptions.map(opt => (
                                            <span key={opt} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 group transition-all hover:bg-blue-100">
                                                {opt}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomStatusOption(opt)}
                                                    className="ml-2 text-blue-400 hover:text-red-500 focus:outline-none transition-colors"
                                                >
                                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic pl-1">Nenhuma opção configurada.</p>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-600">Definir Status Inicial?</span>
                                        <ToggleSwitch checked={useStatus} onChange={setUseStatus} />
                                    </div>
                                    {useStatus && (
                                        <select
                                            value={eventStatus}
                                            onChange={e => setEventStatus(e.target.value)}
                                            className="text-sm pl-3 pr-8 py-1.5 border-gray-200 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Selecione...</option>
                                            {customStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={handleSaveDefinition}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                                >
                                    {editingDefinitionId ? "Atualizar" : "Criar Modelo"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* List Section */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-3">Eventos Disponíveis</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {existingEvents.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">Nenhum evento na biblioteca.</p>
                            ) : (
                                existingEvents.map(def => (
                                    <div key={def.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{def.description}</p>
                                            <p className="text-xs text-gray-500 truncate max-w-xs">
                                                Opções: {def.default_status_options?.join(", ") || "Nenhuma"}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditDefinition(def)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(def.id, 'definition')}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={`Excluir ${deleteTarget?.type === 'oc' ? 'OC' : deleteTarget?.type === 'event' ? 'Evento' : 'Definição'}`}>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir?
                        <br />
                        <span className="font-bold text-gray-900">{deleteTarget?.id}</span>
                        <br /><span className="text-xs text-red-500">Essa ação não pode ser desfeita.</span>
                    </p>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm">Excluir</button>
                    </div>
                </div>
            </Modal>

            {/* Alert Modal */}
            <Modal isOpen={isAlertModalOpen} onClose={() => setIsAlertModalOpen(false)} title={editingAlert ? "Editar Alerta" : "Criar Alerta"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Obra</label>
                        <select value={alertWorkId} onChange={e => setAlertWorkId(e.target.value)} className="w-full mt-1 rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200">
                            <option value="">Todas as Obras</option>
                            {works.map(w => <option key={w.id} value={w.id}>{w.id} - {w.regional}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Etapa / Evento</label>
                        <input type="text" value={alertEventFilter} onChange={e => setAlertEventFilter(e.target.value)} placeholder="Filtrar por nome do evento..." className="w-full mt-1 rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200" />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Lembrete Recorrente</span>
                            <ToggleSwitch checked={alertRecurrenceActive} onChange={setAlertRecurrenceActive} />
                        </div>
                        {alertRecurrenceActive && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">A cada</span>
                                <input type="number" value={alertRecurrenceDays} onChange={e => setAlertRecurrenceDays(Number(e.target.value))} className="w-16 p-1 text-sm border rounded" />
                                <span className="text-xs text-gray-500">dias</span>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Alerta de Vencimento</span>
                            <ToggleSwitch checked={alertLeadTimeActive} onChange={setAlertLeadTimeActive} />
                        </div>
                        {alertLeadTimeActive && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Avisar</span>
                                <input type="number" value={alertLeadTimeDays} onChange={e => setAlertLeadTimeDays(Number(e.target.value))} className="w-16 p-1 text-sm border rounded" />
                                <span className="text-xs text-gray-500">dias antes</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setIsAlertModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancelar</button>
                        <button onClick={handleSaveAlert} className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all">Salvar Alerta</button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
