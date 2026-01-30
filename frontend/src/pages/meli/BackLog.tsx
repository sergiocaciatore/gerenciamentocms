import { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "../../firebase";
import Toast from "../../components/Toast";
import Modal from "../../components/Modal";
import type { Work, BacklogItem } from "../../types/BackLog";

export default function BackLog() {
    // --- State ---
    const [works, setWorks] = useState<Work[]>([]);
    const [items, setItems] = useState<BacklogItem[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("Todos");
    const [regionalFilter, setRegionalFilter] = useState("Todas");

    // UI State
    const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set());

    // Modals
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);
    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
    const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Selected Items
    const [selectedItemForAction, setSelectedItemForAction] = useState<BacklogItem | null>(null);
    const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null); // Track which event is being edited
    const [isEditingItem, setIsEditingItem] = useState(false); // Mode for Item Modal

    // Form Data
    const [newItemData, setNewItemData] = useState<{
        work_id: string;
        start_date: string;
        sla: number | "";
        description: string;
        has_timeline: boolean;
    }>({
        work_id: "",
        start_date: new Date().toISOString().split('T')[0],
        sla: "",
        description: "",
        has_timeline: false
    });

    const [annotationData, setAnnotationData] = useState({
        date: new Date().toISOString().split('T')[0],
        description: ""
    });

    const [timelineEventData, setTimelineEventData] = useState({
        date: new Date().toISOString().split('T')[0],
        description: "",
        status: "Pendente"
    });

    const [finalizeData, setFinalizeData] = useState({
        date: new Date().toISOString().split('T')[0],
        description: ""
    });

    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // --- Helpers / Fetching ---

    const fetchWorks = useCallback(async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setWorks(await res.json());
            }
        } catch (error) {
            console.error("Error fetching works:", error);
            setToast({ message: "Erro ao carregar obras", type: "error" });
        }
    }, []);

    const fetchItems = useCallback(async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/backlog-items`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setItems(await res.json());
            }
        } catch (error) {
            console.error("Error fetching items:", error);
        }
    }, []);

    // --- Effects ---
    useEffect(() => {
        const init = async () => {
            await fetchWorks();
            await fetchItems();
        };
        init();
    }, [fetchWorks, fetchItems]);

    // --- Helpers ---
    const calculateEndDate = (startDate: string, sla: number) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + sla);
        return d.toLocaleDateString();
    };

    const toggleTimeline = (id: string) => {
        const newSet = new Set(expandedTimelines);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedTimelines(newSet);
    };

    const updateItem = async (updatedItem: BacklogItem) => {
        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/backlog-items/${updatedItem.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(updatedItem)
            });

            if (res.ok) {
                setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error updating item:", error);
            return false;
        }
    };

    const resetNewItemForm = () => {
        setNewItemData({
            work_id: "",
            start_date: new Date().toISOString().split('T')[0],
            sla: "",
            description: "",
            has_timeline: false
        });
        setIsEditingItem(false);
        setSelectedItemForAction(null);
    };

    // --- Actions ---

    const handleOpenNewItem = () => {
        resetNewItemForm();
        setIsNewModalOpen(true);
    };

    const handleOpenEditItem = (item: BacklogItem) => {
        setNewItemData({
            work_id: item.work_id,
            start_date: item.start_date,
            sla: item.sla,
            description: item.description,
            has_timeline: item.has_timeline
        });
        setSelectedItemForAction(item);
        setIsEditingItem(true);
        setIsNewModalOpen(true);
    };

    const handleSaveItem = async () => {
        if (!newItemData.work_id || !newItemData.description || newItemData.sla === "") {
            setToast({ message: "Preencha os campos obrigatórios", type: "error" });
            return;
        }

        const slaValue = Number(newItemData.sla);

        if (isEditingItem && selectedItemForAction) {
            // Update Existing
            const updated: BacklogItem = {
                ...selectedItemForAction,
                work_id: newItemData.work_id,
                start_date: newItemData.start_date,
                sla: slaValue,
                description: newItemData.description,
                has_timeline: newItemData.has_timeline
            };
            if (await updateItem(updated)) {
                setToast({ message: "Item atualizado!", type: "success" });
                setIsNewModalOpen(false);
                resetNewItemForm();
            }
        } else {
            // Create New
            const newItem: BacklogItem = {
                id: crypto.randomUUID(),
                work_id: newItemData.work_id,
                start_date: newItemData.start_date,
                sla: slaValue,
                description: newItemData.description,
                status: 'Novo',
                has_timeline: newItemData.has_timeline,
                annotations: []
            };
            try {
                const token = await getAuthToken();
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/backlog-items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify(newItem)
                });
                if (res.ok) {
                    setItems(prev => [newItem, ...prev]);
                    setToast({ message: "Item criado com sucesso!", type: "success" });
                    setIsNewModalOpen(false);
                    resetNewItemForm();
                }
            } catch (error) {
                console.error("Error saving item:", error);
                setToast({ message: "Erro ao criar", type: "error" });
            }
        }
    };

    const handleAddAnnotation = async () => {
        if (!selectedItemForAction || !annotationData.description) return;
        const updatedItem = {
            ...selectedItemForAction,
            annotations: [...selectedItemForAction.annotations, annotationData]
        };
        if (await updateItem(updatedItem)) {
            setToast({ message: "Anotação adicionada!", type: "success" });
            setIsAnnotationModalOpen(false);
            setAnnotationData({ date: new Date().toISOString().split('T')[0], description: "" });
            setSelectedItemForAction(null);
        }
    };

    // --- Timeline Event Logic (Create/Update) ---
    const openTimelineModal = (item: BacklogItem, eventIndex: number | null = null) => {
        setSelectedItemForAction(item);
        setEditingEventIndex(eventIndex);
        if (eventIndex !== null && item.timeline_events) {
            // Editing existing
            const evt = item.timeline_events[eventIndex];
            setTimelineEventData({ ...evt });
        } else {
            // New event
            setTimelineEventData({ date: new Date().toISOString().split('T')[0], description: "", status: "Pendente" });
        }
        setIsTimelineModalOpen(true);
    };

    const handleSaveTimelineEvent = async () => {
        if (!selectedItemForAction || !timelineEventData.description) return;

        const currentEvents = [...(selectedItemForAction.timeline_events || [])];

        if (editingEventIndex !== null) {
            // Update existing
            currentEvents[editingEventIndex] = timelineEventData;
        } else {
            // Add new
            currentEvents.push(timelineEventData);
        }

        const updatedItem = {
            ...selectedItemForAction,
            timeline_events: currentEvents
        };

        if (await updateItem(updatedItem)) {
            setToast({ message: editingEventIndex !== null ? "Evento atualizado!" : "Evento adicionado!", type: "success" });
            setIsTimelineModalOpen(false);
            setTimelineEventData({ date: new Date().toISOString().split('T')[0], description: "", status: "Pendente" });
            setEditingEventIndex(null);
            setSelectedItemForAction(null);
        }
    };

    const handleDeleteTimelineEvent = async (item: BacklogItem, index: number) => {
        const currentEvents = [...(item.timeline_events || [])];
        currentEvents.splice(index, 1);
        const updatedItem = { ...item, timeline_events: currentEvents };

        if (await updateItem(updatedItem)) {
            setToast({ message: "Evento removido", type: "success" });
        }
    };


    const handleFinalizeItem = async () => {
        if (!selectedItemForAction || !finalizeData.description) return;
        const updatedItem: BacklogItem = {
            ...selectedItemForAction,
            status: 'Concluído',
            completion: finalizeData
        };
        if (await updateItem(updatedItem)) {
            setToast({ message: "Item finalizado!", type: "success" });
            setIsFinalizeModalOpen(false);
            setSelectedItemForAction(null);
        }
    };

    // --- Delete ---
    const handleDeleteItem = async () => {
        if (!selectedItemForAction || isDeleting) return;
        setIsDeleting(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/backlog-items/${selectedItemForAction.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                setItems(prev => prev.filter(i => i.id !== selectedItemForAction.id));
                setToast({ message: "Item excluído", type: 'success' });
                setIsDeleteModalOpen(false);
            } else {
                setToast({ message: "Erro ao excluir o item", type: "error" });
            }
        } catch (e) {
            console.error(e);
            setToast({ message: "Erro de conexão", type: "error" });
        } finally {
            setIsDeleting(false);
        }
    };


    // --- Filtering ---
    const uniqueRegionals = Array.from(new Set(works.map(w => w.regional).filter(Boolean)));
    const filteredItems = items.filter(item => {
        const work = works.find(w => w.id === item.work_id);
        const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            work?.site?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.work_id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "Todos" || item.status === statusFilter;
        const matchesRegional = regionalFilter === "Todas" || work?.regional === regionalFilter;
        return matchesSearch && matchesStatus && matchesRegional;
    });

    return (
        <div className="relative min-h-screen w-full font-sans text-gray-900">
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
                            placeholder="Buscar (Descrição, Regional, ID...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 sm:text-sm shadow-sm hover:shadow-md"
                        />
                    </div>
                    <div className="flex gap-2 min-w-[300px]">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm hover:shadow-md bg-white">
                            <option value="Todos">Status: Todos</option>
                            <option value="Novo">Novo</option>
                            <option value="Em Andamento">Em Andamento</option>
                            <option value="Concluído">Concluído</option>
                        </select>
                        <select value={regionalFilter} onChange={(e) => setRegionalFilter(e.target.value)} className="block w-full pl-3 pr-10 py-2 text-base border-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm hover:shadow-md bg-white">
                            <option value="Todas">Regional: Todas</option>
                            {uniqueRegionals.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
                    <button
                        onClick={() => { setSelectedItemForAction(null); setIsAnnotationModalOpen(true); }}
                        className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm hover:shadow-md"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2 text-amber-500"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        Nova Anotação
                    </button>
                    <button
                        onClick={handleOpenNewItem}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Novo Item
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full px-4 lg:px-8 pb-8 mx-0">
                {/* List of Items */}
                <div className="flex flex-col gap-4">
                    {filteredItems.map(item => {
                        const work = works.find(w => w.id === item.work_id);
                        const isExpanded = expandedTimelines.has(item.id);
                        const isCompleted = item.completion;

                        return (
                            <div
                                key={item.id}
                                className={`rounded-xl border shadow-sm transition-all relative group overflow-hidden ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:shadow-md'
                                    }`}
                            >
                                <div className="p-4 flex flex-col gap-4">
                                    {/* Header Row */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-sm">
                                                {item.work_id}
                                            </span>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500 uppercase font-bold">{work?.regional || "Regional N/A"}</span>
                                                    {item.created_by && item.created_at && (
                                                        <span className="text-[10px] text-gray-400 font-medium">
                                                            • Criado por <span className="text-gray-600">{item.created_by}</span> em {item.created_at}
                                                        </span>
                                                    )}
                                                </div>
                                                {work?.site && <span className="text-sm font-medium text-gray-800">{work.site}</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {!isCompleted && (
                                                <button
                                                    onClick={() => { setSelectedItemForAction(item); setIsFinalizeModalOpen(true); }}
                                                    title="Finalizar e Concluir Item"
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm active:scale-95"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                    Finalizar
                                                </button>
                                            )}

                                            {/* Edit Button */}
                                            <button
                                                onClick={() => handleOpenEditItem(item)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="Editar Informações"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>

                                            <button
                                                onClick={() => { setSelectedItemForAction(item); setIsDeleteModalOpen(true); }}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                title="Excluir Item"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>

                                            {item.has_timeline && (
                                                <button
                                                    onClick={() => toggleTimeline(item.id)}
                                                    className={`p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors ${isExpanded ? 'bg-gray-100 text-gray-600' : ''}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-gray-700 bg-white/50 p-3 rounded-lg border border-white/60 italic">
                                        "{item.description}"
                                    </p>

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-4 gap-4 text-xs">
                                        <div>
                                            <span className="block text-gray-400 font-bold uppercase mb-1">Início</span>
                                            <span className="font-mono text-gray-700">{new Date(item.start_date).toLocaleDateString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-400 font-bold uppercase mb-1">SLA</span>
                                            <span className="font-mono text-gray-700">{item.sla} dias</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-400 font-bold uppercase mb-1">Data Término</span>
                                            <span className="font-mono text-blue-700 font-bold">{calculateEndDate(item.start_date, item.sla)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-400 font-bold uppercase mb-1">Status</span>
                                            <span className={`font-bold ${item.status === 'Novo' ? 'text-blue-600' :
                                                item.status === 'Em Andamento' ? 'text-amber-600' : 'text-green-600'
                                                }`}>{item.status}</span>
                                        </div>
                                    </div>

                                    {/* Annotations Preview */}
                                    {item.annotations.length > 0 && (
                                        <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                                            {item.annotations.map((a, i) => (
                                                <div key={i} className="flex-shrink-0 text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-100 px-2 py-1 rounded max-w-[200px] truncate">
                                                    {a.description}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Timeline Section */}
                                {item.has_timeline && isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-fade-in">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Timeline</h4>
                                            <button
                                                onClick={() => openTimelineModal(item)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                                            >
                                                + Incluir Evento
                                            </button>
                                        </div>

                                        {!item.timeline_events || item.timeline_events.length === 0 ? (
                                            <p className="text-center text-xs text-gray-400 italic py-2">Nenhum evento registrado.</p>
                                        ) : (
                                            <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                                                {item.timeline_events.map((evt, idx) => (
                                                    <div key={idx} className="relative pl-6 group/event">
                                                        <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 z-10 ${evt.status === 'Finalizado' ? 'bg-green-500 border-green-600' : 'bg-white border-blue-400'
                                                            }`}></div>
                                                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-sm hover:border-blue-300 transition-colors">
                                                            <div className="flex justify-between mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-bold text-xs px-2 py-0.5 rounded-md ${evt.status === 'Finalizado' ? 'bg-green-100 text-green-700' :
                                                                        evt.status === 'Atrasado' ? 'bg-red-100 text-red-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                        }`}>{evt.status}</span>
                                                                    <span className="text-gray-400 text-xs">{new Date(evt.date).toLocaleDateString()}</span>
                                                                </div>
                                                                {/* Edit/Delete Event Actions */}
                                                                <div className="flex gap-1 opacity-0 group-hover/event:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => openTimelineModal(item, idx)}
                                                                        className="p-1 hover:bg-gray-100 rounded text-blue-600" title="Editar Evento">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteTimelineEvent(item, idx)}
                                                                        className="p-1 hover:bg-gray-100 rounded text-red-600" title="Excluir Evento">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-gray-600">{evt.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>



            {/* --- Modals --- */}

            <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title={isEditingItem ? "Editar Item" : "Novo Item"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
                        <select className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newItemData.work_id} onChange={e => setNewItemData({ ...newItemData, work_id: e.target.value })}>
                            <option value="">Selecione...</option>
                            {works.map(w => <option key={w.id} value={w.id}>{w.id} - {w.regional}</option>)}
                        </select>
                    </div>
                    {/* ... other fields same as before, condensed for brevity ... */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                            <input type="date" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newItemData.start_date} onChange={e => setNewItemData({ ...newItemData, start_date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SLA (dias)</label>
                            <input type="number" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newItemData.sla} onChange={e => setNewItemData({ ...newItemData, sla: e.target.value === "" ? "" : Number(e.target.value) })} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                        <textarea className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" rows={3} value={newItemData.description} onChange={e => setNewItemData({ ...newItemData, description: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={newItemData.has_timeline} onChange={e => setNewItemData({ ...newItemData, has_timeline: e.target.checked })} />
                        <label className="text-sm">Habilitar Timeline</label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsNewModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                        <button onClick={handleSaveItem} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">{isEditingItem ? "Atualizar" : "Criar"}</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isAnnotationModalOpen} onClose={() => setIsAnnotationModalOpen(false)} title="Nova Anotação">
                {/* ... annotation form ... */}
                <div className="space-y-4">
                    {!selectedItemForAction && (
                        <select className="w-full border p-2 rounded focus:ring-2 focus:ring-amber-500" onChange={e => setSelectedItemForAction(items.find(i => i.id === e.target.value) || null)}>
                            <option value="">Selecione o Item...</option>
                            {filteredItems.map(i => <option key={i.id} value={i.id}>{i.work_id} - {i.description}</option>)}
                        </select>
                    )}
                    <input type="date" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" value={annotationData.date} onChange={e => setAnnotationData({ ...annotationData, date: e.target.value })} />
                    <textarea className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" rows={3} value={annotationData.description} onChange={e => setAnnotationData({ ...annotationData, description: e.target.value })} placeholder="Anotação..." />
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsAnnotationModalOpen(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                        <button onClick={handleAddAnnotation} className="px-4 py-2 text-sm bg-amber-500 text-white rounded">Adicionar</button>
                    </div>
                </div>
            </Modal>

            {/* Timeline Event Modal - Refined (NO FRAMES) */}
            <Modal isOpen={isTimelineModalOpen} onClose={() => setIsTimelineModalOpen(false)} title={editingEventIndex !== null ? "Editar Evento" : "Novo Evento de Timeline"}>
                <div className="space-y-4">
                    <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={timelineEventData.date}
                        onChange={e => setTimelineEventData({ ...timelineEventData, date: e.target.value })}
                    />

                    <select
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500"
                        value={timelineEventData.status}
                        onChange={e => setTimelineEventData({ ...timelineEventData, status: e.target.value })}
                    >
                        <option value="Pendente">Pendente</option>
                        <option value="Em Aberto">Em Aberto</option>
                        <option value="Finalizado">Finalizado</option>
                        <option value="Atrasado">Atrasado</option>
                    </select>

                    <textarea
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        value={timelineEventData.description}
                        onChange={e => setTimelineEventData({ ...timelineEventData, description: e.target.value })}
                        placeholder="Descrição do evento..."
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsTimelineModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveTimelineEvent}
                            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-transform active:scale-95"
                        >
                            Salvar Evento
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Finalize Modal */}
            <Modal isOpen={isFinalizeModalOpen} onClose={() => setIsFinalizeModalOpen(false)} title="Finalizar Item">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">O item será marcado como concluído.</p>
                    <input type="date" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={finalizeData.date} onChange={e => setFinalizeData({ ...finalizeData, date: e.target.value })} />
                    <textarea className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" rows={3} value={finalizeData.description} onChange={e => setFinalizeData({ ...finalizeData, description: e.target.value })} placeholder="Observações de conclusão..." />
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsFinalizeModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                        <button onClick={handleFinalizeItem} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 shadow">Concluir</button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Excluir Item">
                <div className="space-y-4">
                    <p>Tem certeza que deseja excluir este item?</p>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50">Cancelar</button>
                        <button onClick={handleDeleteItem} disabled={isDeleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isDeleting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Excluindo...
                                </>
                            ) : "Excluir"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
