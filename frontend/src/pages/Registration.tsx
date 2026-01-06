import { useState, useEffect, useCallback } from "react";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { getAuthToken } from "../firebase";
import {
    type AddressData,
    type RegistrationWork,
    type RegistrationEvent,
    type RegistrationSupplier,
    type RegistrationTeam,
    type RegistrationItem
} from "../types/Registration";
import RegistrationTable from "../components/RegistrationTable";
import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/Pagination";

export default function Registration() {
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState("");
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [isLoading, setIsLoading] = useState(true);

    // Validation State
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Data State
    const [works, setWorks] = useState<RegistrationItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<"Obra" | "Evento" | "Fornecedor" | "Equipe" | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);



    // Form Stats - General
    const [workId, setWorkId] = useState("");
    const [editingWorkId, setEditingWorkId] = useState<string | null>(null); // For tracking edits

    // Works Form
    const [regional, setRegional] = useState("");
    const [goLiveDate, setGoLiveDate] = useState("");
    const [cep, setCep] = useState("");
    const [address, setAddress] = useState<AddressData | null>(null);
    const [addressNumber, setAddressNumber] = useState("");
    const [complement, setComplement] = useState("");
    const [workType, setWorkType] = useState("");
    const [cnpj, setCnpj] = useState("");
    const [businessCase, setBusinessCase] = useState("");
    const [capex, setCapex] = useState("");
    const [internalOrder, setInternalOrder] = useState("");
    const [oi, setOi] = useState("");

    // Events Form
    const [eventDescription, setEventDescription] = useState("");
    const [eventType, setEventType] = useState("Novo");
    const [eventSla, setEventSla] = useState("");

    // Suppliers Form
    const [supplierSocialReason, setSupplierSocialReason] = useState("");
    const [supplierCnpj, setSupplierCnpj] = useState("");
    const [supplierContractStart, setSupplierContractStart] = useState("");
    const [supplierContractEnd, setSupplierContractEnd] = useState("");
    const [supplierProject, setSupplierProject] = useState("");
    const [supplierHiringType, setSupplierHiringType] = useState("");
    const [supplierHeadquarters, setSupplierHeadquarters] = useState("");
    const [supplierLegalRep, setSupplierLegalRep] = useState("");
    const [supplierRepEmail, setSupplierRepEmail] = useState("");
    const [supplierContact, setSupplierContact] = useState("");
    const [supplierWitness, setSupplierWitness] = useState("");
    const [supplierWitnessEmail, setSupplierWitnessEmail] = useState("");
    const [supplierObs, setSupplierObs] = useState("");

    // Team Form
    const [teamName, setTeamName] = useState("");
    const [teamRole, setTeamRole] = useState("Engenheiro");

    const fetchWorks = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getAuthToken();
            const headers = { Authorization: `Bearer ${token}` };

            const [worksRes, eventsRes, suppliersRes, teamRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/works?limit=1000`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/events`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/suppliers`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/team`, { headers })
            ]);

            const worksData: RegistrationWork[] = worksRes.ok ? await worksRes.json() : [];
            const eventsData: RegistrationEvent[] = eventsRes.ok ? await eventsRes.json() : [];
            const suppliersData: RegistrationSupplier[] = suppliersRes.ok ? await suppliersRes.json() : [];
            const teamData: RegistrationTeam[] = teamRes.ok ? await teamRes.json() : [];

            const allItems: RegistrationItem[] = [
                ...worksData.map(i => ({ ...i, itemType: "Obra" as const })),
                ...eventsData.map(i => ({ ...i, itemType: "Evento" as const })),
                ...suppliersData.map(i => ({ ...i, itemType: "Fornecedor" as const })),
                ...teamData.map(i => ({ ...i, itemType: "Equipe" as const }))
            ];

            setWorks(allItems);
        } catch (error) {
            console.error("Error fetching data:", error);
            setToast({ message: "Erro ao carregar dados.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorks();
    }, [fetchWorks]);

    // Validation Logic


    const clearError = (name: string) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (modalType === "Cadastrar Obra") {
            if (!workId) newErrors.workId = "ID é obrigatório";
            if (!regional) newErrors.regional = "Regional é obrigatória";
            if (!goLiveDate) newErrors.goLiveDate = "Data é obrigatória";
            if (!workType) newErrors.workType = "Tipo é obrigatório";
            if (!cnpj || cnpj.length < 18) newErrors.cnpj = "CNPJ inválido";
            if (!cep) newErrors.cep = "CEP é obrigatório";
            if (!addressNumber) newErrors.addressNumber = "Número é obrigatório";
        } else if (modalType === "Cadastrar Evento") {
            if (!workId) newErrors.workId = "Work ID é obrigatório";
            if (!eventDescription) newErrors.eventDescription = "Descrição é obrigatória";
        } else if (modalType === "Cadastrar Fornecedor") {
            if (!workId) newErrors.workId = "Ref Obra é obrigatória";
            if (!supplierCnpj || supplierCnpj.length < 18) newErrors.supplierCnpj = "CNPJ inválido";
            if (!supplierSocialReason) newErrors.supplierSocialReason = "Razão Social é obrigatória";
        } else if (modalType === "Cadastrar Equipe") {
            if (!workId) newErrors.workId = "Ref Obra é obrigatória";
            if (!teamName) newErrors.teamName = "Nome é obrigatório";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Formatters
    const formatCurrency = (value: string) => {
        const numericValue = value.replace(/\D/g, "");
        const formatted = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(parseFloat(numericValue) / 100);
        return formatted === "NaN" ? "" : formatted;
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
        setter(formatCurrency(e.target.value));
    };

    const formatCNPJ = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2")
            .substr(0, 18);
    };

    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = formatCNPJ(e.target.value);
        setCnpj(val);
        if (val.length === 18) clearError("cnpj");
    };

    const handleSupplierCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = formatCNPJ(e.target.value);
        setSupplierCnpj(val);
        if (val.length === 18) clearError("supplierCnpj");
    };


    const handleCepBlur = async () => {
        if (cep.length === 8 || cep.length === 9) {
            setIsSearchingCep(true);
            try {
                const cleanCep = cep.replace(/\D/g, "");
                const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setAddress({
                        street: data.logradouro,
                        neighborhood: data.bairro,
                        city: data.localidade,
                        state: data.uf
                    });
                    clearError("cep");
                } else {
                    setToast({ message: "CEP não encontrado.", type: "error" });
                    setErrors(prev => ({ ...prev, cep: "CEP não encontrado" }));
                }
            } catch (error) {
                console.error("Error fetching CEP:", error);
                setToast({ message: "Erro ao buscar CEP.", type: "error" });
            } finally {
                setIsSearchingCep(false);
            }
        }
    };

    const resetForm = () => {
        setWorkId("");
        setRegional("");
        setGoLiveDate("");
        setCep("");
        setAddress(null);
        setAddressNumber("");
        setComplement("");
        setWorkType("");
        setCnpj("");
        setBusinessCase("");
        setCapex("");
        setInternalOrder("");
        setOi("");
        setEventDescription("");
        setEventType("Novo");
        setEventSla("");
        setSupplierSocialReason("");
        setSupplierCnpj("");
        setSupplierContractStart("");
        setSupplierContractEnd("");
        setSupplierProject("");
        setSupplierHiringType("");
        setSupplierHeadquarters("");
        setSupplierLegalRep("");
        setSupplierRepEmail("");
        setSupplierContact("");
        setSupplierWitness("");
        setSupplierWitnessEmail("");
        setSupplierObs("");
        setTeamName("");
        setTeamRole("Engenheiro");
        setEditingWorkId(null);
        setErrors({});
    };

    const handleOpenModal = (type: string, item?: RegistrationItem) => {
        setModalType(type);
        setIsModalOpen(true);
        resetForm();

        if (item) {
            setEditingWorkId(item.id);
            setWorkId(item.id);

            if (item.itemType === "Obra") {
                const work = item as RegistrationWork;
                setRegional(work.regional || "");
                setGoLiveDate(work.go_live_date || "");
                setCep(work.cep || "");
                if (work.address) {
                    setAddress({
                        street: work.address.street,
                        neighborhood: work.address.neighborhood,
                        city: work.address.city,
                        state: work.address.state
                    });
                    setAddressNumber(work.address.number || "");
                    setComplement(work.address.complement || "");
                }
                setWorkType(work.work_type || "");
                setCnpj(work.cnpj || "");
                setBusinessCase(work.business_case || "");
                setCapex(work.capex_approved || "");
                setInternalOrder(work.internal_order || "");
                setOi(work.oi || "");
            } else if (item.itemType === "Evento") {
                const event = item as RegistrationEvent;
                setEventDescription(event.description || "");
                setEventType(event.type || "Novo");
                setEventSla(event.sla ? String(event.sla) : "");
            } else if (item.itemType === "Fornecedor") {
                const supplier = item as RegistrationSupplier;
                setSupplierSocialReason(supplier.social_reason || "");
                setSupplierCnpj(supplier.cnpj || "");
                setSupplierContractStart(supplier.contract_start || "");
                setSupplierContractEnd(supplier.contract_end || "");
                setSupplierProject(supplier.project || "");
                setSupplierHiringType(supplier.hiring_type || "");
                setSupplierHeadquarters(supplier.headquarters || "");
                setSupplierLegalRep(supplier.legal_representative || "");
                setSupplierRepEmail(supplier.representative_email || "");
                setSupplierContact(supplier.contact || "");
                setSupplierWitness(supplier.witness || "");
                setSupplierWitnessEmail(supplier.witness_email || "");
                setSupplierObs(supplier.observations || "");
            } else if (item.itemType === "Equipe") {
                const team = item as RegistrationTeam;
                setTeamName(team.name || "");
                setTeamRole(team.role || "Engenheiro");
            }
        }
    };

    const handleSave = async () => {
        if (!validateForm()) {
            setToast({ message: "Verifique os erros no formulário.", type: "error" });
            return;
        }

        setIsSaving(true);
        try {
            const token = await getAuthToken();
            let endpoint = "";
            let payload: Partial<RegistrationWork | RegistrationEvent | RegistrationSupplier | RegistrationTeam> & { id: string } = { id: workId };

            if (modalType === "Cadastrar Obra") {
                const baseAddress = {
                    street: address?.street || "",
                    neighborhood: address?.neighborhood || "",
                    city: address?.city || "",
                    state: address?.state || ""
                };

                endpoint = "works";
                payload = {
                    id: workId,
                    regional,
                    go_live_date: goLiveDate,
                    cep,
                    address: { ...baseAddress, number: addressNumber, complement: complement || "" },
                    work_type: workType,
                    cnpj,
                    business_case: businessCase,
                    capex_approved: capex,
                    internal_order: internalOrder,
                    oi,
                };
            } else if (modalType === "Cadastrar Evento") {
                endpoint = "events";
                payload = {
                    id: workId,
                    description: eventDescription,
                    type: eventType,
                    sla: parseInt(eventSla) || 0
                };
            } else if (modalType === "Cadastrar Fornecedor") {
                endpoint = "suppliers";
                payload = {
                    id: workId,
                    social_reason: supplierSocialReason,
                    cnpj: supplierCnpj,
                    contract_start: supplierContractStart,
                    contract_end: supplierContractEnd,
                    project: supplierProject,
                    hiring_type: supplierHiringType,
                    headquarters: supplierHeadquarters,
                    legal_representative: supplierLegalRep,
                    representative_email: supplierRepEmail,
                    contact: supplierContact,
                    witness: supplierWitness,
                    witness_email: supplierWitnessEmail,
                    observations: supplierObs
                };
            } else if (modalType === "Cadastrar Equipe") {
                endpoint = "team";
                payload = {
                    id: workId,
                    name: teamName,
                    role: teamRole
                };
            }

            const method = editingWorkId ? "PUT" : "POST";
            const url = editingWorkId
                ? `${import.meta.env.VITE_API_BASE_URL}/${endpoint}/${editingWorkId}`
                : `${import.meta.env.VITE_API_BASE_URL}/${endpoint}`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Feature: Automate creation of Management and Planning for new Works
                if (modalType === "Cadastrar Obra" && !editingWorkId) {
                    try {
                        const managementPayload = {
                            work_id: workId,
                            operator: "",
                            engineer: "",
                            coordinator: "",
                            control_tower: ""
                        };
                        const planningPayload = {
                            work_id: workId,
                            status: "Draft",
                            data: {}
                        };

                        await Promise.all([
                            fetch(`${import.meta.env.VITE_API_BASE_URL}/managements`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify(managementPayload)
                            }),
                            fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify(planningPayload)
                            })
                        ]);
                        console.log("Auto-created Management and Planning for:", workId);
                    } catch (autoCreateError) {
                        console.error("Error auto-creating related items:", autoCreateError);
                    }
                }

                setToast({ message: "Salvo com sucesso!", type: "success" });
                setIsModalOpen(false);
                fetchWorks();
            } else {
                setToast({ message: "Erro ao salvar.", type: "error" });
            }
        } catch (error) {
            console.error("Error saving:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            const token = await getAuthToken();
            let endpoint = "";
            if (itemToDelete.type === "Obra") endpoint = "works";
            else if (itemToDelete.type === "Evento") endpoint = "events";
            else if (itemToDelete.type === "Fornecedor") endpoint = "suppliers";
            else if (itemToDelete.type === "Equipe") endpoint = "team";

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/${endpoint}/${itemToDelete.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                setToast({ message: "Item excluído.", type: "success" });
                setIsDeleteModalOpen(false);
                fetchWorks();
            } else {
                setToast({ message: "Erro ao excluir.", type: "error" });
            }
        } catch (error) {
            console.error("Error deleting:", error);
            setToast({ message: "Erro de conexão.", type: "error" });
        }
    };

    const handleDeleteClick = (item: RegistrationItem) => {
        setItemToDelete({ id: item.id, type: item.itemType });
        setIsDeleteModalOpen(true);
    };

    const filteredWorks = works.filter((item) => {
        const searchLower = searchTerm.toLowerCase();

        // Helper to check string fields safely
        const check = (val?: string) => (val || "").toLowerCase().includes(searchLower);

        const matchesSearch = searchTerm === "" ||
            item.id.toLowerCase().includes(searchLower) ||
            check(item.regional) ||
            (item.itemType === "Obra" && (
                check(item.address?.city) ||
                check(item.address?.neighborhood) ||
                check(item.work_type)
            )) ||
            (item.itemType === "Evento" && (
                check(item.description)
            )) ||
            (item.itemType === "Fornecedor" && (
                check(item.social_reason) ||
                check(item.name)
            )) ||
            (item.itemType === "Equipe" && (
                check(item.name)
            ));

        const matchesType = filterType === null || item.itemType === filterType;

        return matchesSearch && matchesType;
    });

    const paginatedWorks = filteredWorks.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const exportToCSV = () => {
        const headers = ["ID", "Tipo", "Detalhe", "Status"];
        const rows = filteredWorks.map(item => [
            item.id,
            item.itemType,
            item.itemType === 'Obra' ? (item as RegistrationWork).regional :
                item.itemType === 'Evento' ? (item as RegistrationEvent).description :
                    item.itemType === 'Fornecedor' ? (item as RegistrationSupplier).social_reason :
                        (item as RegistrationTeam).name,
            "Ativo" // Placeholder
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "cadastros_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleInlineUpdate = async (id: string, type: string, field: string, value: string) => {
        console.log(`Updating ${type} ${id}: ${field} = ${value}`);
        // In a real implementation, this would call the API.
        // For now, we simulate success to demonstrate the UI.
        setToast({ message: "Atualização rápida simulada!", type: "success" });
        // Refetch to reflect changes if API was called
        // fetchWorks();
    };

    const getInputClass = (error?: string) => `mt-1 block w-full rounded-md border text-xs p-2 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50" : "border-gray-300 focus:border-blue-500 bg-white/50"
        }`;

    return (
        <div className="relative min-h-full w-full">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Main Content */}
            <div className="mr-80 px-8 py-8 w-auto mx-0">
                {/* Visual View Toggle & Actions */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex bg-white/50 rounded-lg p-1 shadow-sm border border-gray-100">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                            </svg>
                        </button>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-xs font-semibold"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Exportar CSV
                    </button>
                </div>

                {isLoading ? (
                    <LoadingSpinner fullScreen={false} />
                ) : viewMode === "list" ? (
                    <div className="flex flex-col gap-6">
                        <RegistrationTable
                            items={paginatedWorks}
                            onEdit={(item) => handleOpenModal(`Cadastrar ${item.itemType}`, item)}
                            onDelete={handleDeleteClick}
                            onInlineUpdate={handleInlineUpdate}
                        />
                        <Pagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredWorks.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                            totalItems={filteredWorks.length}
                            itemsPerPage={itemsPerPage}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 pb-20">
                        <div className="grid grid-cols-1 gap-4">
                            {paginatedWorks.map((item, index) => (
                                <div key={`${item.id}-${index}`} className="relative overflow-hidden rounded-xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-sm p-4 transition-all hover:bg-white/50 group">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${item.itemType === 'Obra' ? 'bg-blue-100 text-blue-700' :
                                                item.itemType === 'Evento' ? 'bg-purple-100 text-purple-700' :
                                                    item.itemType === 'Fornecedor' ? 'bg-green-100 text-green-700' :
                                                        'bg-orange-100 text-orange-700'
                                                }`}>
                                                {item.itemType}
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900">{item.id}</h3>
                                                <p className="text-xs text-gray-500">
                                                    {item.itemType === 'Obra' && (item.regional || item.address?.city)}
                                                    {item.itemType === 'Evento' && item.description}
                                                    {item.itemType === 'Fornecedor' && item.social_reason}
                                                    {item.itemType === 'Equipe' && item.role}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(`Cadastrar ${item.itemType}`, item)}
                                                className="p-1.5 rounded-lg bg-white/50 hover:bg-blue-50 text-blue-600 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(item)}
                                                className="p-1.5 rounded-lg bg-white/50 hover:bg-red-50 text-red-600 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredWorks.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                            totalItems={filteredWorks.length}
                            itemsPerPage={itemsPerPage}
                        />
                        {filteredWorks.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                Nenhum item encontrado.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sidebar */}
            <div className="fixed right-8 top-32 flex flex-col gap-6 w-64 z-10">
                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl">
                    <h3 className="text-sm font-bold text-gray-700 px-2 mb-1 uppercase tracking-wider">Novo Cadastro</h3>
                    <button onClick={() => handleOpenModal("Cadastrar Obra")} className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group">
                        Obra
                        <span className="text-blue-600 font-bold text-lg">+</span>
                    </button>
                    <button onClick={() => handleOpenModal("Cadastrar Evento")} className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group">
                        Evento
                        <span className="text-purple-600 font-bold text-lg">+</span>
                    </button>
                    <button onClick={() => handleOpenModal("Cadastrar Fornecedor")} className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group">
                        Fornecedor
                        <span className="text-green-600 font-bold text-lg">+</span>
                    </button>
                    <button onClick={() => handleOpenModal("Cadastrar Equipe")} className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group">
                        Equipe
                        <span className="text-orange-600 font-bold text-lg">+</span>
                    </button>
                </div>

                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl">
                    <h3 className="text-sm font-bold text-gray-700 px-2 mb-1 uppercase tracking-wider">Filtros</h3>
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full rounded-xl bg-white/80 pl-4 pr-10 py-3 text-sm font-medium text-gray-900 shadow-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-500" />
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setFilterType(filterType === "Obra" ? null : "Obra")} className={`text-xs p-2 rounded-lg font-medium transition-colors ${filterType === "Obra" ? "bg-blue-500 text-white" : "bg-white/60 text-gray-600 hover:bg-white"}`}>Obra</button>
                        <button onClick={() => setFilterType(filterType === "Evento" ? null : "Evento")} className={`text-xs p-2 rounded-lg font-medium transition-colors ${filterType === "Evento" ? "bg-purple-500 text-white" : "bg-white/60 text-gray-600 hover:bg-white"}`}>Evento</button>
                        <button onClick={() => setFilterType(filterType === "Fornecedor" ? null : "Fornecedor")} className={`text-xs p-2 rounded-lg font-medium transition-colors ${filterType === "Fornecedor" ? "bg-green-500 text-white" : "bg-white/60 text-gray-600 hover:bg-white"}`}>Fornecedor</button>
                        <button onClick={() => setFilterType(filterType === "Equipe" ? null : "Equipe")} className={`text-xs p-2 rounded-lg font-medium transition-colors ${filterType === "Equipe" ? "bg-orange-500 text-white" : "bg-white/60 text-gray-600 hover:bg-white"}`}>Equipe</button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalType}>
                {modalType === "Cadastrar Obra" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Work ID</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => {
                                        setWorkId(e.target.value);
                                        clearError("workId");
                                    }}
                                    disabled={!!editingWorkId}
                                    className={getInputClass(errors.workId)}
                                    placeholder="Ex: RJ-001"
                                />
                                {errors.workId && <p className="text-xs text-red-500 mt-1">{errors.workId}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Regional</label>
                                <select
                                    value={regional}
                                    onChange={(e) => {
                                        setRegional(e.target.value);
                                        clearError("regional");
                                    }}
                                    className={getInputClass(errors.regional)}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Rimes">Rimes</option>
                                    <option value="Noneco">Noneco</option>
                                    <option value="SPCIL">SPCIL</option>
                                    <option value="Sul">Sul</option>
                                </select>
                                {errors.regional && <p className="text-xs text-red-500 mt-1">{errors.regional}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Data GoLive</label>
                                <input
                                    type="date"
                                    value={goLiveDate}
                                    onChange={(e) => {
                                        setGoLiveDate(e.target.value);
                                        clearError("goLiveDate");
                                    }}
                                    className={getInputClass(errors.goLiveDate)}
                                />
                                {errors.goLiveDate && <p className="text-xs text-red-500 mt-1">{errors.goLiveDate}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Work Type</label>
                                <select
                                    value={workType}
                                    onChange={(e) => {
                                        setWorkType(e.target.value);
                                        clearError("workType");
                                    }}
                                    className={getInputClass(errors.workType)}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Moving">Moving</option>
                                    <option value="Expansão">Expansão</option>
                                    <option value="Startup">Startup</option>
                                </select>
                                {errors.workType && <p className="text-xs text-red-500 mt-1">{errors.workType}</p>}
                            </div>
                        </div>
                        {/* Address Fields */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">CEP</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={cep}
                                        onChange={(e) => {
                                            setCep(e.target.value);
                                            clearError("cep");
                                        }}
                                        onBlur={handleCepBlur}
                                        className={`${getInputClass(errors.cep)} ${isSearchingCep ? "pr-8" : ""}`}
                                        placeholder="00000-000"
                                    />
                                    {isSearchingCep && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <svg className="animate-spin h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {errors.cep && <p className="text-xs text-red-500 mt-1">{errors.cep}</p>}
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-700">Rua</label>
                                <input type="text" value={address?.street || ""} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm text-xs p-2 ring-1 ring-gray-200" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Número</label>
                                <input
                                    type="text"
                                    value={addressNumber}
                                    onChange={(e) => {
                                        setAddressNumber(e.target.value);
                                        clearError("addressNumber");
                                    }}
                                    className={getInputClass(errors.addressNumber)}
                                    placeholder="N/A"
                                />
                                {errors.addressNumber && <p className="text-xs text-red-500 mt-1">{errors.addressNumber}</p>}
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-700">Complemento</label>
                                <input type="text" value={complement} onChange={(e) => setComplement(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200" placeholder="Apto, Bloco..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Bairro</label>
                                <input type="text" value={address?.neighborhood || ""} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm text-xs p-2 ring-1 ring-gray-200" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Cidade/UF</label>
                                <input type="text" value={address ? `${address.city}/${address.state}` : ""} disabled className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm text-xs p-2 ring-1 ring-gray-200" />
                            </div>
                        </div>

                        {/* Financials */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Business Case</label>
                                <input type="text" value={businessCase} onChange={(e) => handleCurrencyChange(e, setBusinessCase)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200" placeholder="R$ 0,00" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">OI</label>
                                <input type="text" value={oi} onChange={(e) => setOi(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200" placeholder="OI" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Capex</label>
                                <input type="text" value={capex} onChange={(e) => handleCurrencyChange(e, setCapex)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200" placeholder="R$ 0,00" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">CNPJ</label>
                                <input
                                    type="text"
                                    value={cnpj}
                                    onChange={handleCnpjChange}
                                    className={getInputClass(errors.cnpj)}
                                    placeholder="00.000.000/0000-00"
                                    maxLength={18}
                                />
                                {errors.cnpj && <p className="text-xs text-red-500 mt-1">{errors.cnpj}</p>}
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancelar</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Salvando...
                                    </>
                                ) : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Evento" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Work ID (Ref)</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => {
                                        setWorkId(e.target.value);
                                        clearError("workId");
                                    }}
                                    disabled={!!editingWorkId}
                                    className={getInputClass(errors.workId)}
                                    placeholder="ID da Obra Relacionada"
                                />
                                {errors.workId && <p className="text-xs text-red-500 mt-1">{errors.workId}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">SLA (dias)</label>
                                <input type="number" value={eventSla} onChange={(e) => setEventSla(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200" placeholder="0" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Tipo</label>
                            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200">
                                <option value="Novo">Novo</option>
                                <option value="Backlog">Backlog</option>
                                <option value="Acompanhamento">Acompanhamento</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Descrição</label>
                            <textarea
                                value={eventDescription}
                                onChange={(e) => {
                                    setEventDescription(e.target.value);
                                    clearError("eventDescription");
                                }}
                                className={getInputClass(errors.eventDescription)}
                                rows={3}
                            ></textarea>
                            {errors.eventDescription && <p className="text-xs text-red-500 mt-1">{errors.eventDescription}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancelar</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Fornecedor" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Work ID (Ref)</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => {
                                        setWorkId(e.target.value);
                                        clearError("workId");
                                    }}
                                    disabled={!!editingWorkId}
                                    className={getInputClass(errors.workId)}
                                    placeholder="Ref Obra"
                                />
                                {errors.workId && <p className="text-xs text-red-500 mt-1">{errors.workId}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">CNPJ</label>
                                <input
                                    type="text"
                                    value={supplierCnpj}
                                    onChange={handleSupplierCnpjChange}
                                    className={getInputClass(errors.supplierCnpj)}
                                    placeholder="00.000.000/0000-00"
                                    maxLength={18}
                                />
                                {errors.supplierCnpj && <p className="text-xs text-red-500 mt-1">{errors.supplierCnpj}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Razão Social</label>
                            <input
                                type="text"
                                value={supplierSocialReason}
                                onChange={(e) => {
                                    setSupplierSocialReason(e.target.value);
                                    clearError("supplierSocialReason");
                                }}
                                className={getInputClass(errors.supplierSocialReason)}
                            />
                            {errors.supplierSocialReason && <p className="text-xs text-red-500 mt-1">{errors.supplierSocialReason}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-medium text-gray-700">Início Contrato</label><input type="date" value={supplierContractStart} onChange={(e) => setSupplierContractStart(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-xs p-2" /></div>
                            <div><label className="block text-xs font-medium text-gray-700">Fim Contrato</label><input type="date" value={supplierContractEnd} onChange={(e) => setSupplierContractEnd(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 text-xs p-2" /></div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancelar</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Equipe" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Work ID (Ref)</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => {
                                        setWorkId(e.target.value);
                                        clearError("workId");
                                    }}
                                    disabled={!!editingWorkId}
                                    className={getInputClass(errors.workId)}
                                />
                                {errors.workId && <p className="text-xs text-red-500 mt-1">{errors.workId}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Função</label>
                                <select value={teamRole} onChange={(e) => setTeamRole(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200">
                                    <option value="Engenheiro">Engenheiro</option>
                                    <option value="Control Tower">Control Tower</option>
                                    <option value="Planejamento">Planejamento</option>
                                    <option value="Coordenador">Coordenador</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Nome</label>
                            <input
                                type="text"
                                value={teamName}
                                onChange={(e) => {
                                    setTeamName(e.target.value);
                                    clearError("teamName");
                                }}
                                className={getInputClass(errors.teamName)}
                            />
                            {errors.teamName && <p className="text-xs text-red-500 mt-1">{errors.teamName}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">Cancelar</button>
                            <button type="button" onClick={handleSave} disabled={isSaving} className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title={`Excluir ${itemToDelete?.type}`}>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir o item <span className="font-bold text-gray-900">{itemToDelete?.id}</span>?
                        <br /><span className="text-xs text-red-500">Essa ação não pode ser desfeita.</span>
                    </p>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
                        <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm">Excluir</button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
