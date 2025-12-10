import { useState, useEffect, useMemo } from "react";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { getAuthToken } from "../firebase";

export default function Engineering() {
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState("");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [activeTab, setActiveTab] = useState(0);

    // Data State
    const [works, setWorks] = useState<any[]>([]);
    const [managements, setManagements] = useState<any[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Management Form State
    const [selectedWorkId, setSelectedWorkId] = useState("");
    const [selectedWork, setSelectedWork] = useState<any>(null); // Computed from ID

    // Management Data Structure
    const [ownerWorks, setOwnerWorks] = useState<any[]>([]);
    const [licenses, setLicenses] = useState<any[]>([]);
    const [thermometer, setThermometer] = useState<any[]>([]);

    // Additional Info
    const [operator, setOperator] = useState("");
    const [sizeM2, setSizeM2] = useState("");
    const [floorSizeM2, setFloorSizeM2] = useState("");
    const [engineer, setEngineer] = useState("");
    const [coordinator, setCoordinator] = useState("");
    const [controlTower, setControlTower] = useState("");
    const [pm, setPm] = useState("");
    const [cm, setCm] = useState("");

    // Schedules
    const [macroSchedule, setMacroSchedule] = useState<any[]>([]);
    const [supplySchedule, setSupplySchedule] = useState<any[]>([]);

    // Expanded Card State
    const [cardTab, setCardTab] = useState("overview"); // overview, macro, supply, docs, daily

    // Advanced Info State
    const [complementaryInfo, setComplementaryInfo] = useState<any[]>([]);
    const [generalDocs, setGeneralDocs] = useState<any>({});
    const [capex, setCapex] = useState<any>({});
    const [dailyLog, setDailyLog] = useState<any[]>([]);
    const [highlights, setHighlights] = useState<any>({});

    // Preservation State (Report Fields)
    const [presentationHighlights, setPresentationHighlights] = useState("");
    const [attentionPoints, setAttentionPoints] = useState("");
    const [image1, setImage1] = useState("");
    const [image2, setImage2] = useState("");
    const [mapImage, setMapImage] = useState("");

    // Occurrences State
    const [occurrences, setOccurrences] = useState<any[]>([]);
    const [occurrenceForm, setOccurrenceForm] = useState({ id: '', work_id: '', date: '', description: '', type: 'Atividade', status: 'Active' });
    const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);

    // Team State
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // Filter State
    const [searchText, setSearchText] = useState("");
    const [filterRegional, setFilterRegional] = useState("");
    const [filterWorkType, setFilterWorkType] = useState("");
    const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [customDateStart, setCustomDateStart] = useState("");
    const [customDateEnd, setCustomDateEnd] = useState("");

    useEffect(() => {
        fetchWorks();
        fetchManagements();
        fetchOccurrences();
        fetchTeam();
    }, []);

    // Effect to set active work data when ID changes
    useEffect(() => {
        if (selectedWorkId) {
            const w = works.find(item => item.id === selectedWorkId);
            setSelectedWork(w || null);
            fetchManagementData(selectedWorkId);
        } else {
            setSelectedWork(null);
            resetManagementData();
        }
    }, [selectedWorkId, works]);

    // Reset card tab when expanded changes
    useEffect(() => {
        setCardTab("overview");
    }, [expandedId]);

    const fetchWorks = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setWorks(await response.json());
            }
        } catch (error) {
            console.error("Error fetching works:", error);
        }
    };

    const fetchManagements = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Ensure default schedules exist for legacy data
                const processed = data.map((m: any) => ({
                    ...m,
                    macro_schedule: (m.macro_schedule && m.macro_schedule.length > 0) ? m.macro_schedule : initMacroSchedule(),
                    supply_schedule: (m.supply_schedule && m.supply_schedule.length > 0) ? m.supply_schedule : initSupplySchedule(),
                    complementary_info: (m.complementary_info && m.complementary_info.length > 0) ? m.complementary_info : initComplementaryInfo(),
                    general_docs: m.general_docs || initGeneralDocs(),
                    capex: m.capex || initCapex(),
                    daily_log: (m.daily_log && m.daily_log.length > 0) ? m.daily_log : initDailyLog(),
                    highlights: m.highlights || initHighlights()
                }));
                setManagements(processed);
            }
        } catch (error) {
            console.error("Error fetching managements:", error);
        }
    };

    const fetchOccurrences = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/occurrences`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setOccurrences(await response.json());
            }
        } catch (error) {
            console.error("Error fetching occurrences:", error);
        }
    };

    const fetchTeam = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/team`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setTeamMembers(await response.json());
            }
        } catch (error) {
            console.error("Error fetching team:", error);
        }
    };

    const handleSaveOccurrence = async () => {
        if (!occurrenceForm.description || !occurrenceForm.date || !occurrenceForm.work_id) {
            setToast({ message: "Preencha os campos obrigatórios.", type: "error" });
            return;
        }

        try {
            const token = await getAuthToken();
            const isEdit = !!occurrenceForm.id;
            const method = isEdit ? "PUT" : "POST";
            const url = isEdit
                ? `${import.meta.env.VITE_API_BASE_URL}/occurrences/${occurrenceForm.id}`
                : `${import.meta.env.VITE_API_BASE_URL}/occurrences`;

            // Generate ID if new
            const payload = isEdit ? occurrenceForm : { ...occurrenceForm, id: "occ_" + Math.random().toString(36).substr(2, 9) };

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: "Ocorrência salva!", type: "success" });
                setIsOccurrenceModalOpen(false);
                fetchOccurrences();
                setOccurrenceForm({ id: '', work_id: '', date: '', description: '', type: 'Atividade', status: 'Active' });
            } else {
                setToast({ message: "Erro ao salvar.", type: "error" });
            }
        } catch (error) {
            console.error("Error saving occurrence:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    const handleDeleteOccurrence = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta ocorrência?")) return;
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/occurrences/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setToast({ message: "Ocorrência excluída.", type: "success" });
                fetchOccurrences();
            }
        } catch (error) {
            setToast({ message: "Erro ao excluir.", type: "error" });
        }
    };

    const fetchManagementData = async (workId: string) => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements/${workId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && Object.keys(data).length > 0) {
                    // Populate from existing data
                    setOwnerWorks(data.owner_works || initOwnerWorks());
                    setLicenses(data.licenses || initLicenses());
                    setThermometer(data.thermometer || initThermometer());
                    setOperator(data.operator || "");
                    setSizeM2(data.size_m2 || "");
                    setFloorSizeM2(data.floor_size_m2 || "");
                    setEngineer(data.engineer || "");
                    setCoordinator(data.coordinator || "");
                    setControlTower(data.control_tower || "");
                    setPm(data.pm || "");
                    setCm(data.cm || "");
                    setMacroSchedule(data.macro_schedule || initMacroSchedule());
                    setSupplySchedule(data.supply_schedule || initSupplySchedule());
                    setComplementaryInfo(data.complementary_info || initComplementaryInfo());
                    setGeneralDocs(data.general_docs || initGeneralDocs());
                    setCapex(data.capex || initCapex());
                    setDailyLog(data.daily_log || initDailyLog());
                    setHighlights(data.highlights || initHighlights());
                    setPresentationHighlights(data.presentation_highlights || "");
                    setAttentionPoints(data.attention_points || "");
                    setImage1(data.image_1 || "");
                    setImage2(data.image_2 || "");
                    setMapImage(data.map_image || "");
                } else {
                    // Initialize clean lists
                    resetManagementData();
                }
            } else {
                resetManagementData();
            }
        } catch (error) {
            console.error("Error fetching management:", error);
            resetManagementData();
        }
    };

    // Initializers with Default Items
    const initOwnerWorks = () => [
        { name: "Assinatura de contrato", date: "", status: "⚪️" },
        { name: "Leitura de contrato", date: "", status: "⚪️" },
        { name: "Recebimento chaves", date: "", status: "⚪️" },
        { name: "Entrada antecipada", date: "", status: "⚪️" },
        { name: "Liberação de entrada", date: "", status: "⚪️" }
    ];

    const initLicenses = () => [
        { name: "AVCB", date: "", status: "⚪️" },
        { name: "Habite-se", date: "", status: "⚪️" },
        { name: "Matrícula", date: "", status: "⚪️" },
        { name: "IPTU", date: "", status: "⚪️" },
        { name: "Notificação", date: "", status: "⚪️" }
    ];

    const initThermometer = () => [
        { name: "Segurança", status: "⚪️" },
        { name: "Qualidade", status: "⚪️" },
        { name: "Cronograma", status: "⚪️" },
        { name: "Orçamento", status: "⚪️" }
    ];

    const initMacroSchedule = () => [
        { name: "Mobilização", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Obra Serralheria", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Inst. elétricas", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Equipamentos", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Go Live", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Check List", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Reunião final", start_planned: "", start_real: "", end_planned: "", end_real: "" }
    ];

    const initSupplySchedule = () => [
        { name: "Niveladoras", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Quadros elétricos", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Ventiladores", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Bate rodas", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Semáforos", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Dock Lights", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Guarda Corpo", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Demarcação de piso", start_planned: "", start_real: "", end_planned: "", end_real: "" },
        { name: "Comunicação visual", start_planned: "", start_real: "", end_planned: "", end_real: "" }
    ];

    const initComplementaryInfo = () => [
        { name: "Documentações", date: "", status: "⚪️" },
        { name: "Integração", date: "", status: "⚪️" },
        { name: "Data Kick OFF", date: "", status: "⚪️" },
        { name: "ART", date: "", status: "⚪️" },
        { name: "Seguro", date: "", status: "⚪️" },
        { name: "Projeto Elétrico", date: "", status: "⚪️" },
        { name: "Pacote Layout", date: "", status: "⚪️" },
        { name: "Fotos Site", date: "", status: "⚪️" },
        { name: "As built", date: "", status: "⚪️" }
    ];

    const initGeneralDocs = () => ({
        layout: "", construtora: "", contato: "", periodo_obra: "", data_inicio: "", data_termino: "", dias_pendentes: ""
    });

    const initCapex = () => ({
        planned: "", approved: "", contracted: ""
    });

    const initDailyLog = () => [
        { day: "Segunda-feira" }, { day: "Terça-feira" }, { day: "Quarta-feira" }, { day: "Quinta-feira" },
        { day: "Sexta-feira" }, { day: "Sábado" }, { day: "Domingo" }
    ];

    const initHighlights = () => ({
        special_attention: "", action_plans: "", relevant_activities: "", observations: ""
    });

    const resetManagementData = () => {
        setOwnerWorks(initOwnerWorks());
        setLicenses(initLicenses());
        setThermometer(initThermometer());
        setOperator("");
        setSizeM2("");
        setFloorSizeM2("");
        setEngineer("");
        setCoordinator("");
        setControlTower("");
        setPm("");
        setCm("");
        setMacroSchedule(initMacroSchedule());
        setSupplySchedule(initSupplySchedule());
        setComplementaryInfo(initComplementaryInfo());
        setGeneralDocs(initGeneralDocs());
        setCapex(initCapex());
        setDailyLog(initDailyLog());
        setHighlights(initHighlights());
        setPresentationHighlights("");
        setAttentionPoints("");
        setImage1("");
        setImage2("");
        setMapImage("");
    };

    // Action Handlers
    const handleButtonClick = (type: string) => {
        setModalType(type);
        setIsModalOpen(true);
        setSelectedWorkId(""); // Reset selection
        setActiveTab(0);
    };

    const handleSaveManagement = async () => {
        if (!selectedWorkId) {
            setToast({ message: "Selecione uma obra.", type: "error" });
            return;
        }

        const payload = {
            work_id: selectedWorkId,
            owner_works: ownerWorks,
            licenses: licenses,
            thermometer: thermometer,
            operator: operator,
            size_m2: sizeM2,
            floor_size_m2: floorSizeM2,
            engineer: engineer,
            coordinator: coordinator,
            control_tower: controlTower,
            pm: pm,
            cm: cm,
            macro_schedule: macroSchedule,
            supply_schedule: supplySchedule,
            complementary_info: complementaryInfo,
            general_docs: generalDocs,
            capex: capex,
            daily_log: dailyLog,
            highlights: highlights,
            presentation_highlights: presentationHighlights,
            attention_points: attentionPoints,
            image_1: image1,
            image_2: image2,
            map_image: mapImage
        };

        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: "Gestão salva com sucesso!", type: "success" });
                setIsModalOpen(false);
                fetchManagements(); // Refresh list
            } else {
                setToast({ message: "Erro ao salvar.", type: "error" });
            }
        } catch (error) {
            console.error("Error saving:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    // Helper: Update Item in List
    const updateItem = (listName: 'owner' | 'license' | 'thermo' | 'macro' | 'supply', index: number, field: string, value: string) => {
        if (listName === 'owner') {
            const newList = [...ownerWorks];
            newList[index] = { ...newList[index], [field]: value };
            setOwnerWorks(newList);
        } else if (listName === 'license') {
            const newList = [...licenses];
            newList[index] = { ...newList[index], [field]: value };
            setLicenses(newList);
        } else if (listName === 'thermo') {
            const newList = [...thermometer];
            newList[index] = { ...newList[index], [field]: value };
            setThermometer(newList);
        } else if (listName === 'macro') {
            const newList = [...macroSchedule];
            newList[index] = { ...newList[index], [field]: value };
            setMacroSchedule(newList);
        } else if (listName === 'supply') {
            const newList = [...supplySchedule];
            newList[index] = { ...newList[index], [field]: value };
            setSupplySchedule(newList);
        } else if (listName === 'complementary') {
            const newList = [...complementaryInfo];
            newList[index] = { ...newList[index], [field]: value };
            setComplementaryInfo(newList);
        } else if (listName === 'daily') {
            const newList = [...dailyLog];
            newList[index] = { ...newList[index], [field]: value };
            setDailyLog(newList);
        }
    };

    // Helper: Determine Date Color
    const getDateColor = (planned: string, real: string) => {
        if (!planned || !real) return "text-gray-600";
        if (real > planned) return "text-red-500 font-bold";
        return "text-green-500 font-bold";
    };

    // Components
    const StatusDropdown = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-lg border-gray-200 bg-white/50 text-sm py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
        >
            <option value="⚪️">⚪️</option>
            <option value="🟢">🟢</option>
            <option value="🟡">🟡</option>
            <option value="🔴">🔴</option>
        </select>
    );

    // Inline Update Handler for Schedules
    const handleScheduleUpdate = async (workId: string, type: 'macro' | 'supply' | 'complementary' | 'daily', index: number, field: string, value: string) => {
        // 1. Update Local State
        const updatedManagements = managements.map(m => {
            if (m.work_id === workId) {
                let listName = '';
                if (type === 'macro') listName = 'macro_schedule';
                else if (type === 'supply') listName = 'supply_schedule';
                else if (type === 'complementary') listName = 'complementary_info';
                else if (type === 'daily') listName = 'daily_log';

                const list = [...(m[listName] || [])];
                if (!list[index]) return m;
                list[index] = { ...list[index], [field]: value };
                return { ...m, [listName]: list };
            }
            return m;
        });
        setManagements(updatedManagements);

        // 2. Persist to Backend
        const managementToSave = updatedManagements.find(m => m.work_id === workId);
        if (managementToSave) {
            try {
                const token = await getAuthToken();
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(managementToSave)
                });
            } catch (error) {
                console.error("Failed to auto-save schedule", error);
            }
        }
    };

    // Filter Logic
    const filteredManagements = useMemo(() => {
        return managements.filter(m => {
            // Lookup Work Info (Regional, etc reside in Work, not Management usually)
            const work = works.find(w => w.id === m.work_id);
            const regional = work?.regional || m.regional;
            const workType = work?.type || m.work_type; // Fallback to m.work_type if on m

            // 1. Text Search (ID, Regional, Operator, Description in items?)
            const searchLower = searchText.toLowerCase();
            const textMatch =
                !searchText ||
                m.work_id.toLowerCase().includes(searchLower) ||
                regional?.toLowerCase().includes(searchLower) ||
                m.operator?.toLowerCase().includes(searchLower) ||
                workType?.toLowerCase().includes(searchLower);

            if (!textMatch) return false;

            // 2. Dropdowns
            if (filterRegional && regional?.trim() !== filterRegional) return false;
            // Improved work_type check
            if (filterWorkType && workType && workType !== filterWorkType && m.work_type !== filterWorkType) return false;

            // 3. Date Filter
            if (dateFilterType === 'all') return true;

            let startRange = new Date();
            let endRange = new Date();
            startRange.setHours(0, 0, 0, 0);
            endRange.setHours(23, 59, 59, 999);

            if (dateFilterType === 'today') {
                // Default is today
            } else if (dateFilterType === 'week') {
                const day = startRange.getDay();
                const diff = startRange.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
                startRange.setDate(diff);
                endRange.setDate(startRange.getDate() + 6);
            } else if (dateFilterType === 'month') {
                startRange.setDate(1);
                endRange.setMonth(endRange.getMonth() + 1);
                endRange.setDate(0);
            } else if (dateFilterType === 'custom') {
                if (!customDateStart) return true; // No start date selected
                startRange = new Date(customDateStart + "T00:00:00");
                if (customDateEnd) {
                    endRange = new Date(customDateEnd + "T23:59:59");
                } else {
                    endRange = new Date(customDateStart + "T23:59:59"); // Single date
                }
            }

            const rangeStartTs = startRange.getTime();
            const rangeEndTs = endRange.getTime();

            // Helper to check if a single date is in range
            const isInRange = (dateStr: string) => {
                if (!dateStr) return false;
                const d = new Date(dateStr + "T12:00:00").getTime(); // Avoid timezone shifts with noon
                return d >= rangeStartTs && d <= rangeEndTs;
            };

            // Helper to check if an interval overlaps with range
            const isOverlap = (startStr: string, endStr: string) => {
                if (!startStr) return false; // Must have start
                const s = new Date(startStr + "T00:00:00").getTime();
                const e = endStr ? new Date(endStr + "T23:59:59").getTime() : s; // If no end, assume single day

                return Math.max(s, rangeStartTs) <= Math.min(e, rangeEndTs);
            };

            // Check ALL date fields
            // A. Main Date
            if (isInRange(m.go_live_date)) return true;

            // B. Owner Works / Licenses / Daily Log / Complementary (Single Dates)
            if (m.owner_works?.some((i: any) => isInRange(i.date))) return true;
            if (m.licenses?.some((i: any) => isInRange(i.date))) return true;
            if (m.daily_log?.some((i: any) => isInRange(i.date))) return true;
            if (m.complementary_info?.some((i: any) => isInRange(i.date))) return true;

            // C. Schedules / Docs (Intervals)
            // Macro
            if (m.macro_schedule?.some((i: any) => isOverlap(i.start_planned, i.end_planned) || isOverlap(i.start_real, i.end_real))) return true;
            // Supply
            if (m.supply_schedule?.some((i: any) => isOverlap(i.start_planned, i.end_planned) || isOverlap(i.start_real, i.end_real))) return true;
            // General Docs
            if (isOverlap(m.general_docs?.data_inicio, m.general_docs?.data_termino)) return true;

            return false;
        });
    }, [managements, works, searchText, filterRegional, filterWorkType, dateFilterType, customDateStart, customDateEnd]);

    // Helper: Update Object Fields (Docs, Capex, Highlights)
    const handleObjectUpdate = async (workId: string, type: 'general_docs' | 'capex' | 'highlights', field: string, value: string) => {
        const updatedManagements = managements.map(m => {
            if (m.work_id === workId) {
                const currentObj = m[type] || {};
                return { ...m, [type]: { ...currentObj, [field]: value } };
            }
            return m;
        });
        setManagements(updatedManagements);

        // Persist
        const managementToSave = updatedManagements.find(m => m.work_id === workId);
        if (managementToSave) {
            try {
                const token = await getAuthToken();
                await fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify(managementToSave)
                });
            } catch (error) { console.error("Auto-save failed", error); }
        }
    };

    const handleCardClick = (workId: string) => {
        setModalType("Editar Gestão");
        setSelectedWorkId(workId);
        setIsModalOpen(true);
        setActiveTab(0);
    };

    // Status Icon Helper
    const renderStatusIcon = (status: string) => {
        switch (status) {
            case "🟢": return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-green-500"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>;
            case "🟡": return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>;
            case "🔴": return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>;
            default: return <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>;
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        // Handle YYYY-MM-DD
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    return (
        <div className="relative min-h-full w-full">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Main Content */}
            <div className="mr-80 px-8 py-8 w-auto mx-0">
                {managements.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                        <div className="flex flex-col items-center justify-center text-gray-400 py-12">
                            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-500">Área de Engenharia</h3>
                            <p className="text-sm">Selecione uma ação no menu lateral.</p>
                        </div>
                    </div>
                ) : (
                    // Cards Grid
                    <div className="grid grid-cols-1 gap-6 pb-20">
                        {filteredManagements.map(m => {
                            const work = works.find(w => w.id === m.work_id);
                            const isExpanded = expandedId === m.work_id;

                            return (
                                <div
                                    key={m.work_id}
                                    className={`relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all hover:bg-white/50 group flex flex-col ${isExpanded ? 'col-span-full' : 'col-span-1'}`}
                                >
                                    {/* Background Icon */}
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                                        </svg>
                                    </div>

                                    {/* Card Actions (Top Right) */}
                                    <div className="absolute top-4 right-4 flex gap-2 z-20">
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : m.work_id)}
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
                                        <button
                                            onClick={() => handleCardClick(m.work_id)}
                                            className="p-1.5 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors shadow-sm"
                                            title="Editar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => {/* Add Delete Logic Later */ }}
                                            className="p-1.5 rounded-full bg-white/50 hover:bg-red-100 text-red-600 transition-colors shadow-sm"
                                            title="Excluir"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="relative z-10 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100/50 text-blue-700 border border-blue-200/50 uppercase tracking-wider">
                                                    {work?.id || m.work_id}
                                                </span>
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 mb-1">{work?.regional || "Sem Regional"}</h3>
                                        {/* Work Type */}
                                        <p className="text-sm font-medium text-gray-700 mb-0.5">{work?.work_type || "-"}</p>
                                        {/* Operator */}
                                        <p className="text-sm text-gray-500 mb-4">{m.operator || "-"}</p>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">GoLive</span>
                                                <span className="font-medium text-gray-700">{formatDate(work?.go_live_date)}</span>
                                            </div>
                                            {m.size_m2 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Área</span>
                                                    <span className="font-medium text-gray-700">{m.size_m2} m²</span>
                                                </div>
                                            )}
                                            {/* Team Display */}
                                            {(m.engineer || m.coordinator || m.control_tower) && (
                                                <div className="pt-2 border-t border-gray-100/50 mt-2 space-y-1">
                                                    {m.control_tower && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Control Tower</span>
                                                            <span className="font-medium text-gray-700 truncate ml-2">{m.control_tower}</span>
                                                        </div>
                                                    )}
                                                    {m.engineer && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Engenheiro</span>
                                                            <span className="font-medium text-gray-700 truncate ml-2">{m.engineer}</span>
                                                        </div>
                                                    )}
                                                    {m.coordinator && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Coordenador</span>
                                                            <span className="font-medium text-gray-700 truncate ml-2">{m.coordinator}</span>
                                                        </div>
                                                    )}
                                                    {m.pm && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">PM</span>
                                                            <span className="font-medium text-gray-700 truncate ml-2">{m.pm}</span>
                                                        </div>
                                                    )}
                                                    {m.cm && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">CM</span>
                                                            <span className="font-medium text-gray-700 truncate ml-2">{m.cm}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-white/50 mt-auto">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Cronograma</span>
                                                <div className="flex items-center gap-2">
                                                    {renderStatusIcon(m.thermometer?.find((t: any) => t.name === "Cronograma")?.status)}
                                                    <span className="text-xs font-medium text-gray-600">
                                                        {m.thermometer?.find((t: any) => t.name === "Cronograma")?.status === "🟢" ? "Em dia" :
                                                            m.thermometer?.find((t: any) => t.name === "Cronograma")?.status === "🟡" ? "Atenção" :
                                                                m.thermometer?.find((t: any) => t.name === "Cronograma")?.status === "🟡" ? "Atenção" :
                                                                    m.thermometer?.find((t: any) => t.name === "Cronograma")?.status === "🔴" ? "Atrasado" : "Não iniciado"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="mt-8 pt-6 border-t border-gray-200/50 animate-fadeIn">
                                                {/* Internal Tabs */}
                                                <div className="flex gap-4 mb-6 border-b border-gray-200/50 pb-2">
                                                    <button
                                                        onClick={() => setCardTab("overview")}
                                                        className={`text-sm font-bold uppercase tracking-wide transition-colors ${cardTab === "overview" ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        Visão Geral
                                                    </button>
                                                    <button
                                                        onClick={() => setCardTab("macro")}
                                                        className={`text-sm font-bold uppercase tracking-wide transition-colors ${cardTab === "macro" ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        Cronograma
                                                    </button>
                                                    <button
                                                        onClick={() => setCardTab("supply")}
                                                        className={`text-sm font-bold uppercase tracking-wide transition-colors ${cardTab === "supply" ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        Suprimentos
                                                    </button>
                                                    <button
                                                        onClick={() => setCardTab("docs")}
                                                        className={`text-sm font-bold uppercase tracking-wide transition-colors ${cardTab === "docs" ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        Documentação
                                                    </button>
                                                    <button
                                                        onClick={() => setCardTab("daily")}
                                                        className={`text-sm font-bold uppercase tracking-wide transition-colors ${cardTab === "daily" ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        Diário de Obra
                                                    </button>
                                                    <button
                                                        onClick={() => setCardTab("occurrences")}
                                                        className={`text-sm font-bold uppercase tracking-wide transition-colors ${cardTab === "occurrences" ? "text-blue-600 border-b-2 border-blue-600 -mb-2.5 pb-2" : "text-gray-400 hover:text-gray-600"}`}
                                                    >
                                                        Ocorrências
                                                    </button>
                                                </div>

                                                {/* Overview TabContent */}
                                                {cardTab === "overview" && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
                                                        {/* Obras Proprietário */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Obras Proprietário</h4>
                                                            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-400 uppercase px-2 mb-2">
                                                                <div className="col-span-5">Descrição</div>
                                                                <div className="col-span-4">Data</div>
                                                                <div className="col-span-3 text-right">Status</div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {m.owner_works?.map((item: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/40 p-2 rounded-lg border border-white/50 text-sm hover:bg-white/60 transition-colors">
                                                                        <div className="col-span-5 font-medium text-gray-700 truncate" title={item.name}>{item.name}</div>
                                                                        <div className="col-span-4 text-xs text-gray-600">{formatDate(item.date)}</div>
                                                                        <div className="col-span-3 flex justify-end">{renderStatusIcon(item.status)}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Licenças */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Licenças</h4>
                                                            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-400 uppercase px-2 mb-2">
                                                                <div className="col-span-5">Descrição</div>
                                                                <div className="col-span-4">Data</div>
                                                                <div className="col-span-3 text-right">Status</div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {m.licenses?.map((item: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/40 p-2 rounded-lg border border-white/50 text-sm hover:bg-white/60 transition-colors">
                                                                        <div className="col-span-5 font-medium text-gray-700 truncate" title={item.name}>{item.name}</div>
                                                                        <div className="col-span-4 text-xs text-gray-600">{formatDate(item.date)}</div>
                                                                        <div className="col-span-3 flex justify-end">{renderStatusIcon(item.status)}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Termômetro */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Termômetro</h4>
                                                            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-400 uppercase px-2 mb-2">
                                                                <div className="col-span-9">Indicador</div>
                                                                <div className="col-span-3 text-right">Status</div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {m.thermometer?.map((item: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/40 p-2 rounded-lg border border-white/50 text-sm hover:bg-white/60 transition-colors">
                                                                        <div className="col-span-9 font-medium text-gray-700 truncate" title={item.name}>{item.name}</div>
                                                                        <div className="col-span-3 flex justify-end">{renderStatusIcon(item.status)}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Macro Schedule Tab */}
                                                {cardTab === "macro" && (
                                                    <div className="animate-fadeIn overflow-x-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead>
                                                                <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                                                                    <th className="font-semibold py-2 px-4">Item</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Início Previsto</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Início Realizado</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Término Previsto</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Término Realizado</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {m.macro_schedule?.map((item: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-white/50 transition-colors">
                                                                        <td className="py-2 px-4 font-medium text-gray-700">{item.name}</td>
                                                                        <td className="py-2 px-2">
                                                                            <input type="date" value={item.start_planned || ""} onChange={e => handleScheduleUpdate(m.work_id, 'macro', idx, 'start_planned', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs text-gray-600" />
                                                                        </td>
                                                                        <td className={`py-2 px-2 text-center ${getDateColor(item.start_planned, item.start_real)}`}>
                                                                            <input type="date" value={item.start_real || ""} onChange={e => handleScheduleUpdate(m.work_id, 'macro', idx, 'start_real', e.target.value)} className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs ${getDateColor(item.start_planned, item.start_real)}`} />
                                                                        </td>
                                                                        <td className="py-2 px-2">
                                                                            <input type="date" value={item.end_planned || ""} onChange={e => handleScheduleUpdate(m.work_id, 'macro', idx, 'end_planned', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs text-gray-600" />
                                                                        </td>
                                                                        <td className={`py-2 px-2 text-center ${getDateColor(item.end_planned, item.end_real)}`}>
                                                                            <input type="date" value={item.end_real || ""} onChange={e => handleScheduleUpdate(m.work_id, 'macro', idx, 'end_real', e.target.value)} className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs ${getDateColor(item.end_planned, item.end_real)}`} />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {/* Supply Schedule Tab */}
                                                {cardTab === "supply" && (
                                                    <div className="animate-fadeIn overflow-x-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead>
                                                                <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                                                                    <th className="font-semibold py-2 px-4">Item</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Início Previsto</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Início Realizado</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Término Previsto</th>
                                                                    <th className="font-semibold py-2 px-2 text-center">Término Realizado</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {m.supply_schedule?.map((item: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-white/50 transition-colors">
                                                                        <td className="py-2 px-4 font-medium text-gray-700">{item.name}</td>
                                                                        <td className="py-2 px-2">
                                                                            <input type="date" value={item.start_planned || ""} onChange={e => handleScheduleUpdate(m.work_id, 'supply', idx, 'start_planned', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs text-gray-600" />
                                                                        </td>
                                                                        <td className={`py-2 px-2 text-center ${getDateColor(item.start_planned, item.start_real)}`}>
                                                                            <input type="date" value={item.start_real || ""} onChange={e => handleScheduleUpdate(m.work_id, 'supply', idx, 'start_real', e.target.value)} className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs ${getDateColor(item.start_planned, item.start_real)}`} />
                                                                        </td>
                                                                        <td className="py-2 px-2">
                                                                            <input type="date" value={item.end_planned || ""} onChange={e => handleScheduleUpdate(m.work_id, 'supply', idx, 'end_planned', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs text-gray-600" />
                                                                        </td>
                                                                        <td className={`py-2 px-2 text-center ${getDateColor(item.end_planned, item.end_real)}`}>
                                                                            <input type="date" value={item.end_real || ""} onChange={e => handleScheduleUpdate(m.work_id, 'supply', idx, 'end_real', e.target.value)} className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs ${getDateColor(item.end_planned, item.end_real)}`} />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Docs & Financeiro Tab */}
                                        {cardTab === "docs" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
                                                {/* Coluna 1: Informações Complementares */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Informações Complementares</h4>
                                                    <div className="space-y-2">
                                                        {m.complementary_info?.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-center justify-between bg-white/40 p-2 rounded-lg border border-white/50 text-sm hover:bg-white/60 transition-colors gap-2">
                                                                <span className="font-medium text-gray-700 truncate flex-1">{item.name}</span>
                                                                <input
                                                                    type="date"
                                                                    value={item.date || ""}
                                                                    onChange={(e) => handleScheduleUpdate(m.work_id, 'complementary', idx, 'date', e.target.value)}
                                                                    className="text-xs border-gray-200 rounded p-1 w-28 bg-white/50"
                                                                />
                                                                <StatusDropdown
                                                                    value={item.status}
                                                                    onChange={(val) => handleScheduleUpdate(m.work_id, 'complementary', idx, 'status', val)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Coluna 2: Documentação e Capex */}
                                                <div className="space-y-8">
                                                    {/* Documentação Geral */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Documentação Geral</h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {['Layout', 'Construtora', 'Contato', 'Período Obra', 'Data Início', 'Data Término', 'Dias Pendentes'].map((field) => {
                                                                const key = field.toLowerCase().replace(/ /g, '_').replace('í', 'i').replace('é', 'e').replace('ç', 'c').replace('ã', 'a');

                                                                // Logic for Input Types and Values
                                                                const isDate = key === 'data_inicio' || key === 'data_termino';
                                                                const isCalculated = key === 'dias_pendentes';

                                                                let displayValue = m.general_docs?.[key] || "";

                                                                // Calculate Days Pending (Termino - Inicio)
                                                                if (isCalculated) {
                                                                    const start = m.general_docs?.data_inicio;
                                                                    const end = m.general_docs?.data_termino;
                                                                    if (start && end) {
                                                                        const diff = new Date(end).getTime() - new Date(start).getTime();
                                                                        displayValue = Math.ceil(diff / (1000 * 3600 * 24)).toString();
                                                                    }
                                                                }

                                                                return (
                                                                    <div key={key} className={key === 'dias_pendentes' ? 'col-span-2' : ''}>
                                                                        <label className="text-[10px] uppercase text-gray-400 font-bold mb-0.5 block">{field}</label>
                                                                        <input
                                                                            type={isDate ? "date" : "text"}
                                                                            value={displayValue}
                                                                            disabled={isCalculated}
                                                                            onChange={(e) => !isCalculated && handleObjectUpdate(m.work_id, 'general_docs', key, e.target.value)}
                                                                            className={`w-full text-sm border-gray-200 rounded-lg p-2 focus:ring-blue-500 ${isCalculated ? 'bg-gray-100 text-gray-500' : 'bg-white/50'}`}
                                                                            placeholder={isCalculated ? "Automático" : "-"}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Capex */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Capex</h4>
                                                        <div className="space-y-3 bg-white/40 p-4 rounded-xl border border-white/50">
                                                            {['Planned', 'Approved', 'Contracted'].map((field) => {
                                                                const key = field.toLowerCase();
                                                                return (
                                                                    <div key={key} className="flex justify-between items-center">
                                                                        <span className="text-sm text-gray-600">{field === 'Planned' ? 'Planejado' : field === 'Approved' ? 'Aprovado' : 'Contratado'}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-xs text-gray-400">R$</span>
                                                                            <input
                                                                                type="number"
                                                                                value={m.capex?.[key] || ""}
                                                                                onChange={(e) => handleObjectUpdate(m.work_id, 'capex', key, e.target.value)}
                                                                                className="w-32 text-sm border-gray-200 rounded p-1 text-right bg-white/80"
                                                                                placeholder="0,00"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {/* Saldo Calculado */}
                                                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                                                <span className="text-sm font-bold text-gray-800">Saldo</span>
                                                                <span className={`text-sm font-bold ${(Number(m.capex?.contracted || 0) - Number(m.capex?.approved || 0)) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                    R$ {(Number(m.capex?.contracted || 0) - Number(m.capex?.approved || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Diário de Obra Tab */}
                                        {cardTab === "daily" && (
                                            <div className="animate-fadeIn">
                                                <table className="w-full text-sm text-left">
                                                    <thead>
                                                        <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                                                            <th className="font-semibold py-2 px-4">Dia</th>
                                                            <th className="font-semibold py-2 px-2 text-center">Data</th>
                                                            <th className="font-semibold py-2 px-2 text-center">Efetivo</th>
                                                            <th className="font-semibold py-2 px-2 text-center">Tempo</th>
                                                            <th className="font-semibold py-2 px-2 text-center">Produção</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {m.daily_log?.map((item: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-white/50 transition-colors">
                                                                <td className="py-3 px-4 font-medium text-gray-700">{item.day}</td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <input type="date" value={item.date || ""} onChange={e => handleScheduleUpdate(m.work_id, 'daily', idx, 'date', e.target.value)} className="bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-xs text-gray-600" />
                                                                </td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <input type="number" value={item.effective || ""} onChange={e => handleScheduleUpdate(m.work_id, 'daily', idx, 'effective', e.target.value)} className="w-16 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-1 text-center text-sm" placeholder="0" />
                                                                </td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <select value={item.weather} onChange={e => handleScheduleUpdate(m.work_id, 'daily', idx, 'weather', e.target.value)} className="bg-transparent border border-transparent hover:border-gray-200 rounded cursor-pointer text-lg">
                                                                        <option value="☀️">☀️</option>
                                                                        <option value="☁️">☁️</option>
                                                                        <option value="☔️">☔️</option>
                                                                    </select>
                                                                </td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <select value={item.production} onChange={e => handleScheduleUpdate(m.work_id, 'daily', idx, 'production', e.target.value)} className="bg-transparent border border-transparent hover:border-gray-200 rounded cursor-pointer text-lg">
                                                                        <option value="✅">✅</option>
                                                                        <option value="❌">❌</option>
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Highlights Tab */}
                                        {cardTab === "highlights" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
                                                {['Special Attention', 'Action Plans', 'Relevant Activities', 'Observations'].map((field) => {
                                                    const key = field.toLowerCase().replace(/ /g, '_');
                                                    const label = field === 'Special Attention' ? 'Atenções Especiais' :
                                                        field === 'Action Plans' ? 'Planos de Ação' :
                                                            field === 'Relevant Activities' ? 'Atividades Relevantes' : 'Observações';
                                                    return (
                                                        <div key={key}>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</h4>
                                                            <textarea
                                                                rows={4}
                                                                value={m.highlights?.[key] || ""}
                                                                onChange={(e) => handleObjectUpdate(m.work_id, 'highlights', key, e.target.value)}
                                                                className="w-full text-sm border-gray-200 rounded-lg p-3 bg-white/50 focus:ring-blue-500 focus:border-blue-500 resize-none shadow-sm"
                                                                placeholder="Digite aqui..."
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Occurrences Tab */}
                                        {cardTab === "occurrences" && (
                                            <div className="animate-fadeIn">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Histórico de Ocorrências</h4>
                                                    <button
                                                        onClick={() => {
                                                            setOccurrenceForm({ id: '', work_id: m.work_id, date: new Date().toISOString().split('T')[0], description: '', type: 'Atividade', status: 'Active' });
                                                            setIsOccurrenceModalOpen(true);
                                                        }}
                                                        className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                                                        Nova Ocorrência
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead>
                                                            <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                                                                <th className="font-semibold py-2 px-4">Data</th>
                                                                <th className="font-semibold py-2 px-4">Tipo</th>
                                                                <th className="font-semibold py-2 px-4">Descrição</th>
                                                                <th className="font-semibold py-2 px-4 text-right">Ações</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {occurrences.filter((o: any) => o.work_id === m.work_id).length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={4} className="py-4 text-center text-gray-400 italic">Nenhuma ocorrência registrada.</td>
                                                                </tr>
                                                            ) : (
                                                                occurrences.filter((o: any) => o.work_id === m.work_id).map((occ: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-white/50 transition-colors group">
                                                                        <td className="py-2 px-4 whitespace-nowrap text-gray-600">{formatDate(occ.date)}</td>
                                                                        <td className="py-2 px-4 whitespace-nowrap">
                                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${occ.type === 'Fato Relevante' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                {occ.type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 px-4 text-gray-700">{occ.description}</td>
                                                                        <td className="py-2 px-4 text-right">
                                                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button onClick={() => { setOccurrenceForm(occ); setIsOccurrenceModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600">
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                                                </button>
                                                                                <button onClick={() => handleDeleteOccurrence(occ.id)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600">
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Sidebar */}
            <div className="fixed right-8 top-32 flex flex-col gap-6 w-72 z-20">
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ações</h3>
                    <button
                        onClick={() => handleButtonClick("Nova Gestão")}
                        className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            Nova Gestão
                        </div>
                    </button>
                    <button
                        onClick={() => setToast({ message: "Em breve!", type: "success" })}
                        className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                            Novo RDO
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setOccurrenceForm({ id: '', work_id: '', date: new Date().toISOString().split('T')[0], description: '', type: 'Atividade', status: 'Active' });
                            setIsOccurrenceModalOpen(true);
                        }}
                        className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-yellow-100 rounded-lg text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                </svg>
                            </div>
                            Nova Ocorrência
                        </div>
                    </button>
                </div>

                {/* Filters Section */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filtros</h3>

                    {/* Text Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="w-full rounded-xl border-gray-200 bg-white/50 text-sm pl-9 pr-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 absolute left-3 top-2.5">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                    </div>

                    {/* Regional Dropdown */}
                    <select
                        value={filterRegional}
                        onChange={(e) => setFilterRegional(e.target.value)}
                        className="w-full rounded-xl border-gray-200 bg-white/50 text-sm py-2 px-3 focus:ring-blue-500"
                    >
                        <option value="">Todas Regionais</option>
                        {['RIMES', 'NONECO', 'SPCIL', 'SUL'].map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>

                    {/* Work Type Dropdown */}
                    <select
                        value={filterWorkType}
                        onChange={(e) => setFilterWorkType(e.target.value)}
                        className="w-full rounded-xl border-gray-200 bg-white/50 text-sm py-2 px-3 focus:ring-blue-500"
                    >
                        <option value="">Todos Tipos</option>
                        {['Retrofit', 'Expansão', 'Reforma', 'Obra Nova'].map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    {/* Date Filters */}
                    <div className="pt-2 border-t border-gray-200/50">
                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-2 block">Período</label>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button
                                onClick={() => setDateFilterType('all')}
                                className={`text-xs py-1.5 px-2 rounded-lg transition-colors ${dateFilterType === 'all' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-white/50 text-gray-600 hover:bg-white/80'}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setDateFilterType('today')}
                                className={`text-xs py-1.5 px-2 rounded-lg transition-colors ${dateFilterType === 'today' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-white/50 text-gray-600 hover:bg-white/80'}`}
                            >
                                Hoje
                            </button>
                            <button
                                onClick={() => setDateFilterType('week')}
                                className={`text-xs py-1.5 px-2 rounded-lg transition-colors ${dateFilterType === 'week' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-white/50 text-gray-600 hover:bg-white/80'}`}
                            >
                                Semana
                            </button>
                            <button
                                onClick={() => setDateFilterType('month')}
                                className={`text-xs py-1.5 px-2 rounded-lg transition-colors ${dateFilterType === 'month' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-white/50 text-gray-600 hover:bg-white/80'}`}
                            >
                                Mês
                            </button>
                        </div>
                        <button
                            onClick={() => setDateFilterType('custom')}
                            className={`w-full text-xs py-1.5 px-2 rounded-lg transition-colors mb-2 ${dateFilterType === 'custom' ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-white/50 text-gray-600 hover:bg-white/80'}`}
                        >
                            Personalizado
                        </button>

                        {dateFilterType === 'custom' && (
                            <div className="space-y-2 animate-fadeIn">
                                <input
                                    type="date"
                                    value={customDateStart}
                                    onChange={(e) => setCustomDateStart(e.target.value)}
                                    className="w-full text-xs border-gray-200 rounded-lg p-1.5 bg-white/50"
                                    placeholder="Início"
                                />
                                <input
                                    type="date"
                                    value={customDateEnd}
                                    onChange={(e) => setCustomDateEnd(e.target.value)}
                                    className="w-full text-xs border-gray-200 rounded-lg p-1.5 bg-white/50"
                                    placeholder="Fim (Opcional)"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalType} width="800px">
                <div className="space-y-6">
                    {/* Work Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Selecione a Obra</label>
                        <select
                            value={selectedWorkId}
                            onChange={(e) => setSelectedWorkId(e.target.value)}
                            className="block w-full rounded-xl border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 ring-1 ring-gray-200"
                        >
                            <option value="">Selecione...</option>
                            {works.map(w => (
                                <option key={w.id} value={w.id}>{w.id} - {w.regional}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tabs Header */}
                    <div className="flex border-b border-gray-200">
                        {["Informações Gerais", "Obras Proprietário", "Licenças", "Termômetro", "Equipe"].map((tab, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === idx
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="pt-2">
                        {/* Tab 0: General Info */}
                        {activeTab === 0 && (
                            <div className="space-y-4 animate-fadeIn">
                                {selectedWork ? (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Regional</p>
                                            <p className="font-medium text-gray-800 text-xs">{selectedWork.regional}</p>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Data GoLive</p>
                                            <p className="font-medium text-gray-800 text-xs">{formatDate(selectedWork.go_live_date)}</p>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Tipo da Obra</p>
                                            <p className="font-medium text-gray-800 text-xs">{selectedWork.work_type}</p>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 col-span-3">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Endereço</p>
                                            <p className="font-medium text-gray-800 text-xs">
                                                {selectedWork.address?.street}, {selectedWork.address?.number}
                                                {selectedWork.address?.complement ? ` - ${selectedWork.address.complement}` : ''}
                                                <br />
                                                {selectedWork.address?.neighborhood} - {selectedWork.address?.city}/{selectedWork.address?.state}
                                            </p>
                                        </div>

                                        {/* New Editable Fields - Compacted */}
                                        <div className="col-span-3 pt-2 border-t border-gray-100 mt-2">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Informações Complementares</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Operador</label>
                                                    <input
                                                        type="text"
                                                        value={operator}
                                                        onChange={(e) => setOperator(e.target.value)}
                                                        className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5"
                                                        placeholder="Digite o operador"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Tamanho (m²)</label>
                                                    <input
                                                        type="text"
                                                        value={sizeM2}
                                                        onChange={(e) => setSizeM2(e.target.value)}
                                                        className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Tamanho Piso (m²)</label>
                                                    <input
                                                        type="text"
                                                        value={floorSizeM2}
                                                        onChange={(e) => setFloorSizeM2(e.target.value)}
                                                        className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-8">Selecione uma obra acima para visualizar as informações.</p>
                                )}
                            </div>
                        )}

                        {/* Tab 1: Owner Works */}
                        {activeTab === 1 && (
                            <div className="space-y-3 animate-fadeIn">
                                {selectedWork ? (
                                    ownerWorks.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white/40 p-2 rounded-lg border border-gray-100">
                                            <span className="flex-1 text-sm font-medium text-gray-700">{item.name}</span>
                                            <input
                                                type="date"
                                                value={item.date}
                                                onChange={(e) => updateItem('owner', idx, 'date', e.target.value)}
                                                className="text-xs border-gray-200 rounded-lg p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            <StatusDropdown
                                                value={item.status}
                                                onChange={(val) => updateItem('owner', idx, 'status', val)}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-8">Selecione uma obra primeiro.</p>
                                )}
                            </div>
                        )}

                        {/* Tab 2: Licenses */}
                        {activeTab === 2 && (
                            <div className="space-y-3 animate-fadeIn">
                                {selectedWork ? (
                                    licenses.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white/40 p-2 rounded-lg border border-gray-100">
                                            <span className="flex-1 text-sm font-medium text-gray-700">{item.name}</span>
                                            <input
                                                type="date"
                                                value={item.date}
                                                onChange={(e) => updateItem('license', idx, 'date', e.target.value)}
                                                className="text-xs border-gray-200 rounded-lg p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            <StatusDropdown
                                                value={item.status}
                                                onChange={(val) => updateItem('license', idx, 'status', val)}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-8">Selecione uma obra primeiro.</p>
                                )}
                            </div>
                        )}

                        {/* Tab 3: Thermometer */}
                        {activeTab === 3 && (
                            <div className="space-y-3 animate-fadeIn">
                                {selectedWork ? (
                                    thermometer.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white/40 p-2 rounded-lg border border-gray-100">
                                            <span className="flex-1 text-sm font-medium text-gray-700">{item.name}</span>
                                            <StatusDropdown
                                                value={item.status}
                                                onChange={(val) => updateItem('thermo', idx, 'status', val)}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-8">Selecione uma obra primeiro.</p>
                                )}
                            </div>
                        )}

                        {/* Tab 4: Equipe */}
                        {activeTab === 4 && (
                            <div className="space-y-4 animate-fadeIn">
                                {selectedWork ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Control Tower</label>
                                            <select
                                                value={controlTower}
                                                onChange={(e) => setControlTower(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-2"
                                            >
                                                <option value="">Selecione...</option>
                                                {teamMembers.filter(m => m.role === 'Control Tower').map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Engenheiro</label>
                                            <select
                                                value={engineer}
                                                onChange={(e) => setEngineer(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-2"
                                            >
                                                <option value="">Selecione...</option>
                                                {teamMembers.filter(m => m.role === 'Engenheiro').map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Coordenador</label>
                                            <select
                                                value={coordinator}
                                                onChange={(e) => setCoordinator(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-2"
                                            >
                                                <option value="">Selecione...</option>
                                                {teamMembers.filter(m => m.role === 'Coordenador').map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PM</label>
                                            <select
                                                value={pm}
                                                onChange={(e) => setPm(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-2"
                                            >
                                                <option value="">Selecione...</option>
                                                {teamMembers.filter(m => m.role === 'PM').map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CM</label>
                                            <select
                                                value={cm}
                                                onChange={(e) => setCm(e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 text-xs p-2"
                                            >
                                                <option value="">Selecione...</option>
                                                {teamMembers.filter(m => m.role === 'CM').map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-8">Selecione uma obra primeiro.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end pt-4 border-t border-gray-100 gap-3">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveManagement}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all"
                        >
                            Salvar Gestão
                        </button>
                    </div>
                </div>
            </Modal>
            {/* Occurrence Modal */}
            <Modal
                isOpen={isOccurrenceModalOpen}
                onClose={() => setIsOccurrenceModalOpen(false)}
                title={occurrenceForm.id ? "Editar Ocorrência" : "Nova Ocorrência"}
                width="500px"
            >
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                        <input
                            type="date"
                            value={occurrenceForm.date}
                            onChange={(e) => setOccurrenceForm({ ...occurrenceForm, date: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                        <select
                            value={occurrenceForm.type}
                            onChange={(e) => setOccurrenceForm({ ...occurrenceForm, type: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="Atividade">Atividade</option>
                            <option value="Fato Relevante">Fato Relevante</option>
                            <option value="Impedimento">Impedimento</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                        <textarea
                            value={occurrenceForm.description}
                            onChange={(e) => setOccurrenceForm({ ...occurrenceForm, description: e.target.value })}
                            rows={3}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            placeholder="Descreva a ocorrência..."
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button
                            onClick={() => setIsOccurrenceModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveOccurrence}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
