import { useEffect, useState } from "react";
import { getAuthToken } from "../firebase";
import Modal from "../components/Modal";
import {
    type ResidentAssignment,
    type ResidentWork,
    type Resident,
    type ResidentEvaluation,
    type ResidentMetrics
} from "../types/Residentes";

export default function Residentes() {
    const [works, setWorks] = useState<ResidentWork[]>([]);
    const [residents, setResidents] = useState<Resident[]>([]);

    // Resident Form State (Create/Edit)
    const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [residentFormData, setResidentFormData] = useState({ id: "", name: "", email: "", crea: "" });
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Assignment Logic
    const [draggedResident, setDraggedResident] = useState<Resident | null>(null);
    const [targetWork, setTargetWork] = useState<ResidentWork | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
    const [unassignData, setUnassignData] = useState<{ workId: string, residentId: string, residentName: string } | null>(null);
    const [assignmentData, setAssignmentData] = useState({ contract_start: "", contract_end: "" });

    // Evaluation Logic
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
    const [evaluatingResident, setEvaluatingResident] = useState<{ workId: string, residentId: string, name: string } | null>(null);
    const [evaluationData, setEvaluationData] = useState<ResidentEvaluation>({
        technical: 0, management: 0, leadership: 0, organization: 0, commitment: 0, communication: 0
    });

    // Metrics View Logic
    const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
    const [viewingMetricsResident, setViewingMetricsResident] = useState<Resident | null>(null);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [residentToDelete, setResidentToDelete] = useState<Resident | null>(null);


    // Fetchers
    const fetchWorks = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setWorks(data);
            }
        } catch (error) {
            console.error("Error fetching works:", error);
        }
    };

    const fetchResidents = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/residents`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setResidents(data);
            }
        } catch (error) {
            console.error("Error fetching residents:", error);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchWorks();
        fetchResidents();
    }, []); // fetch functions are stable in this context or can be ignored if not wrapped

    // Resident Management Handlers
    const openNewResidentModal = () => {
        setIsEditing(false);
        setResidentFormData({ id: "", name: "", email: "", crea: "" });
        setIsResidentModalOpen(true);
    };

    const openEditResidentModal = (resident: Resident) => {
        setIsEditing(true);
        setResidentFormData({ id: resident.id, name: resident.name, email: resident.email, crea: resident.crea });
        setIsResidentModalOpen(true);
    };

    const handleSaveResident = async () => {
        if (!residentFormData.name || !residentFormData.email || !residentFormData.crea) {
            setToast({ message: "Preencha todos os campos", type: "error" });
            return;
        }

        const token = await getAuthToken();
        const residentId = isEditing ? residentFormData.id : crypto.randomUUID();
        const residentPayload: Resident = {
            id: residentId,
            name: residentFormData.name,
            email: residentFormData.email,
            crea: residentFormData.crea
        };

        try {
            const url = isEditing
                ? `${import.meta.env.VITE_API_BASE_URL}/residents/${residentId}`
                : `${import.meta.env.VITE_API_BASE_URL}/residents`;

            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(residentPayload)
            });

            if (res.ok) {
                setToast({ message: isEditing ? "Residente atualizado!" : "Residente cadastrado!", type: "success" });
                setIsResidentModalOpen(false);
                fetchResidents(); // Refresh list
            }
        } catch (error) {
            console.error("Error saving resident", error);
            setToast({ message: "Erro ao salvar", type: "error" });
        }
    };

    const handleDeleteResident = (resident: Resident) => {
        setResidentToDelete(resident);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteResident = async () => {
        if (!residentToDelete) return;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/residents/${residentToDelete.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                setToast({ message: "Residente excluído!", type: "success" });
                fetchResidents();
                setIsDeleteModalOpen(false);
                setResidentToDelete(null);
            }
        } catch (error) {
            console.error("Error deleting resident", error);
            setToast({ message: "Erro ao excluir", type: "error" });
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (resident: Resident) => {
        setDraggedResident(resident);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (work: ResidentWork) => {
        if (!draggedResident) return;
        setTargetWork(work);
        setIsAssignmentModalOpen(true);
    };

    const handleConfirmAssignment = async () => {
        if (!targetWork || !draggedResident || !assignmentData.contract_start || !assignmentData.contract_end) {
            setToast({ message: "Preencha as datas", type: "error" });
            return;
        }

        const assignment: ResidentAssignment = {
            id: draggedResident.id,
            name: draggedResident.name,
            contract_start: assignmentData.contract_start,
            contract_end: assignmentData.contract_end
        };

        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works/${targetWork.id}/assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(assignment)
            });

            if (res.ok) {
                setToast({ message: "Residente atribuído!", type: "success" });
                setIsAssignmentModalOpen(false);
                setDraggedResident(null);
                setTargetWork(null);
                setAssignmentData({ contract_start: "", contract_end: "" });
                fetchWorks(); // Refresh works to show new assignment
            }
        } catch (error) {
            console.error("Error assigning resident", error);
            setToast({ message: "Erro ao atribuir", type: "error" });
        }
    };

    const openUnassignModal = (workId: string, resident: ResidentAssignment) => {
        setUnassignData({ workId, residentId: resident.id, residentName: resident.name });
        setIsUnassignModalOpen(true);
    };

    const handleUnassignResident = async () => {
        if (!unassignData) return;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works/${unassignData.workId}/assignments/${unassignData.residentId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                setToast({ message: "Residente removido da obra!", type: "success" });
                setIsUnassignModalOpen(false);
                setUnassignData(null);
                fetchWorks(); // Refresh works
            }
        } catch (error) {
            console.error("Error unassigning resident", error);
            setToast({ message: "Erro ao remover residente", type: "error" });
        }
    };

    // Evaluation Handlers
    const openEvaluationModal = (workId: string, resident: ResidentAssignment) => {
        setEvaluatingResident({ workId, residentId: resident.id, name: resident.name });
        // Initializing with existing evaluation if present
        if (resident.evaluation) {
            setEvaluationData(resident.evaluation);
        } else {
            setEvaluationData({ technical: 0, management: 0, leadership: 0, organization: 0, commitment: 0, communication: 0 });
        }
        setIsEvaluationModalOpen(true);
    };

    const handleSaveEvaluation = async () => {
        if (!evaluatingResident) return;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works/${evaluatingResident.workId}/assignments/${evaluatingResident.residentId}/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(evaluationData)
            });

            if (res.ok) {
                setToast({ message: "Avaliação salva!", type: "success" });
                setIsEvaluationModalOpen(false);
                fetchWorks(); // Refresh works to update the local evaluation data
                fetchResidents(); // Refresh residents to update the aggregated metrics
            }
        } catch (error) {
            console.error("Error saving evaluation", error);
            setToast({ message: "Erro ao salvar avaliação", type: "error" });
        }
    };

    const openMetricsModal = (resident: Resident) => {
        setViewingMetricsResident(resident);
        setIsMetricsModalOpen(true);
    };

    const calculateDaysRemaining = (endDateStr: string) => {
        const end = new Date(endDateStr);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };


    // Toast Logic
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const renderStars = (criterion: keyof ResidentEvaluation, value: number) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        onClick={() => setEvaluationData(prev => ({ ...prev, [criterion]: star }))}
                        className={`text-2xl transition-all hover:scale-110 ${star <= value ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                        ★
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="mr-0 px-8 py-8 w-auto mx-0 min-h-screen font-sans text-gray-900">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl backdrop-blur-md border z-50 animate-fade-in-down ${toast.type === "success" ? "bg-green-500/90 text-white border-green-400" : "bg-red-500/90 text-white border-red-400"
                    }`}>
                    <div className="flex items-center gap-2">
                        {toast.type === "success" ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                        )}
                        <span className="font-semibold">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Split Layout */}
            <div className="grid grid-cols-12 gap-6">

                {/* Left Panel: Works List (2/3) */}
                <div className="col-span-8 flex flex-col gap-4">
                    {works.map(work => (
                        <div
                            key={work.id}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(work)}
                            className="relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-5 hover:bg-white/50 transition-all group hover:border-blue-300 hover:shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 shadow-sm uppercase tracking-wide">
                                        {work.id}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${work.status === 'Concluído' ? 'bg-green-50 text-green-600 border-green-100' :
                                        'bg-gray-50 text-gray-500 border-gray-100'
                                        }`}>
                                        {work.status || 'Em Andamento'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col mb-2">
                                <span className="text-xs text-gray-500 uppercase font-bold">{work.regional}</span>
                                {work.site && <span className="text-sm font-medium text-gray-800">{work.site}</span>}
                            </div>

                            {/* Assigned Residents */}
                            {work.residents && work.residents.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Célula de Obra</span>
                                    <div className="flex flex-col gap-2">
                                        {work.residents.map((r, idx) => {
                                            const daysRemaining = calculateDaysRemaining(r.contract_end);
                                            return (
                                                <div key={idx} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                            {r.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-indigo-900">{r.name}</span>
                                                            <span className="text-[10px] text-indigo-500 font-medium">Faltam {daysRemaining} dias para encerrar</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => openEvaluationModal(work.id, r)}
                                                            className="text-yellow-400 hover:text-yellow-500 transition-colors p-1"
                                                            title="Avaliar Residente"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => openUnassignModal(work.id, r)}
                                                            className="text-red-400 hover:text-red-500 transition-colors p-1"
                                                            title="Remover da Obra"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {works.length === 0 && (
                        <div className="p-8 text-center text-gray-500 bg-white/30 rounded-xl border border-dashed border-gray-300">
                            Nenhuma obra encontrada.
                        </div>
                    )}
                </div>

                {/* Right Panel: Residents (1/3) */}
                <div className="col-span-4 flex flex-col gap-4">
                    <button
                        onClick={openNewResidentModal}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Novo Residente
                    </button>

                    {/* Residents List */}
                    <div className="flex flex-col gap-3">
                        {residents.map(resident => (
                            <div
                                key={resident.id}
                                draggable
                                onDragStart={() => handleDragStart(resident)}
                                className="rounded-xl bg-white/60 p-4 border border-white/50 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:scale-[1.02] group"
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 cursor-pointer" onClick={() => openMetricsModal(resident)}>
                                            <span className="font-bold text-gray-900">{resident.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditResidentModal(resident)}
                                                className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                title="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteResident(resident)}
                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-500">{resident.email}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">CREA {resident.crea}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {residents.length === 0 && (
                            <div className="p-4 text-center text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                Nenhum residente cadastrado.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Assignment Modal */}
            <Modal isOpen={isAssignmentModalOpen} onClose={() => setIsAssignmentModalOpen(false)} title="Atribuir Residente">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Deseja mover o engenheiro <span className="font-bold text-gray-900">{draggedResident?.name}</span> para a obra <span className="font-bold text-gray-900">{targetWork?.id}</span>?
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Início do Contrato</label>
                            <input
                                type="date"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={assignmentData.contract_start}
                                onChange={e => setAssignmentData({ ...assignmentData, contract_start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Término Previsto</label>
                            <input
                                type="date"
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={assignmentData.contract_end}
                                onChange={e => setAssignmentData({ ...assignmentData, contract_end: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsAssignmentModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={handleConfirmAssignment} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">Salvar</button>
                    </div>
                </div>
            </Modal>

            {/* Evaluation Modal */}
            <Modal isOpen={isEvaluationModalOpen} onClose={() => setIsEvaluationModalOpen(false)} title={`Avaliar ${evaluatingResident?.name}`}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { key: 'technical', label: 'Competência Técnica' },
                            { key: 'management', label: 'Planejamento e Gestão' },
                            { key: 'leadership', label: 'Liderança e Relacionamento' },
                            { key: 'organization', label: 'Organização e Documentação' },
                            { key: 'commitment', label: 'Comprometimento' },
                            { key: 'communication', label: 'Comunicação e Relatórios' }
                        ].map((criterion) => (
                            <div key={criterion.key} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <span className="text-sm font-medium text-gray-700">{criterion.label}</span>
                                {renderStars(criterion.key as keyof ResidentEvaluation, evaluationData[criterion.key as keyof ResidentEvaluation])}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsEvaluationModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={handleSaveEvaluation} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">Salvar Avaliação</button>
                    </div>
                </div>
            </Modal>

            {/* Metrics Modal */}
            <Modal isOpen={isMetricsModalOpen} onClose={() => setIsMetricsModalOpen(false)} title={`Métricas: ${viewingMetricsResident?.name}`}>
                <div className="space-y-6">
                    {viewingMetricsResident?.metrics ? (
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { key: 'technical', label: 'Competência Técnica' },
                                { key: 'management', label: 'Planejamento e Gestão' },
                                { key: 'leadership', label: 'Liderança e Relacionamento' },
                                { key: 'organization', label: 'Organização e Documentação' },
                                { key: 'commitment', label: 'Comprometimento' },
                                { key: 'communication', label: 'Comunicação e Relatórios' }
                            ].map((criterion) => {
                                const key = criterion.key as keyof ResidentMetrics;
                                const value = viewingMetricsResident?.metrics?.[key] || 0;
                                return (
                                    <div key={criterion.key} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wide">
                                            <span>{criterion.label}</span>
                                            <span>{value.toFixed(1)} / 5.0</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                                style={{ width: `${(value / 5) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="text-center text-xs text-gray-400 mt-2">
                                Baseado em {viewingMetricsResident.metrics.count} avaliações
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Nenhuma avaliação registrada ainda.
                        </div>
                    )}
                </div>
            </Modal>

            {/* New Resident Modal */}
            <Modal isOpen={isResidentModalOpen} onClose={() => setIsResidentModalOpen(false)} title={isEditing ? "Editar Residente" : "Novo Residente"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: João Silva"
                            value={residentFormData.name}
                            onChange={e => setResidentFormData({ ...residentFormData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: joao@email.com"
                            value={residentFormData.email}
                            onChange={e => setResidentFormData({ ...residentFormData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CREA</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 12345/SP"
                            value={residentFormData.crea}
                            onChange={e => setResidentFormData({ ...residentFormData, crea: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsResidentModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={handleSaveResident} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">{isEditing ? "Salvar Alterações" : "Cadastrar"}</button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Excluir Residente">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir o residente <span className="font-bold text-gray-900">{residentToDelete?.name}</span>?
                        <br /><span className="text-xs text-red-500">Essa ação não pode ser desfeita.</span>
                    </p>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={confirmDeleteResident} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm">Excluir</button>
                    </div>
                </div>
            </Modal>

            {/* Unassign Confirmation Modal */}
            <Modal isOpen={isUnassignModalOpen} onClose={() => setIsUnassignModalOpen(false)} title="Remover Residente">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja remover <span className="font-bold text-gray-900">{unassignData?.residentName}</span> desta obra?
                    </p>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsUnassignModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={handleUnassignResident} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm">Remover</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
