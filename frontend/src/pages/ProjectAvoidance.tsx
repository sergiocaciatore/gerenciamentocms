
import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import { getAuthToken } from "../firebase";
import { type RegistrationWork } from "../types/Registration";

interface CapexItem {
    id: string;
    value: number;
    created_at: string;
    description: string;
}

interface RequestItem {
    id: string;
    date: string;
    description: string;
    responsible: string;
    value: number;
}

interface ProjectAvoidanceItem {
    work_id: string;
    status: string;
    capex_items: CapexItem[];
    requests?: RequestItem[]; // Added requests list
}

export default function ProjectAvoidance() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [works, setWorks] = useState<RegistrationWork[]>([]);
    const [selectedWorkId, setSelectedWorkId] = useState("");

    // State for cards
    const [displayedWorks, setDisplayedWorks] = useState<RegistrationWork[]>([]);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Project Avoidance Items Map (to store auxiliary data like capex_items)
    const [paItemsMap, setPaItemsMap] = useState<Record<string, ProjectAvoidanceItem>>({});

    // Delete Confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteType, setDeleteType] = useState<'WORK' | 'CAPEX' | 'REQUEST'>('WORK');
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Capex Modal
    const [isCapexModalOpen, setIsCapexModalOpen] = useState(false);
    const [capexWorkId, setCapexWorkId] = useState<string | null>(null);
    const [editingCapexId, setEditingCapexId] = useState<string | null>(null);
    const [capexValue, setCapexValue] = useState("");
    const [capexDescription, setCapexDescription] = useState("");

    // Request Modal
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestWorkId, setRequestWorkId] = useState<string | null>(null);
    const [requestDate, setRequestDate] = useState("");
    const [requestDescription, setRequestDescription] = useState("");
    const [requestResponsible, setRequestResponsible] = useState("");
    const [requestValue, setRequestValue] = useState("");

    // Initial Data Fetch
    useEffect(() => {
        const loadInv = async () => {
            try {
                const token = await getAuthToken();
                const headers = { Authorization: `Bearer ${token}` };

                // 1. Fetch All Works
                const worksRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, { headers });
                const allWorks: RegistrationWork[] = worksRes.ok ? await worksRes.json() : [];
                setWorks(allWorks);

                // 2. Fetch Project Avoidance Items
                const paRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances`, { headers });
                if (paRes.ok) {
                    const paItems = await paRes.json();

                    // Create a map for easy lookup
                    const itemsMap: Record<string, ProjectAvoidanceItem> = {};
                    paItems.forEach((item: ProjectAvoidanceItem) => {
                        const cleanId = (item.work_id || "").trim();
                        const existing = itemsMap[cleanId];

                        // Heuristic: Prefer item with data (capex or requests) over empty/default one
                        const hasData = (item.capex_items && item.capex_items.length > 0) || (item.requests && item.requests.length > 0);
                        const existingHasData = existing && ((existing.capex_items && existing.capex_items.length > 0) || (existing.requests && existing.requests.length > 0));

                        if (!existing || (hasData && !existingHasData)) {
                            itemsMap[cleanId] = { ...item, work_id: cleanId };
                        }
                    });
                    setPaItemsMap(itemsMap);

                    // Filter works that match the ids in PA items
                    const paIds = new Set(Object.keys(itemsMap));
                    const visibleWorks = allWorks.filter(w => paIds.has(w.id.trim()));
                    setDisplayedWorks(visibleWorks);
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInv();
    }, []);

    const handleConfirm = async () => {
        if (selectedWorkId) {
            const workToAdd = works.find(w => w.id === selectedWorkId);
            if (!workToAdd) return;

            // Optimistic update
            setDisplayedWorks(prev => {
                if (prev.some(w => w.id === workToAdd.id)) return prev;
                return [...prev, workToAdd];
            });
            // Init empty item in map
            setPaItemsMap(prev => ({ ...prev, [workToAdd.id.trim()]: { work_id: workToAdd.id.trim(), capex_items: [], requests: [], status: "Active" } }));

            setIsModalOpen(false);
            setSelectedWorkId("");

            try {
                const token = await getAuthToken();
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ work_id: workToAdd.id.trim() })
                });
            } catch (error) {
                console.error("Error creating PA:", error);
                // Revert on error? For MVP we just log
            }
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
        );
    };

    const handleDeleteClick = (id: string) => {
        setDeleteType('WORK');
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteCapexClick = (workId: string, capexId: string) => {
        setDeleteType('CAPEX');
        setItemToDelete(capexId);
        setCapexWorkId(workId); // Context for deletion
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        if (deleteType === 'WORK') {
            // Optimistic update
            setDisplayedWorks(prev => prev.filter(w => w.id !== itemToDelete));
            setIsDeleteModalOpen(false);

            try {
                const token = await getAuthToken();
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${itemToDelete}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (error) {
                console.error("Error deleting PA:", error);
            }
        } else if (deleteType === 'CAPEX' && capexWorkId) {
            // Remove from local state
            const currentPaItem = paItemsMap[capexWorkId];
            if (!currentPaItem) return;

            const updatedCapexItems = currentPaItem.capex_items.filter(i => i.id !== itemToDelete);
            const updatedPaItem = { ...currentPaItem, capex_items: updatedCapexItems };

            setPaItemsMap(prev => ({ ...prev, [capexWorkId]: updatedPaItem }));
            setIsDeleteModalOpen(false);

            // Persist
            try {
                const token = await getAuthToken();
                // We update the PA record with the new list (minus the deleted one)
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${capexWorkId.trim()}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(updatedPaItem)
                });
            } catch (error) {
                console.error("Error deleting Capex:", error);
            }
        }

        setItemToDelete(null);
    };

    const confirmDeleteRequest = async () => {
        if (!itemToDelete || !requestWorkId) return;

        const currentPaItem = paItemsMap[requestWorkId];
        if (!currentPaItem) return;

        const updatedRequests = (currentPaItem.requests || []).filter(i => i.id !== itemToDelete);
        const updatedPaItem = { ...currentPaItem, requests: updatedRequests };

        setPaItemsMap(prev => ({ ...prev, [requestWorkId]: updatedPaItem }));
        setIsDeleteModalOpen(false);

        try {
            const token = await getAuthToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${requestWorkId.trim()}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPaItem)
            });
        } catch (error) {
            console.error("Error deleting Request:", error);
        }
    };

    const handleDeleteRequestClick = (workId: string, requestId: string) => {
        setDeleteType('REQUEST');
        setItemToDelete(requestId);
        setRequestWorkId(workId);
        setIsDeleteModalOpen(true);
    };

    const openCapexModal = (workId: string, itemToEdit?: CapexItem) => {
        setCapexWorkId(workId);
        if (itemToEdit) {
            setEditingCapexId(itemToEdit.id);
            setCapexValue(itemToEdit.value.toFixed(2).replace('.', ','));
            setCapexDescription(itemToEdit.description || "Novo Capex");
        } else {
            setEditingCapexId(null);
            setCapexValue("");
            setCapexDescription("Novo Capex");
        }
        setIsCapexModalOpen(true);
    };

    const handleSaveCapex = async () => {
        if (!capexWorkId || !capexValue) return;

        const val = parseFloat(capexValue.replace("R$", "").replace(/\./g, "").replace(",", ".")) || 0;

        // Optimistic Update
        const currentPaItem = paItemsMap[capexWorkId] || { work_id: capexWorkId, capex_items: [], status: "Active" };
        let updatedCapexItems = [...(currentPaItem.capex_items || [])];

        if (editingCapexId) {
            // Edit existing
            updatedCapexItems = updatedCapexItems.map(item =>
                item.id === editingCapexId ? { ...item, value: val, description: capexDescription } : item
            );
        } else {
            // Create new
            const newItem: CapexItem = {
                id: crypto.randomUUID(),
                value: val,
                created_at: new Date().toISOString(),
                description: capexDescription || "Novo Capex"
            };
            updatedCapexItems.push(newItem);
        }

        const updatedPaItem = {
            ...currentPaItem,
            capex_items: updatedCapexItems,
            requests: currentPaItem.requests || []
        };

        setPaItemsMap(prev => ({ ...prev, [capexWorkId.trim()]: updatedPaItem }));
        setIsCapexModalOpen(false);

        try {
            const token = await getAuthToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${capexWorkId.trim()}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPaItem)
            });
        } catch (error) {
            console.error("Error saving Capex:", error);
        }
    };

    const openRequestModal = (workId: string) => {
        setRequestWorkId(workId);
        setRequestDate(new Date().toISOString().split('T')[0]);
        setRequestDescription("");
        setRequestResponsible("");
        setRequestValue("");
        setIsRequestModalOpen(true);
    };

    const handleSaveRequest = async () => {
        if (!requestWorkId || !requestValue || !requestDescription) return;

        const newItem: RequestItem = {
            id: crypto.randomUUID(),
            date: requestDate,
            description: requestDescription,
            responsible: requestResponsible,
            value: parseFloat(requestValue.replace("R$", "").replace(/\./g, "").replace(",", ".")) || 0
        };

        const currentPaItem = paItemsMap[requestWorkId] || { work_id: requestWorkId, capex_items: [], requests: [] };
        const updatedPaItem = {
            ...currentPaItem,
            requests: [...(currentPaItem.requests || []), newItem]
        };

        setPaItemsMap(prev => ({ ...prev, [requestWorkId.trim()]: updatedPaItem }));
        setIsRequestModalOpen(false);

        try {
            const token = await getAuthToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${requestWorkId.trim()}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPaItem)
            });
        } catch (error) {
            console.error("Error saving Request:", error);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="relative min-h-full w-full">
            <div className="mr-80 px-8 py-8 w-auto mx-0">
                <h1 className="text-2xl font-bold text-white mb-6">Project Avoidance</h1>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                ) : displayedWorks.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                        <p className="text-white">Nenhum projeto selecionado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 pb-20">
                        {displayedWorks.map(work => {
                            const isExpanded = expandedIds.includes(work.id);
                            const paItem = paItemsMap[work.id] || {};
                            const capexItems = paItem.capex_items || [];

                            return (
                                <div key={work.id} className={`relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all hover:bg-white/50 group flex flex-col ${isExpanded ? 'col-span-full' : 'col-span-1'}`}>

                                    {/* Action Buttons */}
                                    <div className="absolute top-4 right-4 flex gap-2 z-20">

                                        <button
                                            onClick={() => handleDeleteClick(work.id)}
                                            className="p-1.5 rounded-full bg-white/50 hover:bg-red-100 text-red-600 transition-colors shadow-sm"
                                            title="Excluir"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => toggleExpand(work.id)}
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
                                    </div>

                                    {/* Card Content */}
                                    <div className="relative z-10 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3 w-full">
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100/50 text-blue-700 border border-blue-200/50 uppercase tracking-wider">{work.id}</span>
                                                {/* Progress Bar */}
                                                {(() => {
                                                    const cleanWorkId = (work.id || "").trim();
                                                    const requests = paItemsMap[cleanWorkId]?.requests || [];
                                                    const capexItems = paItemsMap[cleanWorkId]?.capex_items || [];
                                                    const totalCapex = capexItems.reduce((acc, item) => acc + item.value, 0);
                                                    const totalSpent = requests.reduce((acc, item) => acc + item.value, 0);
                                                    const percentage = totalCapex > 0 ? (totalSpent / totalCapex) * 100 : 0;

                                                    let barColor = "bg-green-500";
                                                    if (percentage > 90) barColor = "bg-red-500";
                                                    else if (percentage > 75) barColor = "bg-yellow-500";

                                                    return totalCapex > 0 ? (
                                                        <div className="flex-1 ml-4 mr-8 max-w-xs">
                                                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                                                                <span>Consumo Orçamento</span>
                                                                <span>{percentage.toFixed(1)}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-gray-200/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${barColor} transition-all duration-700 ease-out`}
                                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 mb-1">{work.regional || "Sem Regional"}</h3>
                                        <p className="text-sm font-medium text-gray-700 mb-0.5">{work.work_type || "-"}</p>

                                        {/* Expanded Content with Smooth Transition */}
                                        <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                            <div className="overflow-hidden">
                                                <div className="pt-4 border-t border-white/50">

                                                    {/* Details */}
                                                    <div className="bg-white/30 rounded-lg p-4 mb-4">
                                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                                                            <div>
                                                                <span className="block text-gray-500 text-xs mb-1 uppercase tracking-wide">CEP</span>
                                                                <span className="font-medium">{work.cep || "-"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-gray-500 text-xs mb-1 uppercase tracking-wide">Endereço</span>
                                                                <span className="font-medium">{work.address ? `${work.address.street}, ${work.address.number}` : "-"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-gray-500 text-xs mb-1 uppercase tracking-wide">CNPJ</span>
                                                                <span className="font-medium">{work.cnpj || "-"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-gray-500 text-xs mb-1 uppercase tracking-wide">Go Live</span>
                                                                <span className="font-medium">{work.go_live_date || "-"}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* New Capex Button */}
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        <button
                                                            onClick={() => openCapexModal(work.id)}
                                                            className="px-3 py-1.5 bg-blue-600/90 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                            </svg>
                                                            Novo Capex
                                                        </button>
                                                        <button
                                                            onClick={() => openRequestModal(work.id)}
                                                            className="px-3 py-1.5 bg-green-600/90 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                            </svg>
                                                            Nova Solicitação
                                                        </button>
                                                    </div>

                                                </div>

                                                {/* Double Column Grid for Capex and Requests */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                                    {/* Capex Column */}
                                                    <div>
                                                        {capexItems.length > 0 && (
                                                            <div className="space-y-2">
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2">Capex</h4>
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    {capexItems.map((item: CapexItem) => (
                                                                        <div key={item.id} className="bg-white/60 backdrop-blur-md rounded-xl p-3 border border-white/50 shadow-sm flex items-center justify-between group/capex relative pr-12">
                                                                            {/* Hover Actions - Bottom Right */}
                                                                            <div className="absolute right-2 bottom-2 hidden group-hover/capex:flex gap-1 z-10">
                                                                                <button
                                                                                    onClick={() => openCapexModal(work.id, item)}
                                                                                    className="p-1 rounded-full bg-blue-100/90 hover:bg-blue-200 text-blue-600 transition-colors shadow-sm"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteCapexClick(work.id, item.id)}
                                                                                    className="p-1 rounded-full bg-red-100/90 hover:bg-red-200 text-red-600 transition-colors shadow-sm"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>

                                                                            <div>
                                                                                <span className="block text-[10px] text-gray-500 uppercase tracking-wide">{item.description || "Capex"}</span>
                                                                                <span className="text-sm font-bold text-gray-800">{formatCurrency(item.value)}</span>
                                                                            </div>
                                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center opacity-40">
                                                                                <span className="text-blue-600 text-xs font-bold">$</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Requests Column */}
                                                    <div>
                                                        {(paItem.requests && paItem.requests.length > 0) && (
                                                            <div className="space-y-2">
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2">Solicitações</h4>
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    {paItem.requests.map((item: RequestItem) => (
                                                                        <div key={item.id} className="bg-white/60 backdrop-blur-md rounded-xl p-3 border border-white/50 shadow-sm flex items-center justify-between group/request relative pr-8">

                                                                            {/* Delete Action only for now */}
                                                                            <div className="absolute right-2 bottom-2 hidden group-hover/request:flex gap-1 z-10">
                                                                                <button
                                                                                    onClick={() => handleDeleteRequestClick(work.id, item.id)}
                                                                                    className="p-1 rounded-full bg-red-100/90 hover:bg-red-200 text-red-600 transition-colors shadow-sm"
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>

                                                                            <div className="flex-1 min-w-0 mr-4">
                                                                                <div className="flex justify-between items-baseline mb-1">
                                                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{item.responsible}</span>
                                                                                    <span className="text-[10px] text-gray-400">{item.date.split('-').reverse().slice(0, 2).join('/')}</span>
                                                                                </div>
                                                                                <span className="block text-xs text-gray-800 font-medium truncate mb-1" title={item.description}>{item.description}</span>
                                                                                <span className="text-sm font-bold text-gray-900">{formatCurrency(item.value)}</span>
                                                                            </div>
                                                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center opacity-40 shrink-0">
                                                                                <span className="text-green-600 text-xs font-bold">R</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
                }
            </div>

            {/* Floating Sidebar */}
            <div className="fixed right-8 top-32 flex flex-col gap-4 w-72 z-20">
                {/* Actions Section */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ações</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex flex-col items-center justify-center p-3 bg-white/60 hover:bg-white/80 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                <span className="text-blue-600 text-lg font-bold">+</span>
                            </div>
                            <span className="text-[10px] font-medium text-gray-600">Novo</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Work Selection Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Selecionar Obra">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Obra</label>
                        <select
                            value={selectedWorkId}
                            onChange={(e) => setSelectedWorkId(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        >
                            <option value="">Selecione uma obra...</option>
                            {works.map((work) => (
                                <option key={work.id} value={work.id}>
                                    {work.id} - {work.regional}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedWorkId}
                            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all shadow-md ${selectedWorkId ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg" : "bg-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)
                }
                title={deleteType === 'WORK' ? "Remover Obra" : deleteType === 'CAPEX' ? "Excluir Capex" : "Excluir Solicitação"}
            >
                <div>
                    <p className="text-sm text-gray-600 mb-4">
                        {deleteType === 'WORK'
                            ? "Tem certeza que deseja remover esta obra do Project Avoidance? Esta ação não pode ser desfeita."
                            : deleteType === 'CAPEX'
                                ? "Tem certeza que deseja excluir este item Capex? O valor será removido do total."
                                : "Tem certeza que deseja excluir esta solicitação? O valor será removido do consumo."
                        }
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                if (deleteType === 'REQUEST') confirmDeleteRequest();
                                else confirmDelete();
                            }}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Excluir
                        </button>
                    </div>
                </div>
            </Modal >

            {/* Capex Modal */}
            < Modal isOpen={isCapexModalOpen} onClose={() => setIsCapexModalOpen(false)} title={editingCapexId ? "Editar Capex" : "Novo Capex"} >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
                        <input
                            type="text"
                            value={capexDescription}
                            onChange={(e) => setCapexDescription(e.target.value)}
                            placeholder="Ex: Instalação Elétrica"
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={capexValue}
                            onChange={(e) => setCapexValue(e.target.value)}
                            placeholder="0.00"
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Insira o valor em Reais.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsCapexModalOpen(false)}
                            className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveCapex}
                            disabled={!capexValue}
                            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all shadow-md ${capexValue ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg" : "bg-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal >

            {/* Request Modal */}
            < Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Nova Solicitação" >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Data da Requisição</label>
                        <input
                            type="date"
                            value={requestDate}
                            onChange={(e) => setRequestDate(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
                        <input
                            type="text"
                            value={requestDescription}
                            onChange={(e) => setRequestDescription(e.target.value)}
                            placeholder="Ex: Compra de material"
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Responsável</label>
                        <input
                            type="text"
                            value={requestResponsible}
                            onChange={(e) => setRequestResponsible(e.target.value)}
                            placeholder="Nome do responsável"
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={requestValue}
                            onChange={(e) => setRequestValue(e.target.value)}
                            placeholder="0.00"
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsRequestModalOpen(false)}
                            className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveRequest}
                            disabled={!requestValue || !requestDescription}
                            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all shadow-md ${requestValue && requestDescription ? "bg-green-600 hover:bg-green-700 hover:shadow-lg" : "bg-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal >
        </div >
    );

}

