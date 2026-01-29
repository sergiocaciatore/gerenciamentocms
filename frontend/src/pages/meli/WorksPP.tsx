import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../../firebase";
import mllogo from '../../assets/mllogo.png';
import LoadingSpinner from '../../components/LoadingSpinner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Work {
    id: string;
    regional: string;
    engineer?: string;
    coordinator?: string;
    business_case?: string;
    capex_approved?: string;
    address?: {
        city?: string;
        state?: string;
    };
    // ...
}

interface Marco {
    descricao?: string;
    previsto?: string;
    realizado?: string;
}

interface License {
    nome?: string;
    protocolo?: string;
    previsao?: string;
    emissao?: string;
    status?: 'cancelado' | 'andamento' | 'concluido';
}

interface CurvePoint {
    id: string; // unique ID for editing/key
    date: string; // YYYY-MM-DD
    planned?: number;
    realized?: number;
}

interface Management {
    work_id: string;
    capex?: {
        approved?: string;
        contracted?: string;
    };
    engineer?: string;
    coordinator?: string;
    control_tower?: string; // Person Name
    pm?: string;
    cm?: string;
    pp_destaques_executivos?: string;
    pp_pontos_atencao?: string;
    image_1?: string;
    image_2?: string;
    pp_image_1?: string;
    pp_image_2?: string;
    map_image?: string;
    imovel_contrato_assinado?: string;
    imovel_recebimento_contratual?: string;
    imovel_entrega_antecipada?: string;
    marcos?: Marco[];
    licenses?: License[];
    schedule_curve?: CurvePoint[];
    // ...
}

type CampoImovel =
    | 'imovel_contrato_assinado'
    | 'imovel_recebimento_contratual'
    | 'imovel_entrega_antecipada';

// Load Map Images
const mapImagesGlob = import.meta.glob('../assets/estados/*.png', { eager: true });
const mapImages = Object.entries(mapImagesGlob).map(([path, mod]: [string, unknown]) => ({
    name: path.split('/').pop()?.replace('.png', '') || '',
    url: (mod as { default: string }).default
}));

export default function WorksPP() {
    // --- State ---
    const [works, setWorks] = useState<Work[]>([]);
    const [hiddenWorkIds, setHiddenWorkIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('hiddenWorkIds_PP');
        return new Set(saved ? JSON.parse(saved) : []);
    });

    const [managements, setManagements] = useState<Management[]>([]);

    // UI
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false); // New state for map modal
    const [isUploading, setIsUploading] = useState(false);
    const [isReorderModalOpen, setIsReorderModalOpen] = useState(false); // Reorder Modal
    const [isCurveModalOpen, setIsCurveModalOpen] = useState(false); // Curve Modal
    const [isEnhancing, setIsEnhancing] = useState<string | null>(null);

    // Derived
    const visibleWorks = useMemo(() => works.filter(w => !hiddenWorkIds.has(w.id)), [works, hiddenWorkIds]);
    const currentWork = visibleWorks[currentIndex];

    // Maintain valid index when list shrinks
    useEffect(() => {
        if (currentIndex >= visibleWorks.length && visibleWorks.length > 0) {
            setCurrentIndex(visibleWorks.length - 1);
        }
    }, [visibleWorks.length, currentIndex]);

    // Persist hidden state
    useEffect(() => {
        localStorage.setItem('hiddenWorkIds_PP', JSON.stringify([...hiddenWorkIds]));
    }, [hiddenWorkIds]);

    const currentMgmt = managements.find(m => m.work_id === currentWork?.id);
    const marcosAtuais = currentMgmt?.marcos || [];

    const licencasAtuais = currentMgmt?.licenses || [];
    // Sort logic for curve points: primarily by date

    const curvePoints = useMemo(() => {
        return [...(currentMgmt?.schedule_curve || [])].sort((a, b) => (a.date > b.date ? 1 : -1));
    }, [currentMgmt?.schedule_curve]);

    // --- Data Fetching ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const token = await user.getIdToken();
                    const headers = { Authorization: `Bearer ${token}` };
                    const baseUrl = import.meta.env.VITE_API_BASE_URL;

                    const [resWorks, resMgmt] = await Promise.all([
                        fetch(`${baseUrl}/works`, { headers }),
                        fetch(`${baseUrl}/managements`, { headers })
                    ]);

                    if (resWorks.ok) {
                        const w: Work[] = await resWorks.json();
                        const savedOrder = JSON.parse(localStorage.getItem('worksOrder_PP') || '[]');
                        if (savedOrder && savedOrder.length > 0) {
                            w.sort((a, b) => {
                                const idxA = savedOrder.indexOf(a.id);
                                const idxB = savedOrder.indexOf(b.id);
                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                if (idxA !== -1) return -1;
                                if (idxB !== -1) return 1;
                                return 0;
                            });
                        }
                        setWorks(w);
                    }
                    if (resMgmt.ok) setManagements(await resMgmt.json());

                } catch (error) {
                    console.error("Error loading data", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Handle case where user is not logged in
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // --- Actions ---
    const handleNext = () => {
        if (currentIndex < visibleWorks.length - 1) setCurrentIndex(currentIndex + 1);
    };

    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    };

    const toggleVisibility = (id: string) => {
        setHiddenWorkIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleUpdateManagement = async (field: keyof Management, value: Management[keyof Management]) => {
        if (!currentWork) return;

        setManagements(prev => {
            const exists = prev.find(m => m.work_id === currentWork.id);
            if (exists) {
                return prev.map(m => m.work_id === currentWork.id ? { ...m, [field]: value } : m);
            } else {
                return [...prev, { work_id: currentWork.id, [field]: value }];
            }
        });
    };

    const handleAIEnhance = async (field: 'pp_destaques_executivos' | 'pp_pontos_atencao') => {
        if (!currentWork) return;

        setIsEnhancing(field);
        const originalText = currentMgmt?.[field] || "";

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/enhance`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: originalText,
                    context: `Obra: ${currentWork.id}. Regional: ${currentWork.regional}.`
                })
            });

            if (res.ok) {
                const data = await res.json();
                handleUpdateManagement(field, data.formatted_text);

                // Construct object if missing for save
                const newMgmt = currentMgmt
                    ? { ...currentMgmt, [field]: data.formatted_text }
                    : { work_id: currentWork.id, [field]: data.formatted_text };

                saveManagement(newMgmt);
            }
        } catch (e) {
            console.error("AI Enhance failed", e);
        } finally {
            setIsEnhancing(null);
        }
    };

    const saveManagement = async (mgmt: Management) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(mgmt)
            });
        } catch (error) {
            console.error("Error saving management", error);
        }
    };

    const salvarCampoImovel = async (campo: CampoImovel, valor: string) => {
        if (!currentWork) return;

        const novoMgmt: Management = currentMgmt
            ? { ...currentMgmt, [campo]: valor }
            : { work_id: currentWork.id, [campo]: valor };

        await saveManagement(novoMgmt);
    };

    const salvarMarcos = async (novosMarcos: Marco[]) => {
        if (!currentWork) return;

        const novoMgmt: Management = currentMgmt
            ? { ...currentMgmt, marcos: novosMarcos }
            : { work_id: currentWork.id, marcos: novosMarcos };

        await saveManagement(novoMgmt);
    };

    const montarMarcosAtualizados = (indice: number, campo: keyof Marco, valor: string) => {
        return marcosAtuais.map((marco, idx) =>
            idx === indice ? { ...marco, [campo]: valor } : marco
        );
    };

    const atualizarCampoMarco = (indice: number, campo: keyof Marco, valor: string) => {
        const novosMarcos = montarMarcosAtualizados(indice, campo, valor);
        handleUpdateManagement('marcos', novosMarcos);
        return novosMarcos;
    };

    const adicionarMarco = async () => {
        if (!currentWork) return;

        const novosMarcos = [...marcosAtuais, { descricao: '', previsto: '', realizado: '' }];
        handleUpdateManagement('marcos', novosMarcos);
        await salvarMarcos(novosMarcos);
    };

    const removerMarco = async (indice: number) => {
        if (!currentWork) return;

        const novosMarcos = marcosAtuais.filter((_, idx) => idx !== indice);
        handleUpdateManagement('marcos', novosMarcos);
        await salvarMarcos(novosMarcos);
    };

    // --- Licenses Logic ---
    const salvarLicencas = async (novasLicencas: License[]) => {
        if (!currentWork) return;
        const novoMgmt: Management = currentMgmt
            ? { ...currentMgmt, licenses: novasLicencas }
            : { work_id: currentWork.id, licenses: novasLicencas };
        await saveManagement(novoMgmt);
    };

    const montarLicencasAtualizadas = (indice: number, campo: keyof License, valor: string) => {
        return licencasAtuais.map((licenca, idx) =>
            idx === indice ? { ...licenca, [campo]: valor } : licenca
        );
    };

    const atualizarCampoLicenca = (indice: number, campo: keyof License, valor: string) => {
        const novasLicencas = montarLicencasAtualizadas(indice, campo, valor);
        handleUpdateManagement('licenses', novasLicencas);
        return novasLicencas;
    };

    const adicionarLicenca = async () => {
        if (!currentWork) return;
        const novasLicencas = [...licencasAtuais, { nome: '', protocolo: '', previsao: '', emissao: '', status: 'andamento' as const }];
        handleUpdateManagement('licenses', novasLicencas);
        await salvarLicencas(novasLicencas);
    };

    const removerLicenca = async (indice: number) => {
        if (!currentWork) return;
        const novasLicencas = licencasAtuais.filter((_, idx) => idx !== indice);
        handleUpdateManagement('licenses', novasLicencas);
        await salvarLicencas(novasLicencas);
    };

    // --- Schedule Curve Logic ---
    const saveCurveData = async (newPoints: CurvePoint[]) => {
        if (!currentWork) return;
        const novoMgmt: Management = currentMgmt
            ? { ...currentMgmt, schedule_curve: newPoints }
            : { work_id: currentWork.id, schedule_curve: newPoints };
        await saveManagement(novoMgmt);
    };

    const handleAddCurvePoint = async () => {
        if (!currentWork) return;
        const newPoint: CurvePoint = {
            id: Date.now().toString(),
            date: '',
            planned: 0,
            realized: 0
        };
        const newPoints = [...curvePoints, newPoint];
        handleUpdateManagement('schedule_curve', newPoints);
        await saveCurveData(newPoints);
    };

    const handleUpdateCurvePoint = (id: string, field: keyof CurvePoint, value: string | number) => {
        const newPoints = curvePoints.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        );
        handleUpdateManagement('schedule_curve', newPoints);
        return newPoints;
    };

    const handleRemoveCurvePoint = async (id: string) => {
        const newPoints = curvePoints.filter(p => p.id !== id);
        handleUpdateManagement('schedule_curve', newPoints);
        await saveCurveData(newPoints);
    };

    const handleSelectMap = (name: string) => {
        if (!currentWork) return;

        const newMgmt: Management = currentMgmt
            ? { ...currentMgmt, map_image: name }
            : { work_id: currentWork.id, map_image: name };

        // Update Local State
        setManagements(prev => {
            const exists = prev.find(m => m.work_id === currentWork.id);
            if (exists) {
                return prev.map(m => m.work_id === currentWork.id ? newMgmt : m);
            } else {
                return [...prev, newMgmt];
            }
        });

        saveManagement(newMgmt);
        setIsMapModalOpen(false);
    };

    // Helper to resolve map URL from stored value (name or legacy path)
    const getMapUrl = (val: string | undefined) => {
        if (!val) return null;

        // 1. Try finding by Name (New behavior: "GO", "SP")
        const byName = mapImages.find(m => m.name === val);
        if (byName) return byName.url;

        // 2. Try parsing Legacy Dev Path (/src/assets/estados/GO.png)
        const match = val.match(/estados\/([A-Z]{2})\.png/);
        if (match) {
            const stateCode = match[1];
            const found = mapImages.find(m => m.name === stateCode);
            if (found) return found.url;
        }

        // 3. Return original (e.g. Firebase Storage URL or valid production path)
        return val;
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'image_1' | 'image_2' | 'pp_image_1' | 'pp_image_2') => {
        const file = event.target.files?.[0];
        if (!file || !currentWork) return;
        // Logic: if !currentMgmt, we proceed to create

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `managements/${currentWork.id}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            handleUpdateManagement(field, downloadUrl);

            // Construct object if missing for save
            const newMgmt = currentMgmt
                ? { ...currentMgmt, [field]: downloadUrl }
                : { work_id: currentWork.id, [field]: downloadUrl };

            await saveManagement(newMgmt as Management);
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Erro ao enviar imagem. Verifique se você tem permissão.");
        } finally {
            setIsUploading(false);
        }
    };

    // --- DnD Handler ---
    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        if (sourceIndex === destinationIndex) return;

        const newWorks = Array.from(works);
        const [movedWork] = newWorks.splice(sourceIndex, 1);
        newWorks.splice(destinationIndex, 0, movedWork);

        setWorks(newWorks);
        localStorage.setItem('worksOrder_PP', JSON.stringify(newWorks.map(w => w.id)));

        // Keep current work selected correctly
        const currentId = works[currentIndex].id;
        const newIndex = newWorks.findIndex(w => w.id === currentId);
        if (newIndex !== -1) setCurrentIndex(newIndex);
    };
    const moveWork = (index: number, direction: 'up' | 'down') => {
        const newWorks = [...works];
        if (direction === 'up') {
            if (index === 0) return;
            [newWorks[index - 1], newWorks[index]] = [newWorks[index], newWorks[index - 1]];
        } else {
            if (index === works.length - 1) return;
            [newWorks[index + 1], newWorks[index]] = [newWorks[index], newWorks[index + 1]];
        }
        setWorks(newWorks);
        localStorage.setItem('worksOrder_PP', JSON.stringify(newWorks.map(w => w.id)));

        // Adjust current index if we moved the current item
        if (index === currentIndex) {
            setCurrentIndex(direction === 'up' ? index - 1 : index + 1);
        } else if (direction === 'up' && index - 1 === currentIndex) {
            setCurrentIndex(currentIndex + 1);
        } else if (direction === 'down' && index + 1 === currentIndex) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    // --- Render ---
    if (isLoading) return <LoadingSpinner message="Carregando apresentação..." fullScreen />;

    return (
        <div className="relative flex flex-col h-full gap-4">

            {/* Modal for Reordering Works */}
            {/* Modal for Reordering Works */}
            {isReorderModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsReorderModalOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-xl font-bold text-gray-800">Organizar Obras</h3>
                            <button onClick={() => setIsReorderModalOpen(false)} className="text-gray-400 hover:text-gray-600" title="Fechar modal" aria-label="Fechar modal">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="works-list">
                                    {(provided) => (
                                        <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className="space-y-2"
                                        >
                                            {works.map((work, idx) => (
                                                <Draggable key={work.id} draggableId={work.id} index={idx}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`flex items-center justify-between p-3 rounded-xl transition-all border group ${snapshot.isDragging ? 'bg-white shadow-xl border-blue-400 z-50 scale-105' : 'bg-gray-50 hover:bg-gray-100 border-transparent hover:border-gray-200'} ${hiddenWorkIds.has(work.id) ? 'opacity-50 grayscale' : ''}`}
                                                            style={provided.draggableProps.style}
                                                        >
                                                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded transition-colors"
                                                                    title="Arraste para mover"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                                                </div>
                                                                <div className="flex flex-col truncate">
                                                                    <span className="font-bold text-gray-800 text-sm truncate">{work.id}</span>
                                                                    <span className="text-xs text-gray-500 truncate">{work.regional}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button onClick={() => moveWork(idx, 'up')} disabled={idx === 0} className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent text-gray-600 hover:text-blue-600 transition-colors" title="Mover para Cima">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                                </button>
                                                                <button onClick={() => moveWork(idx, 'down')} disabled={idx === works.length - 1} className="p-1.5 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent text-gray-600 hover:text-blue-600 transition-colors" title="Mover para Baixo">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                                </button>
                                                                <button onClick={() => toggleVisibility(work.id)} className={`p-1.5 hover:bg-white rounded shadow-sm text-gray-600 transition-colors ${hiddenWorkIds.has(work.id) ? 'text-gray-400 hover:text-gray-600' : 'hover:text-blue-600'}`} title={hiddenWorkIds.has(work.id) ? "Mostrar na apresentação" : "Ocultar da apresentação"}>
                                                                    {hiddenWorkIds.has(work.id) ? (
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                                                    ) : (
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                        <div className="mt-4 pt-4 border-t text-[10px] text-gray-400 text-center uppercase tracking-widest">
                            Alterações salvas automaticamente neste navegador
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal for Curve Editing */}
            {isCurveModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setIsCurveModalOpen(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <span className="text-2xl">📈</span>
                                    Curva de Avanço Físico
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Gerencie os pontos do gráfico previsto vs realizado.</p>
                            </div>
                            <button
                                onClick={() => setIsCurveModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">

                            {/* Table Header */}
                            <div className="grid grid-cols-[140px_1fr_1fr_40px] gap-4 mb-2 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <div>Data de Medição</div>
                                <div>% Previsto Acumulado</div>
                                <div>% Realizado Acumulado</div>
                                <div></div>
                            </div>

                            <div className="space-y-2">
                                {curvePoints.map((point) => (
                                    <div key={point.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 grid grid-cols-[140px_1fr_1fr_40px] gap-4 items-center group hover:shadow-md transition-all">
                                        <input
                                            type="date"
                                            value={point.date}
                                            onChange={(e) => {
                                                const novos = handleUpdateCurvePoint(point.id, 'date', e.target.value);
                                                saveCurveData(novos);
                                            }}
                                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-gray-700"
                                        />

                                        <div className="relative group/input">
                                            <input
                                                type="number"
                                                value={point.planned ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                    const novos = handleUpdateCurvePoint(point.id, 'planned', val as number);
                                                    saveCurveData(novos);
                                                }}
                                                placeholder="0"
                                                className="w-full bg-blue-50/10 border border-blue-100/50 group-hover/input:border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-semibold text-blue-700 placeholder-blue-300"
                                            />
                                            <div className="absolute inset-y-0 right-8 w-px bg-gray-200/50 my-2"></div>
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-300">%</span>
                                        </div>

                                        <div className="relative group/input">
                                            <input
                                                type="number"
                                                value={point.realized ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                    const novos = handleUpdateCurvePoint(point.id, 'realized', val as number);
                                                    saveCurveData(novos);
                                                }}
                                                placeholder="-"
                                                className="w-full bg-green-50/10 border border-green-100/50 group-hover/input:border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-semibold text-green-700 placeholder-green-300"
                                            />
                                            <div className="absolute inset-y-0 right-8 w-px bg-gray-200/50 my-2"></div>
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-300">%</span>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveCurvePoint(point.id)}
                                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                            title="Remover ponto"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}

                                {curvePoints.length === 0 && (
                                    <div className="text-center py-16 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl bg-white/50">
                                        <span className="text-4xl mb-3 opacity-50">📊</span>
                                        <p className="font-medium text-gray-400">Nenhum ponto de medição</p>
                                        <p className="text-xs mt-1 max-w-xs mx-auto">Adicione datas e percentuais para visualizar a Curva S de avanço físico da obra.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t bg-gray-50/80 backdrop-blur-sm flex justify-center sticky bottom-0 z-10">
                            <button
                                onClick={handleAddCurvePoint}
                                className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 transform active:scale-95 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                Adicionar Novo Ponto
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal for Map Selection */}
            {isMapModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsMapModalOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Selecione o Mapa</h3>
                            <button onClick={() => setIsMapModalOpen(false)} className="text-gray-400 hover:text-gray-600" title="Fechar modal" aria-label="Fechar modal">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 p-2">
                            {mapImages.map((img, idx) => (
                                <button key={idx} onClick={() => handleSelectMap(img.name)} className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all bg-gray-50 flex flex-col items-center justify-center p-2 hover:shadow-lg">
                                    <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
                                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold tracking-wide">{img.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* Top Bar Navigation (Standard) */}
            <div className="bg-white/70 backdrop-blur-xl shadow-sm p-3 items-center justify-between flex shrink-0 z-50 relative rounded-xl border border-white/50">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 hover:opacity-100 transition-opacity">
                    <img src={mllogo} alt="Logo" className="h-8 grayscale hover:grayscale-0 transition-all" />
                </div>

                <div className="flex items-center gap-4 z-10 w-[500px] justify-between bg-white/50 p-1.5 rounded-full border border-white/30">
                    <button onClick={handlePrev} disabled={currentIndex === 0} className="p-2 bg-white/80 rounded-full shadow-sm hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 transition-all shrink-0" title="Obra anterior" aria-label="Obra anterior">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <div className="flex-1 text-center overflow-hidden px-2">
                        <h2 className="text-sm font-bold text-gray-900 leading-tight truncate">{currentWork?.id}</h2>
                        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 truncate">
                            <span>{currentWork?.regional}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0"></span>
                            <span className="truncate">{currentWork?.address?.city}</span>
                        </div>
                    </div>

                    <button onClick={handleNext} disabled={currentIndex === works.length - 1} className="p-2 bg-white/80 rounded-full shadow-sm hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 transition-all shrink-0" title="Próxima obra" aria-label="Próxima obra">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="flex items-center gap-3 z-10">
                    <button
                        onClick={() => setIsReorderModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/50 hover:bg-white/80 text-gray-600 rounded-lg text-xs font-medium transition-colors border border-white/30"
                        title="Organizar Obras"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span>Organizar</span>
                    </button>
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-bold border border-white/20 z-10 shadow-lg">
                        {currentWork ? currentIndex + 1 : 0} / {visibleWorks.length}
                    </div>
                </div>
            </div>

            {/* Main Content Grid - Standard Layout */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 pb-2">

                {/* LEFT: Visuals (3 cols) */}
                <div className="col-span-3 flex flex-col gap-6">
                    {/* Map Card */}
                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 h-36 relative overflow-hidden group">
                        <span className="text-[10px] text-gray-400 absolute top-2 left-3 bg-white/80 px-2 py-0.5 rounded backdrop-blur-sm z-10 pointer-events-none uppercase font-bold tracking-wider">Localização</span>
                        <div
                            className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-white/40 transition-colors"
                            onClick={() => setIsMapModalOpen(true)}
                            title="Alterar mapa"
                        >
                            {currentMgmt?.map_image ? (
                                <img src={getMapUrl(currentMgmt.map_image) || ''} className="w-full h-full object-contain p-1" alt="Mapa da Obra" title="Mapa da Obra" />
                            ) : (
                                <div className="text-center">
                                    <span className="text-4xl block mb-2 opacity-50">🗺️</span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">Selecionar</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Photos */}
                    <div className="flex-1 grid grid-rows-2 gap-4">
                        {/* Photo 1 */}
                        <label className="bg-white/60 backdrop-blur-xl rounded-2xl relative overflow-hidden group border border-white/50 cursor-pointer hover:border-blue-300 transition-colors shadow-sm h-full w-full block">
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'pp_image_1')}
                                disabled={isUploading}
                            />
                            <span className="text-[10px] text-gray-500 absolute top-2 left-3 bg-white/90 px-2 py-1 rounded-md shadow-sm z-10 font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">Foto 1</span>
                            {currentMgmt?.pp_image_1 ? (
                                <>
                                    <img src={currentMgmt.pp_image_1} className="absolute inset-0 w-full h-full object-cover" alt="Foto 1 da Obra" title="Foto 1 da Obra" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full border border-white/30 backdrop-blur-sm">Alterar Foto</span>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-300">
                                    <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="text-[9px] font-bold uppercase tracking-wider">Adicionar</span>
                                </div>
                            )}
                            {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20"><span className="animate-spin text-xl">⏳</span></div>}
                        </label>

                        {/* Photo 2 */}
                        <label className="bg-white/60 backdrop-blur-xl rounded-2xl relative overflow-hidden group border border-white/50 cursor-pointer hover:border-blue-300 transition-colors shadow-sm h-full w-full block">
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'pp_image_2')}
                                disabled={isUploading}
                            />
                            <span className="text-[10px] text-gray-500 absolute top-2 left-3 bg-white/90 px-2 py-1 rounded-md shadow-sm z-10 font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">Foto 2</span>
                            {currentMgmt?.pp_image_2 ? (
                                <>
                                    <img src={currentMgmt.pp_image_2} className="absolute inset-0 w-full h-full object-cover" alt="Foto 2 da Obra" title="Foto 2 da Obra" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full border border-white/30 backdrop-blur-sm">Alterar Foto</span>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-300">
                                    <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="text-[9px] font-bold uppercase tracking-wider">Adicionar</span>
                                </div>
                            )}
                            {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20"><span className="animate-spin text-xl">⏳</span></div>}
                        </label>
                    </div>
                </div>

                {/* CENTRO: Cronograma (6 colunas) */}
                <div className="col-span-6 flex flex-col gap-6">
                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-white/50 relative flex flex-col flex-1 min-h-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cronograma Realizado</h3>
                                <p className="text-[10px] text-gray-500">Imóvel e marcos principais</p>
                            </div>
                        </div>

                        <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                            <div className="bg-white/70 border border-white/60 rounded-xl p-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Imóvel</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Contrato assinado</label>
                                        <input
                                            type="date"
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={currentMgmt?.imovel_contrato_assinado || ''}
                                            onChange={(e) => handleUpdateManagement('imovel_contrato_assinado', e.target.value)}
                                            onBlur={(e) => { void salvarCampoImovel('imovel_contrato_assinado', e.target.value); }}
                                            aria-label="Contrato assinado"
                                            title="Contrato assinado"
                                            placeholder="dd/mm/aaaa"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Recebimento contratual</label>
                                        <input
                                            type="date"
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={currentMgmt?.imovel_recebimento_contratual || ''}
                                            onChange={(e) => handleUpdateManagement('imovel_recebimento_contratual', e.target.value)}
                                            onBlur={(e) => { void salvarCampoImovel('imovel_recebimento_contratual', e.target.value); }}
                                            aria-label="Recebimento contratual do imóvel"
                                            title="Recebimento contratual do imóvel"
                                            placeholder="dd/mm/aaaa"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Entrega antecipada</label>
                                        <input
                                            type="date"
                                            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={currentMgmt?.imovel_entrega_antecipada || ''}
                                            onChange={(e) => handleUpdateManagement('imovel_entrega_antecipada', e.target.value)}
                                            onBlur={(e) => { void salvarCampoImovel('imovel_entrega_antecipada', e.target.value); }}
                                            aria-label="Entrega antecipada"
                                            title="Entrega antecipada"
                                            placeholder="dd/mm/aaaa"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/70 border border-white/60 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Marcos</h4>
                                    <button
                                        type="button"
                                        onClick={() => { void adicionarMarco(); }}
                                        disabled={!currentWork}
                                        className="text-[10px] text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors font-medium disabled:opacity-50"
                                        title="Adicionar marco"
                                        aria-label="Adicionar marco"
                                    >
                                        Adicionar marco
                                    </button>
                                </div>
                                {marcosAtuais.length === 0 ? (
                                    <div className="text-xs text-gray-400">Nenhum marco adicionado.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {marcosAtuais.map((marco, idx) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_32px] gap-2 items-end">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Descrição</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={marco.descricao || ''}
                                                        onChange={(e) => atualizarCampoMarco(idx, 'descricao', e.target.value)}
                                                        onBlur={(e) => { void salvarMarcos(atualizarCampoMarco(idx, 'descricao', e.target.value)); }}
                                                        placeholder="Ex: Vistoria inicial"
                                                        aria-label="Descrição do marco"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Previsto</label>
                                                    <input
                                                        type="date"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={marco.previsto || ''}
                                                        onChange={(e) => atualizarCampoMarco(idx, 'previsto', e.target.value)}
                                                        onBlur={(e) => { void salvarMarcos(atualizarCampoMarco(idx, 'previsto', e.target.value)); }}
                                                        aria-label="Data prevista do marco"
                                                        title="Previsto"
                                                        placeholder="dd/mm/aaaa"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Realizado</label>
                                                    <input
                                                        type="date"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={marco.realizado || ''}
                                                        onChange={(e) => atualizarCampoMarco(idx, 'realizado', e.target.value)}
                                                        onBlur={(e) => { void salvarMarcos(atualizarCampoMarco(idx, 'realizado', e.target.value)); }}
                                                        aria-label="Data realizada do marco"
                                                        title="Realizado"
                                                        placeholder="dd/mm/aaaa"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { void removerMarco(idx); }}
                                                    className="h-8 w-8 flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                    title="Remover marco"
                                                    aria-label="Remover marco"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/70 border border-white/60 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Licenças</h4>
                                    <button
                                        type="button"
                                        onClick={() => { void adicionarLicenca(); }}
                                        disabled={!currentWork}
                                        className="text-[10px] text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors font-medium disabled:opacity-50"
                                        title="Adicionar licença"
                                        aria-label="Adicionar licença"
                                    >
                                        Adicionar licença
                                    </button>
                                </div>
                                {licencasAtuais.length === 0 ? (
                                    <div className="text-xs text-gray-400">Nenhuma licença adicionado.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {licencasAtuais.map((licenca, idx) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_100px_60px_32px] gap-2 items-end">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Nome</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={licenca.nome || ''}
                                                        onChange={(e) => atualizarCampoLicenca(idx, 'nome', e.target.value)}
                                                        onBlur={(e) => { void salvarLicencas(atualizarCampoLicenca(idx, 'nome', e.target.value)); }}
                                                        placeholder="Nome da licença"
                                                        aria-label="Nome da licença"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Protocolo</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={licenca.protocolo || ''}
                                                        onChange={(e) => atualizarCampoLicenca(idx, 'protocolo', e.target.value)}
                                                        onBlur={(e) => { void salvarLicencas(atualizarCampoLicenca(idx, 'protocolo', e.target.value)); }}
                                                        placeholder="Nº Protocolo"
                                                        aria-label="Número do protocolo"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Previsão</label>
                                                    <input
                                                        type="date"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={licenca.previsao || ''}
                                                        onChange={(e) => atualizarCampoLicenca(idx, 'previsao', e.target.value)}
                                                        onBlur={(e) => { void salvarLicencas(atualizarCampoLicenca(idx, 'previsao', e.target.value)); }}
                                                        aria-label="Previsão"
                                                        title="Previsão"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Emissão</label>
                                                    <input
                                                        type="date"
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={licenca.emissao || ''}
                                                        onChange={(e) => atualizarCampoLicenca(idx, 'emissao', e.target.value)}
                                                        onBlur={(e) => { void salvarLicencas(atualizarCampoLicenca(idx, 'emissao', e.target.value)); }}
                                                        aria-label="Emissão"
                                                        title="Emissão"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase">Status</label>
                                                    <select
                                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={licenca.status || 'andamento'}
                                                        onChange={(e) => {
                                                            const val = e.target.value as 'cancelado' | 'andamento' | 'concluido';
                                                            void salvarLicencas(atualizarCampoLicenca(idx, 'status', val));
                                                        }}
                                                        aria-label="Status da licença"
                                                    >
                                                        <option value="cancelado">🔴</option>
                                                        <option value="andamento">🟡</option>
                                                        <option value="concluido">🟢</option>
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { void removerLicenca(idx); }}
                                                    className="h-8 w-8 flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                    title="Remover licença"
                                                    aria-label="Remover licença"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Schedule Curve Chart */}
                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 h-56 relative overflow-hidden flex flex-col p-3">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">Curva de Avanço Físico</span>
                            <button
                                onClick={() => setIsCurveModalOpen(true)}
                                className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                title="Editar curva"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 text-xs text-gray-800" style={{ minWidth: 0, minHeight: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={curvePoints} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                                        tickFormatter={(val) => {
                                            if (!val) return '';
                                            const [, m, d] = val.split('-');
                                            return `${d}/${m}`;
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[0, 100]}
                                        unit="%"
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '11px', padding: '8px' }}
                                        itemStyle={{ padding: 0 }}
                                        labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="planned"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={false}
                                        name="Previsto"
                                        connectNulls
                                        animationDuration={1000}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="realized"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }}
                                        activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                                        name="Realizado"
                                        connectNulls
                                        animationDuration={1000}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* DIREITA: Financeiro e Notas (3 colunas) */}
                <div className="col-span-3 flex flex-col gap-6 overflow-hidden pr-1 pb-1">

                    {/* Merged Highlights & Attention Card */}
                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 flex-1 flex flex-col min-h-0 overflow-hidden">

                        {/* Section 1: Highlights */}
                        <div className="flex-1 flex flex-col border-b border-white/30 p-4 min-h-0">
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Destaques Executivos
                                </h3>
                                <button
                                    onClick={() => handleAIEnhance('pp_destaques_executivos')}
                                    disabled={isEnhancing === 'pp_destaques_executivos'}
                                    className="text-[10px] text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:opacity-50 font-medium"
                                    title="Melhorar texto com IA"
                                >
                                    {isEnhancing === 'pp_destaques_executivos' ? 'Gerando...' : 'Melhorar IA'}
                                </button>
                            </div>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                    const val = e.currentTarget.innerHTML;
                                    if (val !== currentMgmt?.pp_destaques_executivos) {
                                        handleUpdateManagement('pp_destaques_executivos', val);
                                        if (currentMgmt) saveManagement({ ...currentMgmt, pp_destaques_executivos: val });
                                    }
                                }}
                                className="w-full flex-1 overflow-y-auto custom-scrollbar text-gray-700 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-100 rounded p-1 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                                data-placeholder="Principais avanços da semana..."
                                dangerouslySetInnerHTML={{ __html: currentMgmt?.pp_destaques_executivos || '' }}
                            ></div>
                        </div >

                        {/* Section 2: Attention Points */}
                        <div className="flex-1 flex flex-col p-4 min-h-0 bg-red-50/10">
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Pontos de Atenção
                                </h3>
                                <button
                                    onClick={() => handleAIEnhance('pp_pontos_atencao')}
                                    disabled={isEnhancing === 'pp_pontos_atencao'}
                                    className="text-[10px] text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50 font-medium"
                                    title="Melhorar texto com IA"
                                >
                                    {isEnhancing === 'pp_pontos_atencao' ? 'Gerando...' : 'Melhorar IA'}
                                </button>
                            </div>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                    const val = e.currentTarget.innerHTML;
                                    if (val !== currentMgmt?.pp_pontos_atencao) {
                                        handleUpdateManagement('pp_pontos_atencao', val);
                                        if (currentMgmt) saveManagement({ ...currentMgmt, pp_pontos_atencao: val });
                                    }
                                }}
                                className="w-full flex-1 overflow-y-auto custom-scrollbar text-gray-700 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-100 rounded p-1 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                                data-placeholder="Riscos, impedimentos ou atrasos..."
                                dangerouslySetInnerHTML={{ __html: currentMgmt?.pp_pontos_atencao || '' }}
                            ></div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
