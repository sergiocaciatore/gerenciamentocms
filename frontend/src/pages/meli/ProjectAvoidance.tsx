
import { useState, useEffect } from "react";
import Modal from "../../components/Modal";
import { getAuthToken } from "../../firebase";
import { type RegistrationWork } from "../../types/Registration";

interface CapexItem {
    id: string;
    value: number;
    created_at: string;
    description: string;
}

interface ManagementItem {
    id: string;
    date: string;
    sla: number;
    description: string;
    notes?: string;
    requester: string;
    responsible: string;
}

interface RequestItem {
    id: string;
    date: string;
    description: string;
    responsible: string;
    value: number;
    managements?: ManagementItem[];
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

    // Sidebar Filters
    const [searchText, setSearchText] = useState("");
    const [filterRegional, setFilterRegional] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // State for cards
    const [displayedWorks, setDisplayedWorks] = useState<RegistrationWork[]>([]);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Project Avoidance Items Map (to store auxiliary data like capex_items)
    const [paItemsMap, setPaItemsMap] = useState<Record<string, ProjectAvoidanceItem>>({});

    // Delete Confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteType, setDeleteType] = useState<'WORK' | 'CAPEX' | 'REQUEST' | 'MANAGEMENT'>('WORK');
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
    const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

    // Management Modal
    const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
    const [managementWorkId, setManagementWorkId] = useState<string | null>(null);
    const [managementRequestId, setManagementRequestId] = useState<string | null>(null);
    const [editingManagementId, setEditingManagementId] = useState<string | null>(null);

    // Management Fields
    const [mgmtDate, setMgmtDate] = useState("");
    const [mgmtSla, setMgmtSla] = useState(""); // integer
    const [mgmtDescription, setMgmtDescription] = useState("");
    const [mgmtNotes, setMgmtNotes] = useState("");
    const [mgmtRequester, setMgmtRequester] = useState("");
    const [mgmtResponsible, setMgmtResponsible] = useState("");

    // Deletion extension
    const [managementIdToDelete, setManagementIdToDelete] = useState<string | null>(null);

    // Filter Logic
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchText);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchText]);

    useEffect(() => {
        if (!works.length) return;

        const filtered = works.filter(w => {
            // Must have PA entry
            if (!paItemsMap[w.id.trim()]) return false;

            // Search
            const searchLower = debouncedSearch.toLowerCase();
            const matchesSearch = !searchLower ||
                w.id.toLowerCase().includes(searchLower) ||
                (w.regional || "").toLowerCase().includes(searchLower);

            // Regional
            const matchesRegional = !filterRegional || w.regional === filterRegional;

            return matchesSearch && matchesRegional;
        });

        setDisplayedWorks(filtered);
    }, [works, paItemsMap, debouncedSearch, filterRegional]);

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

                    // Filter works that match the ids in PA items (initial load)
                    // Initial display will be handled by the Effect depending on paItemsMap
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
        setRequestWorkId(workId);
        setItemToDelete(requestId);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteManagementClick = (workId: string, requestId: string, mgmtId: string) => {
        setDeleteType('MANAGEMENT'); // Casting for quick extension or Update Type definition below
        setItemToDelete(null); // Not using the generic single ID because we need triple context

        // We need to store context. Re-using existing state vars or adding new ones?
        // Let's use specific vars for clarity as the structure is deep
        setManagementWorkId(workId);
        setManagementRequestId(requestId);
        setManagementIdToDelete(mgmtId);

        setIsDeleteModalOpen(true);
    };

    const confirmDeleteManagement = async () => {
        if (!managementWorkId || !managementRequestId || !managementIdToDelete) return;

        const currentPaItem = paItemsMap[managementWorkId];
        if (!currentPaItem || !currentPaItem.requests) return;

        const updatedRequests = currentPaItem.requests.map(req => {
            if (req.id === managementRequestId) {
                return {
                    ...req,
                    managements: (req.managements || []).filter(m => m.id !== managementIdToDelete)
                };
            }
            return req;
        });

        const updatedPaItem = { ...currentPaItem, requests: updatedRequests };

        setPaItemsMap(prev => ({ ...prev, [managementWorkId]: updatedPaItem }));
        setIsDeleteModalOpen(false);
        setManagementIdToDelete(null);

        try {
            const token = await getAuthToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${managementWorkId.trim()}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPaItem)
            });
        } catch (error) {
            console.error("Error deleting Management:", error);
        }
    };

    const openCapexModal = (workId: string, itemToEdit?: CapexItem) => {
        setCapexWorkId(workId);
        if (itemToEdit) {
            setEditingCapexId(itemToEdit.id);
            setCapexValue(itemToEdit.value.toFixed(2));
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

    const openRequestModal = (workId: string, itemToEdit?: RequestItem) => {
        setRequestWorkId(workId);
        if (itemToEdit) {
            setEditingRequestId(itemToEdit.id);
            setRequestDate(itemToEdit.date);
            setRequestDescription(itemToEdit.description);
            setRequestResponsible(itemToEdit.responsible);
            setRequestValue(itemToEdit.value.toFixed(2));
        } else {
            setEditingRequestId(null);
            setRequestDate(new Date().toISOString().split('T')[0]);
            setRequestDescription("");
            setRequestResponsible("");
            setRequestValue("");
        }
        setIsRequestModalOpen(true);
    };

    const handleSaveRequest = async () => {
        if (!requestWorkId || !requestValue || !requestDescription) return;

        const val = parseFloat(requestValue.replace("R$", "").replace(/\./g, "").replace(",", ".")) || 0;
        const currentPaItem = paItemsMap[requestWorkId] || { work_id: requestWorkId, capex_items: [], requests: [] };

        let updatedRequests = [...(currentPaItem.requests || [])];

        if (editingRequestId) {
            updatedRequests = updatedRequests.map(item =>
                item.id === editingRequestId ? {
                    ...item,
                    date: requestDate,
                    description: requestDescription,
                    responsible: requestResponsible,
                    value: val
                } : item
            );
        } else {
            const newItem: RequestItem = {
                id: crypto.randomUUID(),
                date: requestDate,
                description: requestDescription,
                responsible: requestResponsible,
                value: val
            };
            updatedRequests.push(newItem);
        }

        const updatedPaItem = {
            ...currentPaItem,
            requests: updatedRequests
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

    const openManagementModal = (workId: string, requestId: string, itemToEdit?: ManagementItem) => {
        setManagementWorkId(workId);
        setManagementRequestId(requestId);

        if (itemToEdit) {
            setEditingManagementId(itemToEdit.id);
            setMgmtDate(itemToEdit.date);
            setMgmtSla(itemToEdit.sla.toString());
            setMgmtDescription(itemToEdit.description);
            setMgmtNotes(itemToEdit.notes || "");
            setMgmtRequester(itemToEdit.requester);
            setMgmtResponsible(itemToEdit.responsible);
        } else {
            setEditingManagementId(null);
            setMgmtDate(new Date().toISOString().split('T')[0]);
            setMgmtSla("");
            setMgmtDescription("");
            setMgmtNotes("");
            setMgmtRequester("");
            setMgmtResponsible("");
        }
        setIsManagementModalOpen(true);
    };

    const handleSaveManagement = async () => {
        if (!managementWorkId || !managementRequestId || !mgmtDescription) return;

        const currentPaItem = paItemsMap[managementWorkId] || { work_id: managementWorkId, capex_items: [], requests: [] };
        // Deep copy to avoid direct mutation issues
        const updatedRequests = currentPaItem.requests ? [...currentPaItem.requests] : [];

        const requestIndex = updatedRequests.findIndex(r => r.id === managementRequestId);
        if (requestIndex === -1) return;

        // Clone the request and its managements
        const request = { ...updatedRequests[requestIndex] };
        let updatedManagements = request.managements ? [...request.managements] : [];

        if (editingManagementId) {
            updatedManagements = updatedManagements.map(m =>
                m.id === editingManagementId ? {
                    ...m,
                    date: mgmtDate,
                    sla: parseInt(mgmtSla) || 0,
                    description: mgmtDescription,
                    notes: mgmtNotes,
                    requester: mgmtRequester,
                    responsible: mgmtResponsible
                } : m
            );
        } else {
            const newMgmt: ManagementItem = {
                id: crypto.randomUUID(),
                date: mgmtDate,
                sla: parseInt(mgmtSla) || 0,
                description: mgmtDescription,
                notes: mgmtNotes,
                requester: mgmtRequester,
                responsible: mgmtResponsible
            };
            updatedManagements.push(newMgmt);
        }

        request.managements = updatedManagements;
        updatedRequests[requestIndex] = request;

        const updatedPaItem = {
            ...currentPaItem,
            requests: updatedRequests
        };

        setPaItemsMap(prev => ({ ...prev, [managementWorkId.trim()]: updatedPaItem }));
        setIsManagementModalOpen(false);

        try {
            const token = await getAuthToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/project-avoidances/${managementWorkId.trim()}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPaItem)
            });
        } catch (error) {
            console.error("Error saving Management:", error);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="relative min-h-full w-full">
            <div className="mr-80 px-8 py-8 w-auto mx-0">
                {/* Title Removed */}

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

                    {/* Filters Section */}
                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filtros</h3>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar obra..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white/50 border border-white/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-700 placeholder-gray-500"
                            />
                            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Regional Filter */}
                        <div>
                            <select
                                value={filterRegional}
                                onChange={(e) => setFilterRegional(e.target.value)}
                                className="w-full px-4 py-2 bg-white/50 border border-white/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-700 appearance-none cursor-pointer"
                                style={{ backgroundImage: 'none' }}
                            >
                                <option value="">Todas Regionais</option>
                                <option value="Rimes">Rimes</option>
                                <option value="Baixada">Baixada</option>
                                <option value="Litoral">Litoral</option>
                                <option value="Capital">Capital</option>
                                <option value="Vale">Vale</option>
                                <option value="Interior">Interior</option>
                            </select>
                        </div>
                    </div>
                </div>

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
                                                                        <div key={item.id} className="bg-white/60 backdrop-blur-md rounded-xl border border-white/50 shadow-sm flex flex-col group/request relative overflow-hidden transition-all">

                                                                            {/* Request Content Row */}
                                                                            <div className="flex items-center justify-between p-3 pr-8 w-full relative">

                                                                                {/* Action Buttons (Absolute to this row) */}
                                                                                <div className="absolute right-2 bottom-2 hidden group-hover/request:flex gap-1 z-10">
                                                                                    <button
                                                                                        onClick={() => openManagementModal(work.id, item.id)}
                                                                                        className="p-1 rounded-full bg-gray-100/90 hover:bg-gray-200 text-gray-600 transition-colors shadow-sm"
                                                                                        title="Gerenciamento"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.737c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                        </svg>
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => openRequestModal(work.id, item)}
                                                                                        className="p-1 rounded-full bg-blue-100/90 hover:bg-blue-200 text-blue-600 transition-colors shadow-sm"
                                                                                        title="Editar"
                                                                                    >
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                                                        </svg>
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteRequestClick(work.id, item.id)}
                                                                                        className="p-1 rounded-full bg-red-100/90 hover:bg-red-200 text-red-600 transition-colors shadow-sm"
                                                                                        title="Excluir"
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

                                                                            {/* Nested Management Items */}
                                                                            {item.managements && item.managements.length > 0 && (
                                                                                <div className="bg-gray-50/50 border-t border-gray-100 p-2 space-y-2">
                                                                                    {item.managements.map((mgmt) => {
                                                                                        const mgmtDateObj = new Date(mgmt.date);
                                                                                        mgmtDateObj.setDate(mgmtDateObj.getDate() + (mgmt.sla || 0));

                                                                                        const today = new Date();
                                                                                        today.setHours(0, 0, 0, 0);
                                                                                        const limitDate = new Date(mgmtDateObj);
                                                                                        limitDate.setHours(0, 0, 0, 0);

                                                                                        const isLate = limitDate < today;
                                                                                        const statusColor = isLate ? "text-red-600 bg-red-50 border-red-100" : "text-green-600 bg-green-50 border-green-100";

                                                                                        return (
                                                                                            <div key={mgmt.id} className={`relative p-2 rounded-lg border text-xs group/mgmt ${statusColor} hover:shadow-sm transition-all flex justify-between items-start`}>
                                                                                                <div className="flex-1">
                                                                                                    <div className="flex justify-between items-start mb-1">
                                                                                                        <span className="font-bold uppercase tracking-wider opacity-90">{mgmt.description}</span>
                                                                                                        <span className="font-mono font-bold text-[10px]">{limitDate.toLocaleDateString('pt-BR')}</span>
                                                                                                    </div>
                                                                                                    <div className="text-[10px] opacity-80 mb-1">
                                                                                                        <span>Resp: {mgmt.responsible}</span>
                                                                                                    </div>
                                                                                                    {mgmt.notes && (
                                                                                                        <div className="text-[10px] italic opacity-70 border-t border-black/10 pt-1 mt-1">
                                                                                                            "{mgmt.notes}"
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>

                                                                                                <div className="absolute right-2 top-2 hidden group-hover/mgmt:flex gap-1 bg-white/80 rounded-lg p-0.5 shadow-sm">
                                                                                                    <button
                                                                                                        onClick={() => openManagementModal(work.id, item.id, mgmt)}
                                                                                                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                                                                                        title="Editar"
                                                                                                    >
                                                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                                                                        </svg>
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => handleDeleteManagementClick(work.id, item.id, mgmt.id)}
                                                                                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                                                                        title="Excluir"
                                                                                                    >
                                                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                                                        </svg>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
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
                                : deleteType === 'REQUEST'
                                    ? "Tem certeza que deseja excluir esta solicitação? O valor será removido do consumo."
                                    : "Tem certeza que deseja remover este gerenciamento?"
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
                                else if (deleteType === 'MANAGEMENT') confirmDeleteManagement();
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
            < Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title={editingRequestId ? "Editar Solicitação" : "Nova Solicitação"} >
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

            {/* Management Modal */}
            <Modal isOpen={isManagementModalOpen} onClose={() => setIsManagementModalOpen(false)} title={editingManagementId ? "Editar Gerenciamento" : "Novo Gerenciamento"}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                            <input
                                type="date"
                                value={mgmtDate}
                                onChange={(e) => setMgmtDate(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">SLA (dias)</label>
                            <input
                                type="number"
                                value={mgmtSla}
                                onChange={(e) => setMgmtSla(e.target.value)}
                                min="0"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                            />
                        </div>
                    </div>

                    {/* Calculated Limit Date Display */}
                    {mgmtDate && mgmtSla && (
                        <div className="bg-gray-50 rounded-lg p-2 flex justify-between items-center text-xs">
                            <span className="text-gray-500 font-medium">Data Limite Calculada:</span>
                            {(() => {
                                const d = new Date(mgmtDate);
                                d.setDate(d.getDate() + (parseInt(mgmtSla) || 0));
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const limit = new Date(d);
                                limit.setHours(0, 0, 0, 0);
                                const isLate = limit < today;
                                return <span className={`font-bold ${isLate ? 'text-red-600' : 'text-green-600'}`}>{d.toLocaleDateString('pt-BR')}</span>;
                            })()}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
                        <input
                            type="text"
                            value={mgmtDescription}
                            onChange={(e) => setMgmtDescription(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                            placeholder="Resumo da ação"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Observações</label>
                        <textarea
                            value={mgmtNotes}
                            onChange={(e) => setMgmtNotes(e.target.value)}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                            placeholder="Detalhes adicionais..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Requisitante</label>
                            <input
                                type="text"
                                value={mgmtRequester}
                                onChange={(e) => setMgmtRequester(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Responsável</label>
                            <input
                                type="text"
                                value={mgmtResponsible}
                                onChange={(e) => setMgmtResponsible(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                        <button
                            onClick={() => setIsManagementModalOpen(false)}
                            className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveManagement}
                            disabled={!mgmtDescription}
                            className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all shadow-md ${mgmtDescription ? "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg" : "bg-gray-400 cursor-not-allowed"}`}
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );

}

