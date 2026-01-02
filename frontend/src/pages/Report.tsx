import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../firebase";
import mllogo from '../assets/mllogo.png';
import { type RegistrationTeam } from "../types/Registration";
import type { PlanningStage, PlanningItem } from "../types/Planning";

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
    presentation_highlights?: string;
    attention_points?: string;
    image_1?: string;
    image_2?: string;
    map_image?: string;
    // ...
}

// Local interfaces removed in favor of imported types

interface OC {
    work_id: string;
    value: number;
    description: string;
    // ...
}

// Load Map Images
const mapImagesGlob = import.meta.glob('../assets/estados/*.png', { eager: true });
const mapImages = Object.entries(mapImagesGlob).map(([path, mod]: [string, unknown]) => ({
    name: path.split('/').pop()?.replace('.png', '') || '',
    url: (mod as { default: string }).default
}));

// Memoized SubTask Item Component to prevent re-renders
const SubTaskItem = React.memo(({ task, index, onUpdate }: { task: PlanningStage, index: number, onUpdate: (index: number, field: 'start_real' | 'end_real', value: string) => void }) => {
    return (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-sm text-gray-800">{task.name}</h4>
                {task.sla && <span className="text-[10px] text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">SLA: {task.sla}d</span>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início Real</label>
                    <input
                        type="date"
                        defaultValue={task.start_real || ""}
                        onChange={e => onUpdate(index, 'start_real', e.target.value)}
                        className="w-full rounded-lg border-gray-200 text-xs focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim Real</label>
                    <input
                        type="date"
                        defaultValue={task.end_real || ""}
                        onChange={e => onUpdate(index, 'end_real', e.target.value)}
                        className="w-full rounded-lg border-gray-200 text-xs focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison: Only re-render if the task ID or Name or Index changes.
    // We ignore onUpdate changes because we know the ref update logic is stable enough for this use case
    // and we don't want re-renders breaking the input focus/state.
    return prevProps.index === nextProps.index &&
        prevProps.task.id === nextProps.task.id &&
        prevProps.task.name === nextProps.task.name;
});

export default function Report() {
    // --- State ---
    const [works, setWorks] = useState<Work[]>([]);
    const [hiddenWorkIds, setHiddenWorkIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('hiddenWorkIds');
        return new Set(saved ? JSON.parse(saved) : []);
    });

    const [managements, setManagements] = useState<Management[]>([]);
    const [plannings, setPlannings] = useState<PlanningItem[]>([]);
    const [ocs, setOcs] = useState<OC[]>([]);
    const [teamMembers, setTeamMembers] = useState<RegistrationTeam[]>([]);

    // UI
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false); // New state for map modal
    const [isUploading, setIsUploading] = useState(false);
    const [isReorderModalOpen, setIsReorderModalOpen] = useState(false); // Reorder Modal
    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false); // Timeline Modal
    const [isSubTaskModalOpen, setIsSubTaskModalOpen] = useState(false); // Sub-Task Edit Modal
    const [selectedPhaseName, setSelectedPhaseName] = useState("");
    const [subTaskForm, setSubTaskForm] = useState<PlanningStage[]>([]);
    const subTaskFormRef = useRef<PlanningStage[]>([]);

    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false); // Team Edit Modal

    // Filters
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<{
        regional: string[];
        engineer: string[];
        coordinator: string[];
        pm: string[];
        cm: string[];
        controlTower: string[];
    }>({
        regional: [],
        engineer: [],
        coordinator: [],
        pm: [],
        cm: [],
        controlTower: []
    });

    // PDF Generation
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [selectedWorksForPdf, setSelectedWorksForPdf] = useState<Set<string>>(new Set());
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState(0); // 0 to 100

    // Team Edit Form
    const [teamForm, setTeamForm] = useState({
        engineer: "",
        coordinator: "",
        controlTower: "",
        pm: "",
        cm: ""
    });

    const [tempSchedule, setTempSchedule] = useState<PlanningStage[]>([]);
    const [isEnhancing, setIsEnhancing] = useState<string | null>(null);
    const [isFlipped, setIsFlipped] = useState(false);

    // Derived
    const filteredWorks = useMemo(() => {
        return works.filter(w => {
            // 1. Regional Filter
            if (activeFilters.regional.length > 0 && !activeFilters.regional.includes(w.regional)) return false;

            // 2. Team Filters
            // We need to join with managements to check team members
            const mgmt = managements.find(m => m.work_id === w.id);
            if (!mgmt) {
                // If no management record, exclude if any team filter is active (except maybe engineer which might be on work?)
                // Actually work has engineer/coordinator sometimes on itself (see interface), but let's check management first as it's the source of truth for current team
                // The interface says Work has engineer/coordinator, but Team Modal uses Managements?
                // Let's check where Team Modal saves. It saves to 'teamForm' but doesn't seem to persist fully in the code I saw?
                // Wait, handleUpdateManagement updates 'managements'. So we check 'managements'.
                // If any team filter is set and no mgmt record, we can't match it.
                const hasTeamFilter = Object.entries(activeFilters).some(([key, val]) => key !== 'regional' && val.length > 0);
                if (hasTeamFilter) return false;
                return true;
            }

            if (activeFilters.engineer.length > 0 && !activeFilters.engineer.includes(mgmt.engineer || "")) return false;
            if (activeFilters.coordinator.length > 0 && !activeFilters.coordinator.includes(mgmt.coordinator || "")) return false;
            if (activeFilters.pm.length > 0 && !activeFilters.pm.includes(mgmt.pm || "")) return false;
            if (activeFilters.cm.length > 0 && !activeFilters.cm.includes(mgmt.cm || "")) return false;
            if (activeFilters.controlTower.length > 0 && !activeFilters.controlTower.includes(mgmt.control_tower || "")) return false;

            return true;
        });
    }, [works, managements, activeFilters]);

    const visibleWorks = useMemo(() => filteredWorks.filter(w => !hiddenWorkIds.has(w.id)), [filteredWorks, hiddenWorkIds]);
    const currentWork = visibleWorks[currentIndex];

    // Maintain valid index when list shrinks
    useEffect(() => {
        if (currentIndex >= visibleWorks.length && visibleWorks.length > 0) {
            setCurrentIndex(visibleWorks.length - 1);
        }
    }, [visibleWorks.length, currentIndex]);

    // Persist hidden state
    useEffect(() => {
        localStorage.setItem('hiddenWorkIds', JSON.stringify([...hiddenWorkIds]));
    }, [hiddenWorkIds]);

    const currentMgmt = managements.find(m => m.work_id === currentWork?.id);
    const currentPlanning = plannings.find(p => p.work_id === currentWork?.id);
    const currentOcs = ocs.filter(o => o.work_id === currentWork?.id);

    // --- Data Fetching ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const token = await user.getIdToken();
                    const headers = { Authorization: `Bearer ${token} ` };
                    const baseUrl = import.meta.env.VITE_API_BASE_URL;

                    const [worksRes, mgmtRes, planRes, ocsRes, teamRes] = await Promise.all([
                        fetch(`${baseUrl}/works`, { headers }),
                        fetch(`${baseUrl}/managements`, { headers }),
                        fetch(`${baseUrl}/plannings`, { headers }),
                        fetch(`${baseUrl}/ocs`, { headers }),
                        fetch(`${baseUrl}/team`, { headers })
                    ]);

                    const worksData = worksRes.ok ? await worksRes.json() : [];
                    const mgmtData = mgmtRes.ok ? await mgmtRes.json() : [];
                    const planData = planRes.ok ? await planRes.json() : [];
                    const ocsData = ocsRes.ok ? await ocsRes.json() : [];
                    const teamData: RegistrationTeam[] = teamRes.ok ? await teamRes.json() : [];

                    // Apply saved order from localStorage first
                    const sortedWorks = worksData as Work[];
                    const savedOrder = JSON.parse(localStorage.getItem('worksOrder') || '[]');
                    if (savedOrder && savedOrder.length > 0) {
                        sortedWorks.sort((a, b) => {
                            const idxA = savedOrder.indexOf(a.id);
                            const idxB = savedOrder.indexOf(b.id);
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1; // a is in savedOrder, b is not
                            if (idxB !== -1) return 1;  // b is in savedOrder, a is not
                            return 0; // neither are in savedOrder, maintain original relative order
                        });
                    } else {
                        // If no saved order, apply default sorting: Project Avoidance first (numeric IDs descending), then others
                        sortedWorks.sort((a, b) => {
                            const idA = parseInt(a.id);
                            const idB = parseInt(b.id);
                            if (!isNaN(idA) && !isNaN(idB)) return idB - idA; // Numeric IDs descending
                            return a.id.localeCompare(b.id); // Alphabetical for others
                        });
                    }

                    setWorks(sortedWorks);
                    setManagements(mgmtData);
                    setPlannings(planData);
                    setOcs(ocsData);
                    setTeamMembers(teamData);

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

    const handleUpdateManagement = async (field: keyof Management, value: string) => {
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

    const handleAIEnhance = async (field: 'presentation_highlights' | 'attention_points') => {
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

    const handleTeamEditClick = () => {
        if (!currentWork) return;

        // Prefer management data, fallback to work data (which seems to happen in the UI logic)
        // But the UI logic for display was: currentMgmt?.engineer || currentWork?.engineer
        // The display logic casts currentWork to Management in some places, suggesting the type might be loose or properties exist on Work too.
        // We will stick to the display logic priority.

        setTeamForm({
            engineer: currentMgmt?.engineer || currentWork.engineer || "",
            coordinator: currentMgmt?.coordinator || currentWork.coordinator || "",
            controlTower: currentMgmt?.control_tower || (currentWork as unknown as Management)?.control_tower || "",
            pm: currentMgmt?.pm || (currentWork as unknown as Management)?.pm || "",
            cm: currentMgmt?.cm || (currentWork as unknown as Management)?.cm || ""
        });
        setIsTeamModalOpen(true);
    };

    const handleSaveTeam = async () => {
        if (!currentWork) return;

        const newMgmtData: Management = {
            ...(currentMgmt || { work_id: currentWork.id }),
            work_id: currentWork.id, // Ensure work_id is set
            engineer: teamForm.engineer,
            coordinator: teamForm.coordinator,
            control_tower: teamForm.controlTower,
            pm: teamForm.pm,
            cm: teamForm.cm
        };

        // Optimistic Update
        setManagements(prev => {
            const index = prev.findIndex(m => m.work_id === currentWork.id);
            if (index >= 0) {
                const updated = [...prev];
                updated[index] = { ...updated[index], ...newMgmtData };
                return updated;
            } else {
                return [...prev, newMgmtData];
            }
        });

        setIsTeamModalOpen(false);
        await saveManagement(newMgmtData);
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

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'image_1' | 'image_2') => {
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

            await saveManagement(newMgmt);
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Erro ao enviar imagem. Verifique se você tem permissão.");
        } finally {
            setIsUploading(false);
        }
    };

    // --- PDF Generation Logic ---
    const generatePdf = async () => {
        if (selectedWorksForPdf.size === 0) return;

        setIsGeneratingPdf(true);
        setPdfProgress(0);
        const originalIndex = currentIndex;

        // Filter visible works that are selected
        const worksToPrint = visibleWorks.filter(w => selectedWorksForPdf.has(w.id));

        if (worksToPrint.length === 0) {
            alert("Nenhuma obra selecionada está visível no filtro atual.");
            setIsGeneratingPdf(false);
            return;
        }

        try {
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape, mm, A4
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < worksToPrint.length; i++) {
                const work = worksToPrint[i];
                // Find index in visibleWorks to switch view
                const idx = visibleWorks.findIndex(w => w.id === work.id);
                if (idx !== -1) {
                    setCurrentIndex(idx);
                    // Wait for render
                    await new Promise(resolve => setTimeout(resolve, 800));

                    const element = document.getElementById('report-content');
                    if (element) {
                        // Capture
                        const canvas = await html2canvas(element, {
                            scale: 2,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#f3f4f6' // Match bg-gray-100
                        });
                        const imgData = canvas.toDataURL('image/png');

                        // Calculate dimensions to fit "contain" style in landscape
                        const imgProps = pdf.getImageProperties(imgData);
                        const ratio = imgProps.width / imgProps.height;


                        let printWidth = pdfWidth;
                        let printHeight = pdfWidth / ratio;

                        if (printHeight > pdfHeight) {
                            printHeight = pdfHeight;
                            printWidth = pdfHeight * ratio;
                        }

                        // Center image
                        const x = (pdfWidth - printWidth) / 2;
                        const y = (pdfHeight - printHeight) / 2;

                        if (i > 0) pdf.addPage();
                        pdf.addImage(imgData, 'PNG', x, y, printWidth, printHeight);

                        // Optional: Add footer or title if needed, but image capture covers it
                    }
                }
                setPdfProgress(Math.round(((i + 1) / worksToPrint.length) * 100));
            }

            const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '_');
            pdf.save(`report_${dateStr}.pdf`);

        } catch (error) {
            console.error("Error generating PDF", error);
            alert("Ocorreu um erro ao gerar o relatório.");
        } finally {
            setCurrentIndex(originalIndex);
            setIsGeneratingPdf(false);
            setIsPdfModalOpen(false);
            setPdfProgress(0);
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
        localStorage.setItem('worksOrder', JSON.stringify(newWorks.map(w => w.id)));

        // Keep current work selected correctly
        const currentId = works[currentIndex].id;
        const newIndex = newWorks.findIndex(w => w.id === currentId);
        if (newIndex !== -1) setCurrentIndex(newIndex);
    };
    const handleSaveTimeline = async () => {
        if (!currentPlanning || !tempSchedule.length) return;

        const updatedPlanning = { ...currentPlanning };
        updatedPlanning.data = { ...(updatedPlanning.data || {}), schedule: tempSchedule };

        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPlanning)
            });

            const newPlannings = plannings.map(p =>
                p.work_id === currentPlanning.work_id ? updatedPlanning : p
            );
            setPlannings(newPlannings);
            setIsTimelineModalOpen(false);
        } catch (error) {
            console.error("Error saving timeline", error);
            alert("Erro ao salvar cronograma.");
        }
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
        localStorage.setItem('worksOrder', JSON.stringify(newWorks.map(w => w.id)));

        // Adjust current index if we moved the current item
        if (index === currentIndex) {
            setCurrentIndex(direction === 'up' ? index - 1 : index + 1);
        } else if (direction === 'up' && index - 1 === currentIndex) {
            setCurrentIndex(currentIndex + 1);
        } else if (direction === 'down' && index + 1 === currentIndex) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    // Configuration for Macro Phases and their Sub-tasks
    const PHASE_CONFIG: Record<string, string[]> = {
        'Contrato Assinado': ['Contrato Assinado'],
        'Layout Aprovado': ['Layout Aprovado'],
        'LPU Projetos': [
            'Projetos - Solicitação LPU',
            'Projetos - Recebimento LPU',
            'Projetos - Validação de LPU',
            'Projetos - Envio para aprovação LPU',
            'Projetos - Aprovação de custos',
            'Projetos - Emissão de Ordem de Compra',
            'Projetos - Elaboração',
            'Projetos - Validação técnica',
            'Projetos - Projeto validado'
        ],
        'LPU Obras': [
            'Obras - Solicitação LPU',
            'Obras - Validação de LPU',
            'Obras - Envio para aprovação LPU',
            'Obras - Aprovação de custos',
            'Obras - Emissão de Ordem de Compra'
        ],
        'Gerenciamento': [
            'Gerenciamento - Documentação',
            'Gerenciamento - Integração',
            'Gerenciamento - Assinatura documentos',
            'Gerenciamento - Kickoff Construtora',
            'Gerenciamento - Comunicar início de obras',
            'Gerenciamento - Acompanhamento de obras',
            'Gerenciamento - Comunicar Término'
        ],
        'CloseOut': [
            'CloseOut - CheckList',
            'CloseOut - Vistoria',
            'CloseOut - GoLive'
        ],
        'GoLive': ['GoLive']
    };

    const phases = Object.keys(PHASE_CONFIG);

    // --- Timeline Logic ---
    const getPhaseData = (phaseKey: string) => {
        if (!currentPlanning || !currentPlanning.data || !currentPlanning.data.schedule) return { start: null, end: null, status: 'gray', slaReal: null, progress: 0 };

        const allTasks: PlanningStage[] = currentPlanning.data.schedule;
        const subTaskNames = PHASE_CONFIG[phaseKey] || [];

        // Match tasks by name (case insensitive, loose match to handle variations)
        const relevantTasks = subTaskNames.map(name =>
            allTasks.find(t => t.name.toLowerCase().includes(name.toLowerCase()))
        );

        const firstTaskObj = relevantTasks[0];
        const lastTaskObj = relevantTasks[relevantTasks.length - 1];

        // Macro Start is Start of First Task
        // Macro End is End of Last Task
        const start = firstTaskObj?.start_real || null;
        const end = lastTaskObj?.end_real || null;

        // Progress Calculation
        const completedCount = relevantTasks.filter(t => t && t.end_real).length;
        const totalCount = subTaskNames.length;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        // Status Logic
        let status = 'gray'; // Não Iniciado
        if (start) {
            if (end) {
                status = 'green'; // Concluído
            } else {
                status = 'yellow'; // Em Andamento
            }
        }

        // SLA Real Calculation
        let slaReal: number | null = null;
        if (start && end) {
            const [y1, m1, d1] = start.split('-').map(Number);
            const [y2, m2, d2] = end.split('-').map(Number);
            const dStart = new Date(y1, m1 - 1, d1);
            const dEnd = new Date(y2, m2 - 1, d2);
            const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
            slaReal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (slaReal === 0 && start === end) slaReal = 1;
        }

        return { start, end, status, slaReal, progress };
    }
    const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(val));

    // Fix Date Timezone Issue: parse YYYY-MM-DD as local date
    const dateFmt = (d: string | null | undefined) => {
        if (!d) return '-';
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('pt-BR');
    };

    // Improved Parser
    const parseCurrency = (val: string | undefined) => {
        if (!val) return 0;
        // Remove "R$", spaces, dots (thousands), leave comma and minus
        const clean = val.replace(/[R$\s.]/g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    // --- Sub-Task Editing Logic ---
    const handlePhaseClick = (phaseKey: string) => {
        if (!currentPlanning || !currentPlanning.data || !currentPlanning.data.schedule) return;

        const subTaskNames = PHASE_CONFIG[phaseKey] || [];
        const allTasks = currentPlanning.data.schedule;

        // Filter tasks that match the phase
        const matchingTasks = subTaskNames.map(name => {
            return allTasks.find(t => t.name.toLowerCase().includes(name.toLowerCase()));
        }).filter((t): t is PlanningStage => !!t);

        if (matchingTasks.length > 0) {
            setSelectedPhaseName(phaseKey);
            const tasksData = JSON.parse(JSON.stringify(matchingTasks));
            setSubTaskForm(tasksData);
            subTaskFormRef.current = tasksData; // Initialize Ref
            setIsSubTaskModalOpen(true);
        }
    };

    const handleSaveSubTasks = useCallback(async () => {
        if (!currentPlanning) return;

        const updatedSchedule = [...(currentPlanning.data.schedule || [])];

        // Update the tasks in the full schedule with values from the form REf
        subTaskFormRef.current.forEach(formTask => {
            const idx = updatedSchedule.findIndex(t => (t.id && formTask.id && t.id === formTask.id) || t.name === formTask.name);
            if (idx !== -1) {
                updatedSchedule[idx] = { ...updatedSchedule[idx], ...formTask };
            }
        });

        const updatedPlanning = {
            ...currentPlanning,
            data: {
                ...currentPlanning.data,
                schedule: updatedSchedule
            }
        };

        // Optimistic Update
        setPlannings(prev => prev.map(p =>
            p.work_id === currentPlanning.work_id ? updatedPlanning : p
        ));

        setIsSubTaskModalOpen(false);

        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedPlanning)
            });
        } catch (error) {
            console.error("Error saving subtasks", error);
            // Revert changes if needed or show error
        }
    }, [currentPlanning]);

    // Stable Handler for Ref Updates
    const handleSubTaskRefUpdate = useCallback((index: number, field: 'start_real' | 'end_real', value: string) => {
        if (subTaskFormRef.current[index]) {
            subTaskFormRef.current[index][field] = value;
        }
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isSubTaskModalOpen) return;
            if (e.key === 'Escape') {
                setIsSubTaskModalOpen(false);
            }
            if (e.key === 'Enter') {
                handleSaveSubTasks();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSubTaskModalOpen, handleSaveSubTasks]); // Dependencies for closure stability

    // --- Render ---
    if (isLoading) return <div className="p-8 text-center text-gray-500">Carregando relatório...</div>;

    return (
        <div className="relative flex flex-col h-full gap-4">

            {/* Modal for Reordering Works */}
            {/* Modal for Reordering Works */}
            {isReorderModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#00000080] backdrop-blur-sm" onClick={() => setIsReorderModalOpen(false)}>
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

            {/* Modal for Map Selection */}
            {isMapModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#00000080] backdrop-blur-sm" onClick={() => setIsMapModalOpen(false)}>
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
                                    <img src={img.url} alt={img.name} className="w-full h-full object-contain p-1" title="Mapa da Obra" />
                                    <span className="absolute bottom-0 inset-x-0 bg-[#00000099] text-white text-[10px] text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold tracking-wide">{img.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}


            {/* Modal for Timeline Editing */}
            {isTimelineModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#00000080] backdrop-blur-sm" onClick={() => setIsTimelineModalOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Editar Datas Realizadas</h3>
                                <p className="text-xs text-gray-500">Atualize as datas de conclusão (Realizado) das etapas.</p>
                            </div>
                            <button onClick={() => setIsTimelineModalOpen(false)} className="text-gray-400 hover:text-gray-600" title="Fechar modal" aria-label="Fechar modal">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {tempSchedule.length === 0 && <p className="text-center text-gray-400 py-8">Nenhuma etapa encontrada.</p>}
                            {tempSchedule.map((task, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
                                    <div className="flex-1 pr-4">
                                        <div className="font-semibold text-sm text-gray-800">{task.name}</div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                            ID: {task.id}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 w-40">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Data Realizada</label>
                                        <input
                                            type="date"
                                            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={task.end_real || ''}
                                            onChange={(e) => {
                                                const newDate = e.target.value;
                                                const newSchedule = [...tempSchedule];
                                                newSchedule[idx] = { ...task, end_real: newDate };
                                                setTempSchedule(newSchedule);
                                            }}
                                            aria-label="Data Realizada"
                                            title="Data Realizada"
                                            placeholder="dd/mm/aaaa"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setIsTimelineModalOpen(false)}
                                className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveTimeline}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition-transform active:scale-95"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}


            {/* Top Bar Navigation (Standard) */}
            <div id="report-header" className="bg-[#ffffffb3] backdrop-blur-xl shadow-sm p-3 items-center justify-between flex shrink-0 z-50 relative rounded-xl border border-[#ffffff80]">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 hover:opacity-100 transition-opacity">
                    <img src={mllogo} alt="Logo" className="h-8 grayscale hover:grayscale-0 transition-all" />
                </div>

                <div className="flex items-center gap-4 z-10 w-[500px] justify-between bg-[#ffffff80] p-1.5 rounded-full border border-[#ffffff4d]">
                    <button onClick={handlePrev} disabled={currentIndex === 0} className="p-2 bg-[#ffffffcc] rounded-full shadow-sm hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 transition-all shrink-0" title="Obra anterior" aria-label="Obra anterior">
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

                    <button onClick={handleNext} disabled={currentIndex === works.length - 1} className="p-2 bg-[#ffffffcc] rounded-full shadow-sm hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 transition-all shrink-0" title="Próxima obra" aria-label="Próxima obra">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="flex items-center gap-3 z-10">
                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 bg-[#ffffff80] hover:bg-[#ffffffcc] rounded-lg text-xs font-medium transition-colors border border-[#ffffff4d] ${Object.values(activeFilters).some(v => v.length > 0) ? 'ring-2 ring-blue-500 border-blue-500 text-blue-700 bg-blue-50' : 'text-gray-600'}`}
                        title="Filtrar Obras"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        <span>Filtrar</span>
                        {Object.values(activeFilters).reduce((acc, curr) => acc + curr.length, 0) > 0 && (
                            <span className="bg-blue-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1">
                                {Object.values(activeFilters).reduce((acc, curr) => acc + curr.length, 0)}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setIsPdfModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#ffffff80] hover:bg-[#ffffffcc] text-gray-600 rounded-lg text-xs font-medium transition-colors border border-[#ffffff4d]"
                        title="Gerar Relatório PDF"
                    >
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span>PDF</span>
                    </button>
                    <button
                        onClick={() => setIsReorderModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#ffffff80] hover:bg-[#ffffffcc] text-gray-600 rounded-lg text-xs font-medium transition-colors border border-[#ffffff4d]"
                        title="Organizar Obras"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span>Organizar</span>
                    </button>
                    <div className="bg-[#00000099] backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-bold border border-[#ffffff33] z-10 shadow-lg">
                        {currentWork ? currentIndex + 1 : 0} / {visibleWorks.length}
                    </div>
                </div>
            </div>

            {/* Main Content Grid - Standard Layout */}
            <div id="report-content" className="flex-1 grid grid-cols-12 gap-6 min-h-0 pb-2">

                {/* LEFT: Visuals (3 cols) */}
                <div className="col-span-3 flex flex-col gap-6">
                    {/* Map Card */}
                    <div className="bg-[#ffffff99] backdrop-blur-xl rounded-2xl shadow-sm border border-[#ffffff80] h-36 relative overflow-hidden group">
                        <span className="text-[10px] text-gray-400 absolute top-2 left-3 bg-[#ffffffcc] px-2 py-0.5 rounded backdrop-blur-sm z-10 pointer-events-none uppercase font-bold tracking-wider">Localização</span>
                        <div
                            className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-[#ffffff66] transition-colors"
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
                        <label className="bg-[#ffffff99] backdrop-blur-xl rounded-2xl relative overflow-hidden group border border-[#ffffff80] cursor-pointer hover:border-blue-300 transition-colors shadow-sm h-full w-full block">
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'image_1')}
                                disabled={isUploading}
                            />
                            <span className="text-[10px] text-gray-500 absolute top-2 left-3 bg-[#ffffffe6] px-2 py-1 rounded-md shadow-sm z-10 font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">Foto 1</span>
                            {currentMgmt?.image_1 ? (
                                <>
                                    <img src={currentMgmt.image_1} className="absolute inset-0 w-full h-full object-cover" alt="Foto 1 da Obra" title="Foto 1 da Obra" />
                                    <div className="absolute inset-0 bg-[#00000080] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold uppercase tracking-widest bg-[#00000080] px-3 py-1 rounded-full border border-[#ffffff4d] backdrop-blur-sm">Alterar Foto</span>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-300">
                                    <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="text-[9px] font-bold uppercase tracking-wider">Adicionar</span>
                                </div>
                            )}
                            {isUploading && <div className="absolute inset-0 bg-[#ffffffcc] flex items-center justify-center z-20"><span className="animate-spin text-xl">⏳</span></div>}
                        </label>

                        {/* Photo 2 */}
                        <label className="bg-[#ffffff99] backdrop-blur-xl rounded-2xl relative overflow-hidden group border border-[#ffffff80] cursor-pointer hover:border-blue-300 transition-colors shadow-sm h-full w-full block">
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'image_2')}
                                disabled={isUploading}
                            />
                            <span className="text-[10px] text-gray-500 absolute top-2 left-3 bg-[#ffffffe6] px-2 py-1 rounded-md shadow-sm z-10 font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">Foto 2</span>
                            {currentMgmt?.image_2 ? (
                                <>
                                    <img src={currentMgmt.image_2} className="absolute inset-0 w-full h-full object-cover" alt="Foto 2 da Obra" title="Foto 2 da Obra" />
                                    <div className="absolute inset-0 bg-[#00000080] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold uppercase tracking-widest bg-[#00000080] px-3 py-1 rounded-full border border-[#ffffff4d] backdrop-blur-sm">Alterar Foto</span>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-300">
                                    <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="text-[9px] font-bold uppercase tracking-wider">Adicionar</span>
                                </div>
                            )}
                            {isUploading && <div className="absolute inset-0 bg-[#ffffffcc] flex items-center justify-center z-20"><span className="animate-spin text-xl">⏳</span></div>}
                        </label>
                    </div>
                </div>

                {/* CENTER: Team & Timeline (5 cols) */}
                <div className="col-span-5 flex flex-col gap-6">

                    {/* Team Section (Top) */}
                    <div
                        className="bg-[#ffffff99] backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-[#ffffff80] flex-none cursor-pointer hover:bg-[#ffffffcc] transition-colors group relative"
                        onClick={handleTeamEditClick}
                        title="Clique para editar a equipe"
                    >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-bold">Editar</span>
                        </div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Equipe do Projeto</h3>
                        <div className="grid grid-cols-5 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">Engenheiro</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                                        {(currentMgmt?.engineer || currentWork?.engineer || "E").charAt(0)}
                                    </div>
                                    <p className="font-medium text-xs text-gray-800 truncate" title={currentMgmt?.engineer || currentWork?.engineer}>
                                        {currentMgmt?.engineer || currentWork?.engineer || "-"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">Coordenador</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-[10px] font-bold">
                                        {(currentMgmt?.coordinator || currentWork?.coordinator || "C").charAt(0)}
                                    </div>
                                    <p className="font-medium text-xs text-gray-800 truncate" title={currentMgmt?.coordinator || currentWork?.coordinator}>
                                        {currentMgmt?.coordinator || currentWork?.coordinator || "-"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">C.Tower</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-bold">
                                        {((currentMgmt?.control_tower || (currentWork as unknown as Management)?.control_tower || "CT") as string).charAt(0)}
                                    </div>
                                    <p className="font-medium text-xs text-gray-800 truncate" title={currentMgmt?.control_tower || (currentWork as unknown as Management)?.control_tower}>
                                        {currentMgmt?.control_tower || (currentWork as unknown as Management)?.control_tower || "N/A"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">PM</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-[10px] font-bold">
                                        {((currentMgmt?.pm || (currentWork as unknown as Management)?.pm || "P") as string).charAt(0)}
                                    </div>
                                    <p className="font-medium text-xs text-gray-800 truncate" title={currentMgmt?.pm || (currentWork as unknown as Management)?.pm}>
                                        {currentMgmt?.pm || (currentWork as unknown as Management)?.pm || "N/A"}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase block font-bold mb-1">CM</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-[10px] font-bold">
                                        {((currentMgmt?.cm || (currentWork as unknown as Management)?.cm || "C") as string).charAt(0)}
                                    </div>
                                    <p className="font-medium text-xs text-gray-800 truncate" title={currentMgmt?.cm || (currentWork as unknown as Management)?.cm}>
                                        {currentMgmt?.cm || (currentWork as unknown as Management)?.cm || "N/A"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline (Bottom - Reduced Height via flex-1 shared) */}
                    <div className="bg-[#ffffff99] backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-[#ffffff80] relative flex flex-col overflow-y-auto flex-1 group/timeline">
                        <div className="absolute top-4 left-6 right-6 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cronograma Realizado</h3>
                            <button
                                onClick={() => {
                                    if (currentPlanning?.data?.schedule) {
                                        setTempSchedule(JSON.parse(JSON.stringify(currentPlanning.data.schedule)));
                                        setIsTimelineModalOpen(true);
                                    }
                                }}
                                disabled={!currentPlanning?.data?.schedule}
                                className={`text-gray-300 hover:text-blue-500 transition-colors p-1 ${!currentPlanning?.data?.schedule ? 'opacity-30 cursor-not-allowed' : 'opacity-0 group-hover/timeline:opacity-100'}`}
                                title={!currentPlanning?.data?.schedule ? "Nenhum planejamento disponível" : "Editar Datas Realizadas"}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                        </div>

                        <div className="mt-6 space-y-2 relative flex-1 pr-1">
                            {/* Vertical Line */}
                            <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-[#e5e7eb80]"></div>

                            {phases.map((phase, idx) => {
                                const { start, end, status, slaReal, progress } = getPhaseData(phase);
                                const isLast = idx === phases.length - 1;

                                return (
                                    <div
                                        key={idx}
                                        className="relative flex gap-3 group/item cursor-pointer hover:bg-[#f9fafb80] rounded-lg p-1 transition-colors"
                                        onClick={() => handlePhaseClick(phase)}
                                    >
                                        {/* Line & Dot */}
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full border-2 z-10 box-border ${status === 'green' ? 'bg-green-500 border-green-500' : status === 'yellow' ? 'bg-yellow-400 border-yellow-400' : 'bg-gray-100 border-gray-200'}`}></div>
                                            {!isLast && <div className="w-0.5 bg-[#e5e7eb80] flex-1 my-1"></div>}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pb-4 min-h-[52px] border-b border-[#f3f4f680] last:border-0 last:pb-0">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 mr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-xs font-bold text-gray-800">{phase}</h4>
                                                        <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${status === 'green' ? 'bg-green-100 text-green-700' : status === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>
                                                            {status === 'green' ? 'Concluído' : status === 'yellow' ? 'Em Andamento' : 'Não Iniciado'}
                                                        </span>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="w-full max-w-[150px] h-2 bg-[#f3f4f680] rounded-full overflow-hidden relative">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${status === 'green' ? 'bg-green-500' : status === 'yellow' ? 'bg-yellow-400 striped-bar' : 'bg-gray-200'}`}
                                                            style={{ width: `${status === 'green' ? 100 : progress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* Dates - Always Visible */}
                                                <div className="text-right shrink-0">
                                                    <div className="flex gap-4 text-[10px]">
                                                        <div>
                                                            <span className="text-[8px] text-gray-400 uppercase block">Início</span>
                                                            <span className="font-mono text-gray-600 font-medium">{dateFmt(start)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[8px] text-gray-400 uppercase block">Fim</span>
                                                            <span className="font-mono text-gray-600 font-medium">{dateFmt(end)}</span>
                                                        </div>
                                                    </div>
                                                    {/* SLA Display */}
                                                    {slaReal !== null && (
                                                        <div className="mt-0.5">
                                                            <span className="text-[8px] text-gray-400 uppercase mr-1">SLA Real:</span>
                                                            <span className="font-mono text-[10px] font-bold text-blue-600">{slaReal} dias</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Financials & Notes (4 cols) */}
                <div className="col-span-4 flex flex-col gap-6 overflow-hidden pr-1 pb-1">

                    {/* Financials Flip Card */}
                    <div className="relative h-[220px] w-full group/flip" style={{ perspective: '1000px' }}>
                        <div
                            className="relative w-full h-full transition-all duration-700"
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                            }}
                        >
                            {/* FRONT FACE */}
                            <div
                                className="absolute inset-0 bg-[#ffffff99] backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-[#ffffff80] flex flex-col z-20 overflow-hidden"
                                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}
                            >
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-[#e5e7eb80] pb-2 flex justify-between items-center shrink-0">
                                    Controle Financeiro
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
                                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors cursor-pointer"
                                    >
                                        Detalhes &rarr;
                                    </button>
                                </h3>

                                <div className="flex-1 space-y-2 flex flex-col justify-center min-w-0">
                                    <div className="flex justify-between items-center px-3 py-2 bg-[#ffffff66] rounded-xl border border-[#ffffff66] shadow-sm">
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Business Case</span>
                                        <span className="font-bold text-gray-800 text-sm truncate ml-2">
                                            {currency(parseCurrency(currentWork?.business_case || currentWork?.capex_approved))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center px-3 py-2 bg-[#ffffff66] rounded-xl border border-[#ffffff66] shadow-sm">
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Comprometido</span>
                                        <span className="font-bold text-gray-800 text-sm truncate ml-2">{currency(currentOcs.reduce((acc, o) => acc + (o.value || 0), 0))}</span>
                                    </div>

                                    {/* Bar Calculation */}
                                    {(() => {
                                        const total = parseCurrency(currentWork?.business_case || currentWork?.capex_approved) || 0;
                                        const spent = currentOcs.reduce((acc, o) => acc + (o.value || 0), 0);

                                        let progress = 0;
                                        if (total === 0) {
                                            progress = spent > 0 ? 100 : 0;
                                        } else {
                                            progress = (spent / total) * 100;
                                        }
                                        const cappedProgress = Math.min(progress, 100);

                                        let barColor = 'bg-green-500';
                                        if (progress >= 75 && progress < 90) barColor = 'bg-yellow-500';
                                        if (progress >= 90) barColor = 'bg-red-500';

                                        return (
                                            <div className="relative pt-1 w-full max-w-full">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-500 font-medium whitespace-nowrap">Consumo do Budget</span>
                                                    <span className={`font-bold ml-2 ${progress >= 90 ? 'text-red-500' : progress >= 75 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                        {progress.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-[#e5e7eb80] rounded-full h-2.5 overflow-hidden border border-[#ffffff80]">
                                                    <div
                                                        className={`h-2.5 rounded-full ${barColor} transition-all duration-1000 relative overflow-hidden`}
                                                        style={{ width: `${cappedProgress}%` }}
                                                    >
                                                        {/* "Levemente Animado" - Shimmer Effect */}
                                                        <div className="absolute inset-0 bg-[#ffffff4d] skew-x-12 animate-[shimmer_2s_infinite]"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* BACK FACE */}
                            <div
                                className="absolute inset-0 bg-[#ffffffb3] backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-[#ffffff80] flex flex-col z-20"
                                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                            >
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-[#e5e7eb80] pb-2 flex justify-between items-center">
                                    Detalhamento de OCs
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                                        className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                                    >
                                        &larr; Voltar
                                    </button>
                                </h3>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                                    {currentOcs.length === 0 && <p className="text-xs text-gray-500 italic text-center mt-4">Nenhuma OC registrada.</p>}
                                    {currentOcs.map((oc, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-xs border-b border-[#e5e7eb80] pb-2 last:border-0 hover:bg-[#ffffff66] p-1 rounded transition-colors">
                                            <span className="text-gray-600 w-2/3 leading-tight break-words" title={oc.description}>{oc.description || "Sem descrição"}</span>
                                            <span className="text-gray-800 font-mono font-medium whitespace-nowrap ml-2">{currency(oc.value || 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Merged Highlights & Attention Card */}
                    <div className="bg-[#ffffff99] backdrop-blur-xl rounded-2xl shadow-sm border border-[#ffffff80] flex-1 flex flex-col min-h-0 overflow-hidden">

                        {/* Section 1: Highlights */}
                        <div className="flex-1 flex flex-col border-b border-[#ffffff33] p-4 min-h-0">
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Destaques Executivos
                                </h3>
                                <button
                                    onClick={() => handleAIEnhance('presentation_highlights')}
                                    disabled={isEnhancing === 'presentation_highlights'}
                                    className="text-[10px] text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:opacity-50 font-medium"
                                    title="Melhorar texto com IA"
                                >
                                    {isEnhancing === 'presentation_highlights' ? 'Gerando...' : 'Melhorar IA'}
                                </button>
                            </div>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                    const val = e.currentTarget.innerHTML;
                                    if (val !== currentMgmt?.presentation_highlights) {
                                        handleUpdateManagement('presentation_highlights', val);
                                        if (currentMgmt) saveManagement({ ...currentMgmt, presentation_highlights: val });
                                    }
                                }}
                                className="w-full flex-1 overflow-y-auto custom-scrollbar text-gray-700 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-100 rounded p-1 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                                data-placeholder="Principais avanços da semana..."
                                dangerouslySetInnerHTML={{ __html: currentMgmt?.presentation_highlights || '' }}
                            ></div>
                        </div>

                        {/* Section 2: Attention Points */}
                        <div className="flex-1 flex flex-col p-4 min-h-0 bg-[#fef2f21a]">
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Pontos de Atenção
                                </h3>
                                <button
                                    onClick={() => handleAIEnhance('attention_points')}
                                    disabled={isEnhancing === 'attention_points'}
                                    className="text-[10px] text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors disabled:opacity-50 font-medium"
                                    title="Melhorar texto com IA"
                                >
                                    {isEnhancing === 'attention_points' ? 'Gerando...' : 'Melhorar IA'}
                                </button>
                            </div>
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                    const val = e.currentTarget.innerHTML;
                                    if (val !== currentMgmt?.attention_points) {
                                        handleUpdateManagement('attention_points', val);
                                        if (currentMgmt) saveManagement({ ...currentMgmt, attention_points: val });
                                    }
                                }}
                                className="w-full flex-1 overflow-y-auto custom-scrollbar text-gray-700 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-100 rounded p-1 transition-all empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                                data-placeholder="Riscos, impedimentos ou atrasos..."
                                dangerouslySetInnerHTML={{ __html: currentMgmt?.attention_points || '' }}
                            ></div>
                        </div>

                    </div>
                </div>

                {/* Team Edit Modal */}

                {/* Sub-Task Edit Modal */}
                {isSubTaskModalOpen && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#00000080] backdrop-blur-sm" onClick={() => setIsSubTaskModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#f9fafb80]">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Detalhes: {selectedPhaseName}</h3>
                                    <p className="text-xs text-gray-500 mt-1">Edite as datas das micro-etapas abaixo</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] text-gray-400 font-medium flex gap-2">
                                        <span>ESC para sair</span>
                                        <span>ENTER para salvar</span>
                                    </div>
                                    <button onClick={() => setIsSubTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                                {subTaskForm.map((task, idx) => (
                                    <SubTaskItem
                                        key={idx}
                                        task={task}
                                        index={idx}
                                        onUpdate={handleSubTaskRefUpdate}
                                    />
                                ))}
                            </div>

                            <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    onClick={() => setIsSubTaskModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveSubTasks}
                                    className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-[#2563eb33] hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {isTeamModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#00000080] backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#f9fafb80]">
                                <h3 className="text-lg font-bold text-gray-800">Editar Equipe do Projeto</h3>
                                <button onClick={() => setIsTeamModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Engenheiro (E)</label>
                                    <select
                                        value={teamForm.engineer}
                                        onChange={e => setTeamForm(prev => ({ ...prev, engineer: e.target.value }))}
                                        className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="">Selecione...</option>
                                        {teamMembers.filter(t => t.role === "Engenheiro").map(t => (
                                            <option key={t.id} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Coordenador (C)</label>
                                    <select
                                        value={teamForm.coordinator}
                                        onChange={e => setTeamForm(prev => ({ ...prev, coordinator: e.target.value }))}
                                        className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="">Selecione...</option>
                                        {teamMembers.filter(t => t.role === "Coordenador").map(t => (
                                            <option key={t.id} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Torre de Controle (CT)</label>
                                    <select
                                        value={teamForm.controlTower}
                                        onChange={e => setTeamForm(prev => ({ ...prev, controlTower: e.target.value }))}
                                        className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="">Selecione...</option>
                                        {teamMembers.filter(t => t.role === "Control Tower").map(t => (
                                            <option key={t.id} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Manager (PM)</label>
                                        <select
                                            value={teamForm.pm}
                                            onChange={e => setTeamForm(prev => ({ ...prev, pm: e.target.value }))}
                                            className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                                        >
                                            <option value="">Selecione...</option>
                                            {teamMembers.map(t => (
                                                <option key={`pm-${t.id}`} value={t.name}>{t.name} ({t.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Construction Manager (CM)</label>
                                        <select
                                            value={teamForm.cm}
                                            onChange={e => setTeamForm(prev => ({ ...prev, cm: e.target.value }))}
                                            className="w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                                        >
                                            <option value="">Selecione...</option>
                                            {teamMembers.map(t => (
                                                <option key={`cm-${t.id}`} value={t.name}>{t.name} ({t.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsTeamModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveTeam}
                                    className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-[#2563eb33] hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Modal */}
                {isFilterModalOpen && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#00000080] backdrop-blur-sm" onClick={() => setIsFilterModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#f9fafb80]">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    Filtrar Obras
                                </h3>
                                <button onClick={() => setIsFilterModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {/* Regional Filter */}
                                    <div className="bg-[#f9fafb80] p-4 rounded-xl border border-gray-100">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            Regional
                                        </h4>
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                            {Array.from(new Set(works.map(w => w.regional))).filter(Boolean).sort().map(reg => (
                                                <label key={reg} className="flex items-center gap-2 cursor-pointer group p-1 hover:bg-white rounded transition-colors">
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={activeFilters.regional.includes(reg)}
                                                            onChange={e => {
                                                                if (e.target.checked) setActiveFilters(p => ({ ...p, regional: [...p.regional, reg] }));
                                                                else setActiveFilters(p => ({ ...p, regional: p.regional.filter(x => x !== reg) }));
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">{reg}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Role Filters */}
                                    {[
                                        { label: 'Engenheiro', key: 'engineer', role: 'Engenheiro' },
                                        { label: 'Coordenador', key: 'coordinator', role: 'Coordenador' },
                                        { label: 'Control Tower', key: 'controlTower', role: 'Control Tower' },
                                        { label: 'Project Manager', key: 'pm', role: 'PM' },
                                        { label: 'Construction Manager', key: 'cm', role: 'CM' },
                                    ].map(filter => (
                                        <div key={filter.key} className="bg-[#f9fafb80] p-4 rounded-xl border border-gray-100">
                                            <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                {filter.label}
                                            </h4>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                {Array.from(new Set(managements.map(m => {
                                                    // @ts-expect-error - Dynamic key access safe here due to mapping
                                                    const val = m[filter.key === 'controlTower' ? 'control_tower' : filter.key];
                                                    return val;
                                                }))).filter(Boolean).sort().map((name: string) => (
                                                    <label key={name} className="flex items-center gap-2 cursor-pointer group p-1 hover:bg-white rounded transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            // @ts-expect-error - Dynamic key access
                                                            checked={activeFilters[filter.key].includes(name)}
                                                            onChange={e => {
                                                                if (e.target.checked) {
                                                                    // @ts-expect-error - Dynamic key access
                                                                    setActiveFilters(p => ({ ...p, [filter.key]: [...p[filter.key], name] }));
                                                                } else {
                                                                    // @ts-expect-error - Dynamic key access
                                                                    setActiveFilters(p => ({ ...p, [filter.key]: p[filter.key].filter((x: string) => x !== name) }));
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                                                        />
                                                        <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">{name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-100">
                                <button
                                    onClick={() => setActiveFilters({
                                        regional: [],
                                        engineer: [],
                                        coordinator: [],
                                        pm: [],
                                        cm: [],
                                        controlTower: []
                                    })}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Limpar Filtros
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsFilterModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => setIsFilterModalOpen(false)}
                                        className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-[#2563eb33] hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Aplicar Filtros
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}



                {/* PDF Selection Modal */}
                {isPdfModalOpen && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#00000080] backdrop-blur-sm" onClick={() => !isGeneratingPdf && setIsPdfModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#f9fafb80]">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Gerar Relatório PDF
                                </h3>
                                {!isGeneratingPdf && (
                                    <button onClick={() => setIsPdfModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                {isGeneratingPdf ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                                        <h4 className="text-lg font-bold text-gray-800 mb-2">Gerando Relatório...</h4>
                                        <div className="w-full max-w-sm bg-gray-200 rounded-full h-2.5 mb-2">
                                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${pdfProgress}%` }}></div>
                                        </div>
                                        <p className="text-sm text-gray-500">Por favor, aguarde. {pdfProgress}% concluído.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-sm text-gray-600">Selecione as obras para incluir no relatório:</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedWorksForPdf(new Set(visibleWorks.map(w => w.id)))}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                                >
                                                    Selecionar Tudo
                                                </button>
                                                <span className="text-gray-300">|</span>
                                                <button
                                                    onClick={() => setSelectedWorksForPdf(new Set())}
                                                    className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                                                >
                                                    Limpar Seleção
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {visibleWorks.map(work => (
                                                <label key={work.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedWorksForPdf.has(work.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                        checked={selectedWorksForPdf.has(work.id)}
                                                        onChange={e => {
                                                            const newSet = new Set(selectedWorksForPdf);
                                                            if (e.target.checked) newSet.add(work.id);
                                                            else newSet.delete(work.id);
                                                            setSelectedWorksForPdf(newSet);
                                                        }}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="font-bold text-gray-800 text-sm">{work.id}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                                            <span>{work.regional}</span>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                            <span>{work.address?.city}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {!isGeneratingPdf && (
                                <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                                    <button
                                        onClick={() => setIsPdfModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={generatePdf}
                                        disabled={selectedWorksForPdf.size === 0}
                                        className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-[#2563eb33] hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        Gerar Relatório ({selectedWorksForPdf.size})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

            </div>
        </div>
    );
}
