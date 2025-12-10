import { useState, useEffect } from "react";
import Toast from "../components/Toast";
import Modal from "../components/Modal";
import { getAuthToken } from "../firebase";

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
}

import { LPU_STANDARD_ITEMS } from "../data/lpu_standard_items";

export default function LPU() {
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [filterText, setFilterText] = useState("");

    const [works, setWorks] = useState<Work[]>([]);
    const [lpus, setLpus] = useState<LPU[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLpuId, setEditingLpuId] = useState<string | null>(null);
    const [lpuForm, setLpuForm] = useState({ work_id: "", limit_date: "" });

    // Items Modal State
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [currentLpu, setCurrentLpu] = useState<LPU | null>(null);

    // Delete Confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [lpuToDelete, setLpuToDelete] = useState<LPU | null>(null);

    const openItemsModal = (lpu: LPU) => {
        setCurrentLpu(lpu);
        setIsItemsModalOpen(true);
    };

    const fetchData = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const headers = { Authorization: `Bearer ${token}` };

            const [worksRes, lpusRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/lpus`, { headers })
            ]);

            if (worksRes.ok) setWorks(await worksRes.json());
            if (lpusRes.ok) setLpus(await lpusRes.json());
        } catch (error) {
            console.error("Error fetching data:", error);
            setToast({ message: "Erro ao carregar dados", type: "error" });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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

    const handleSaveLpu = async () => {
        if (!lpuForm.work_id || !lpuForm.limit_date) {
            setToast({ message: "Preencha todos os campos", type: "error" });
            return;
        }

        try {
            const token = await getAuthToken();
            const lpuId = editingLpuId || crypto.randomUUID();

            const payload: LPU = {
                id: lpuId,
                work_id: lpuForm.work_id,
                limit_date: lpuForm.limit_date
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
            setToast({ message: "Erro ao excluir", type: "error" });
        }
    };

    const handleTogglePermission = async (lpu: LPU, field: keyof LPU) => {
        // Optimistic update
        const updatedLpus = lpus.map(l => l.id === lpu.id ? { ...l, [field]: !l[field] } : l);
        setLpus(updatedLpus);

        try {
            const token = await getAuthToken();
            const updatedLpu = { ...lpu, [field]: !lpu[field] };

            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lpus/${lpu.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(updatedLpu)
            });

            if (!res.ok) {
                // Revert on failure
                setLpus(lpus);
                setToast({ message: "Erro ao atualizar permissão", type: "error" });
            }
        } catch (error) {
            setLpus(lpus);
            setToast({ message: "Erro de conexão", type: "error" });
        }
    };

    const filteredLpus = lpus.filter(lpu => {
        const work = works.find(w => w.id === lpu.work_id);
        const searchString = `${work?.id} ${work?.regional} ${work?.address?.city}`.toLowerCase();
        return !filterText || searchString.includes(filterText.toLowerCase());
    });

    // Toggle Component
    const ToggleSwitch = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <div className="flex items-center justify-between py-2 border-b border-white/30 last:border-0 hover:bg-white/10 px-2 rounded-lg transition-colors">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <button
                type="button"
                onClick={onChange}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );

    return (
        <div className="relative min-h-full w-full font-sans text-gray-900">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Main Content Area */}
            <div className="mr-80 px-8 py-8 w-auto mx-0">
                {filteredLpus.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl mt-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-1">Nenhuma LPU encontrada</h3>
                        <p className="text-xs text-gray-500">Utilize o menu lateral para cadastrar uma nova.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredLpus.map(lpu => {
                            const work = works.find(w => w.id === lpu.work_id);
                            return (
                                <div key={lpu.id} className="relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all hover:bg-white/50 group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                        </svg>
                                    </div>

                                    <div className="relative z-10 space-y-4">
                                        {/* Header: ID, Regional, Type, Actions */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-bold text-gray-800">{work?.id || lpu.work_id}</h3>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Regional</span>
                                                    <span className="text-sm font-medium text-gray-700">{work?.regional || "-"}</span>
                                                </div>
                                                {work?.work_type && (
                                                    <div className="flex flex-col pl-3 border-l border-gray-300">
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</span>
                                                        <span className="text-sm font-medium text-gray-700">{work.work_type}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openItemsModal(lpu)}
                                                    className="p-1.5 rounded-full bg-white/50 hover:bg-green-100 text-green-600 transition-colors"
                                                    title="Itens da LPU"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => openEditLpuModal(lpu)}
                                                    className="p-1.5 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLpu(lpu)}
                                                    className="p-1.5 rounded-full bg-white/50 hover:bg-red-100 text-red-600 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Address & Info Block */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/30 rounded-xl p-4 border border-white/40">
                                            {/* Address */}
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    Endereço
                                                </div>
                                                <p className="text-sm text-gray-800 leading-tight">
                                                    {work?.address ? (
                                                        <>
                                                            {work.address.street}, {work.address.number} {work.address.complement && `- ${work.address.complement}`}
                                                            <br />
                                                            {work.address.neighborhood} - {work.address.city}/{work.address.state}
                                                            <br />
                                                            <span className="text-gray-500 text-xs">CEP: {work.cep}</span>
                                                        </>
                                                    ) : <span className="text-gray-400 italic">Endereço não cadastrado</span>}
                                                </p>
                                            </div>

                                            {/* CNPJ & Go Live */}
                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">CNPJ</span>
                                                    <span className="text-sm font-medium text-gray-800">{work?.cnpj || "-"}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-gray-200/50">
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Go Live</span>
                                                        <span className="text-sm font-medium text-blue-700">{work?.go_live_date || "-"}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Prazo LPU</span>
                                                        <span className="text-sm font-medium text-orange-700">{new Date(lpu.limit_date).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Permissions Toggles */}
                                        <div className="mt-4 pt-4 border-t border-white/40">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Permissões da LPU</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                                <ToggleSwitch
                                                    label="Permitir alterar quantitativos"
                                                    checked={lpu.allow_quantity_change || false}
                                                    onChange={() => handleTogglePermission(lpu, 'allow_quantity_change')}
                                                />
                                                <ToggleSwitch
                                                    label="Permitir adicionar itens"
                                                    checked={lpu.allow_add_items || false}
                                                    onChange={() => handleTogglePermission(lpu, 'allow_add_items')}
                                                />
                                                <ToggleSwitch
                                                    label="Permitir remover itens"
                                                    checked={lpu.allow_remove_items || false}
                                                    onChange={() => handleTogglePermission(lpu, 'allow_remove_items')}
                                                />
                                                <ToggleSwitch
                                                    label="Permitir edição de LPU"
                                                    checked={lpu.allow_lpu_edit || false}
                                                    onChange={() => handleTogglePermission(lpu, 'allow_lpu_edit')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                            onClick={openNewLpuModal}
                            className="flex flex-col items-center justify-center p-3 bg-white/60 hover:bg-white/80 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                <span className="text-blue-600 text-lg font-bold">+</span>
                            </div>
                            <span className="text-[10px] font-medium text-gray-600">Nova LPU</span>
                        </button>
                        <button
                            onClick={() => setToast({ message: "Observações - Em Breve!", type: "success" })}
                            className="flex flex-col items-center justify-center p-3 bg-white/60 hover:bg-white/80 rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                            <span className="text-[10px] font-medium text-gray-600">Observações</span>
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
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
                    </div>
                </div>
            </div>

            {/* LPU Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLpuId ? "Editar LPU" : "Nova LPU"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Selecione a Obra</label>
                        <select
                            value={lpuForm.work_id}
                            onChange={e => setLpuForm({ ...lpuForm, work_id: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!!editingLpuId} // Disable work change on edit if preferred, usually ID shouldn't change
                        >
                            <option value="">Selecione...</option>
                            {works.map(work => (
                                <option key={work.id} value={work.id}>
                                    {work.id} - {work.regional}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Limite</label>
                        <input
                            type="date"
                            value={lpuForm.limit_date}
                            onChange={e => setLpuForm({ ...lpuForm, limit_date: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={handleSaveLpu} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">{editingLpuId ? "Salvar" : "Criar"}</button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Excluir LPU">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir a LPU da obra <span className="font-bold text-gray-900">{works.find(w => w.id === lpuToDelete?.work_id)?.id}</span>?
                        <br /><span className="text-xs text-red-500">Essa ação não pode ser desfeita.</span>
                    </p>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={confirmDeleteLpu} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm">Excluir</button>
                    </div>
                </div>
            </Modal>

            {/* Items View Modal */}
            <Modal isOpen={isItemsModalOpen} onClose={() => setIsItemsModalOpen(false)} title={`Itens da LPU - ${works.find(w => w.id === currentLpu?.work_id)?.regional || currentLpu?.work_id}`}>
                <div className="space-y-4">
                    <div className="overflow-hidden border border-gray-200 rounded-xl">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {LPU_STANDARD_ITEMS.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`
                                            ${item.isGroup ? 'bg-gray-100' : ''} 
                                            ${item.isSubGroup ? 'bg-gray-50' : ''}
                                            hover:bg-blue-50 transition-colors
                                        `}
                                    >
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.isGroup ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                            {item.id}
                                        </td>
                                        <td className={`px-6 py-4 text-sm ${item.isGroup ? 'font-bold text-gray-900' : (item.isSubGroup ? 'font-semibold text-gray-700' : 'text-gray-600')}`}>
                                            {item.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {item.unit || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setIsItemsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Fechar</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
