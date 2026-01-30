import { useState, useEffect, useCallback } from "react";
import Toast from "../../components/Toast";
import Modal from "../../components/Modal";
import { getAuthToken } from "../../firebase";
import LPUCard from "./LPUCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import Pagination from "../../components/Pagination";

interface Work {
    id: string;
    regional: string;
    go_live_date: string;
    cep: string;
    address: {
        street: string;
        neighborhood: string;
        city: string;
        state: string;
        number: string;
        complement: string;
    };
    work_type: string;
    cnpj: string;
}

interface Supplier {
    id: string;
    social_reason: string;
}

interface LPU {
    id: string;
    work_id: string;
    limit_date: string;
    created_at?: string;
    // Permissions
    allow_quantity_change?: boolean;
    allow_add_items?: boolean;
    allow_remove_items?: boolean;
    allow_lpu_edit?: boolean;
    // Data
    prices?: Record<string, number>;
    quantities?: Record<string, number>;
    // Phase 1
    status?: 'draft' | 'waiting' | 'submitted' | 'approved';
    quote_token?: string;
    invited_suppliers?: { id: string, name: string }[];
    quote_permissions?: {
        allow_quantity_change: boolean;
        allow_add_items: boolean;
        allow_remove_items: boolean;
        allow_lpu_edit: boolean;
    };
    // Additional fields to match LPUCard structure if needed
    selected_items?: string[];
    submission_metadata?: {
        signer_name: string;
        submission_date: string;
        supplier_name: string;
        supplier_cnpj: string;
    };
    history?: {
        revision_number: number;
        created_at: string;
        prices: Record<string, number>;
        quantities: Record<string, number>;
        submission_metadata?: {
            signer_name: string;
            submission_date: string;
            supplier_name: string;
            supplier_cnpj: string;
        };
    }[];
    revision_comment?: string;
}

export default function LPU() {
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [filterText, setFilterText] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    const [works, setWorks] = useState<Work[]>([]);
    const [lpus, setLpus] = useState<LPU[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLpuId, setEditingLpuId] = useState<string | null>(null);
    const [lpuForm, setLpuForm] = useState({ work_id: "", limit_date: "" });

    // Focus State
    const [focusedLpuId, setFocusedLpuId] = useState<string | null>(null);

    // Delete Confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [lpuToDelete, setLpuToDelete] = useState<LPU | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getAuthToken();
            if (!token) return;
            const headers = { Authorization: `Bearer ${token}` };

            const [worksRes, lpusRes, supRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/lpus`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/suppliers`, { headers })
            ]);

            if (worksRes.ok) setWorks(await worksRes.json());
            if (lpusRes.ok) setLpus(await lpusRes.json());
            if (supRes.ok) setSuppliers(await supRes.json());

        } catch (error) {
            console.error("Error fetching data:", error);
            setToast({ message: "Erro ao carregar dados", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {

        fetchData();
    }, [fetchData]);

    const openNewLpuModal = () => {
        setEditingLpuId(null);
        setLpuForm({ work_id: "", limit_date: "" });
        setIsModalOpen(true);
    };

    const openEditLpuModal = (lpu: LPU) => {
        setEditingLpuId(lpu.id);
        setLpuForm({ work_id: lpu.work_id, limit_date: lpu.limit_date });
        setIsModalOpen(true);
    };

    // Generic Update Handler passed to Card
    const handleUpdateLpu = async (lpuId: string, updates: Partial<LPU>) => {
        // Optimistic Update
        const updatedLpus = lpus.map(l => l.id === lpuId ? { ...l, ...updates } : l);
        setLpus(updatedLpus);

        const lpu = updatedLpus.find(l => l.id === lpuId);
        if (!lpu) return;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lpus/${lpuId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(lpu)
            });

            if (!res.ok) {
                setToast({ message: "Erro ao salvar alterações", type: "error" });
                // Revert logic could be added here
            }
        } catch (error) {
            console.error("Save error", error);
            setToast({ message: "Erro de conexão", type: "error" });
        }
    };

    const handleSaveLpu = async () => {
        if (!lpuForm.work_id || !lpuForm.limit_date) {
            setToast({ message: "Preencha todos os campos", type: "error" });
            return;
        }

        try {
            const token = await getAuthToken();
            const lpuId = editingLpuId || crypto.randomUUID();

            const existingLpu = lpus.find(l => l.id === editingLpuId);

            const payload: LPU = {
                id: lpuId,
                work_id: lpuForm.work_id,
                limit_date: lpuForm.limit_date,
                // Preserve existing data if editing
                prices: existingLpu?.prices || {},
                quantities: existingLpu?.quantities || {},
                allow_quantity_change: existingLpu?.allow_quantity_change,
                allow_add_items: existingLpu?.allow_add_items,
                allow_remove_items: existingLpu?.allow_remove_items,
                allow_lpu_edit: existingLpu?.allow_lpu_edit,
                // Preserve Phase 1 data
                status: existingLpu?.status,
                quote_token: existingLpu?.quote_token,
                invited_suppliers: existingLpu?.invited_suppliers,
                quote_permissions: existingLpu?.quote_permissions
            };

            const url = editingLpuId
                ? `${import.meta.env.VITE_API_BASE_URL}/lpus/${lpuId}`
                : `${import.meta.env.VITE_API_BASE_URL}/lpus`;

            const method = editingLpuId ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setToast({ message: editingLpuId ? "LPU atualizada!" : "LPU criada!", type: "success" });
                setIsModalOpen(false);
                fetchData();
            } else {
                setToast({ message: "Erro ao salvar LPU", type: "error" });
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Erro de conexão", type: "error" });
        }
    };

    const handleDeleteLpu = (lpu: LPU) => {
        setLpuToDelete(lpu);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteLpu = async () => {
        if (!lpuToDelete) return;
        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lpus/${lpuToDelete.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                setToast({ message: "LPU excluída!", type: "success" });
                setIsDeleteModalOpen(false);
                setLpuToDelete(null);
                fetchData();
            }
        } catch (error) {
            console.error(error);
            setToast({ message: "Erro ao excluir", type: "error" });
        }
    };

    const filteredLpus = lpus.filter(lpu => {
        // If focused, only show the focused card
        if (focusedLpuId && lpu.id !== focusedLpuId) return false;

        const work = works.find(w => w.id === lpu.work_id);
        const searchString = `${work?.id} ${work?.regional} ${work?.address?.city}`.toLowerCase();
        return !filterText || searchString.includes(filterText.toLowerCase());
    });

    const paginatedLpus = filteredLpus.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalPages = Math.ceil(filteredLpus.length / itemsPerPage);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterText]);

    return (
        <div className="relative min-h-screen w-full font-sans text-gray-900">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Sticky Toolbar */}
            <div className="sticky top-0 z-30 pb-4 pt-4 px-4 -mx-4 lg:-mx-8 lg:px-8 mb-6 flex flex-col lg:flex-row gap-4 justify-between items-center transition-all duration-300">
                <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto flex-1">
                    <div className="relative group flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar obra, regional..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 sm:text-sm shadow-sm hover:shadow-md"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
                    <button
                        onClick={openNewLpuModal}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Nova LPU
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full px-4 lg:px-8 pb-8 min-w-0 flex flex-col">

                {isLoading ? (
                    <LoadingSpinner message="Carregando LPUs..." />
                ) : filteredLpus.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-white border border-gray-100 shadow-sm mt-6">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Nenhuma LPU encontrada</h3>
                        <p className="text-xs text-gray-500">Utilize o botão acima para cadastrar uma nova.</p>
                    </div>
                ) : (

                    <div className="grid grid-cols-1 gap-6">
                        {paginatedLpus.map(lpu => (
                            <LPUCard
                                key={lpu.id}
                                lpu={lpu}
                                work={works.find(w => w.id === lpu.work_id)}
                                suppliers={suppliers}
                                onUpdateLpu={handleUpdateLpu}
                                onDeleteLpu={handleDeleteLpu}
                                onEditLpu={openEditLpuModal}
                                isFocused={focusedLpuId === lpu.id}
                                onToggleFocus={() => setFocusedLpuId(focusedLpuId === lpu.id ? null : lpu.id)}
                            />
                        ))}
                    </div>
                )}

                <div className="mt-8">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredLpus.length}
                        itemsPerPage={itemsPerPage}
                    />
                </div>
            </div>



            {/* LPU Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingLpuId ? "Editar LPU" : "Nova LPU"}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Obra</label>
                        <select
                            value={lpuForm.work_id}
                            onChange={(e) => setLpuForm({ ...lpuForm, work_id: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                            disabled={!!editingLpuId}
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
                        <label className="block text-xs font-medium text-gray-700">Prazo Limite</label>
                        <input
                            type="date"
                            value={lpuForm.limit_date}
                            onChange={(e) => setLpuForm({ ...lpuForm, limit_date: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveLpu}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirmar Exclusão"
            >
                <div>
                    <p className="text-sm text-gray-600 mb-4">
                        Tem certeza que deseja excluir esta LPU? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDeleteLpu}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Excluir
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
