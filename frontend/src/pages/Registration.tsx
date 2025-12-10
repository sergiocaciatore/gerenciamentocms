import { useState, useEffect } from "react";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { getAuthToken } from "../firebase";


interface AddressData {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
}

export default function Registration() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState("");
    const [cep, setCep] = useState("");
    const [address, setAddress] = useState<AddressData | null>(null);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [cnpj, setCnpj] = useState("");
    const [businessCase, setBusinessCase] = useState("");
    const [capex, setCapex] = useState("");

    // New state variables for form fields
    const [workId, setWorkId] = useState("");
    const [regional, setRegional] = useState("Rimes");
    const [goLiveDate, setGoLiveDate] = useState("");
    const [addressNumber, setAddressNumber] = useState("");
    const [complement, setComplement] = useState("");
    const [workType, setWorkType] = useState("Moving");
    const [internalOrder, setInternalOrder] = useState("");

    // Event State
    const [eventDescription, setEventDescription] = useState("");
    const [eventType, setEventType] = useState("Novo");
    const [eventSla, setEventSla] = useState("");

    // Supplier State
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

    // Team State
    const [teamName, setTeamName] = useState("");
    const [teamRole, setTeamRole] = useState("Engenheiro");

    // Edit State
    const [editingWorkId, setEditingWorkId] = useState<string | null>(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string | null>(null);

    // UX States
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [works, setWorks] = useState<any[]>([]);

    useEffect(() => {
        fetchWorks();
    }, []);

    const fetchWorks = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            const [worksRes, eventsRes, suppliersRes, teamRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/events`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/suppliers`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/team`, { headers })
            ]);

            const worksData = worksRes.ok ? await worksRes.json() : [];
            const eventsData = eventsRes.ok ? await eventsRes.json() : [];
            const suppliersData = suppliersRes.ok ? await suppliersRes.json() : [];
            const teamData = teamRes.ok ? await teamRes.json() : [];

            // Tag data with type
            const allItems = [
                ...worksData.map((i: any) => ({ ...i, itemType: "Obra" })),
                ...eventsData.map((i: any) => ({ ...i, itemType: "Evento" })),
                ...suppliersData.map((i: any) => ({ ...i, itemType: "Fornecedor" })),
                ...teamData.map((i: any) => ({ ...i, itemType: "Equipe" })) // Mapping "Equipe" to filter type if needed, or just display
            ];

            setWorks(allItems);
        } catch (error) {
            console.error("Erro ao buscar dados:", error);
            setToast({ message: "Erro ao carregar dados.", type: "error" });
        }
    };



    const formatCurrency = (value: string) => {
        const numbers = value.replace(/\D/g, "");
        if (!numbers) return "";
        const amount = parseFloat(numbers) / 100;
        return amount.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    };

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
        setter(formatCurrency(e.target.value));
    };

    const buttons = [
        "Obra",
        "Atividade",
        "Evento",
        "Fornecedor",
        "Equipe"
    ];

    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 14) value = value.slice(0, 14);

        value = value.replace(/^(\d{2})(\d)/, "$1.$2");
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
        value = value.replace(/(\d{4})(\d)/, "$1-$2");

        setCnpj(value);
    };

    const handleSupplierCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 14) value = value.slice(0, 14);

        value = value.replace(/^(\d{2})(\d)/, "$1.$2");
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
        value = value.replace(/(\d{4})(\d)/, "$1-$2");

        setSupplierCnpj(value);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 10) {
            value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        } else if (value.length > 6) {
            value = value.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
        } else if (value.length > 2) {
            value = value.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
        }

        setSupplierContact(value);
    };

    const handleButtonClick = (label: string) => {
        setEditingWorkId(null); // Reset edit mode
        resetForm();
        setModalType(`Cadastrar ${label}`);
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setWorkId("");
        setRegional("Rimes");
        setGoLiveDate("");
        setCep("");
        setAddress(null);
        setAddressNumber("");
        setComplement("");
        setWorkType("Moving");
        setCnpj("");
        setBusinessCase("");
        setCapex("");
        setInternalOrder("");

        // Reset new fields
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
    };

    const handleEdit = (item: any) => {
        setEditingWorkId(item.id);
        setModalType(`Cadastrar ${item.itemType}`);

        // Populate form based on type
        if (item.itemType === "Obra") {
            setWorkId(item.id);
            setRegional(item.regional);
            setGoLiveDate(item.go_live_date);
            setCep(item.cep);
            setAddress(item.address);
            setAddressNumber(item.address?.number || "");
            setComplement(item.address?.complement || "");
            setWorkType(item.work_type);
            setCnpj(item.cnpj);
            setBusinessCase(item.business_case);
            setCapex(item.capex_approved);
            setInternalOrder(item.internal_order);
        } else if (item.itemType === "Evento") {
            setWorkId(item.id); // Reusing workId for ID
            setEventDescription(item.description);
            setEventType(item.type);
            setEventSla(item.sla);
        } else if (item.itemType === "Fornecedor") {
            setWorkId(item.id);
            setSupplierSocialReason(item.social_reason);
            setSupplierCnpj(item.cnpj);
            setSupplierContractStart(item.contract_start);
            setSupplierContractEnd(item.contract_end);
            setSupplierProject(item.project);
            setSupplierHiringType(item.hiring_type);
            setSupplierHeadquarters(item.headquarters);
            setSupplierLegalRep(item.legal_representative);
            setSupplierRepEmail(item.representative_email);
            setSupplierContact(item.contact);
            setSupplierWitness(item.witness);
            setSupplierWitnessEmail(item.witness_email);
            setSupplierObs(item.observations);
        } else if (item.itemType === "Equipe") {
            setWorkId(item.id);
            setTeamName(item.name);
            setTeamRole(item.role);
        }

        setIsModalOpen(true);
    };

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, type: string } | null>(null);

    const handleDeleteClick = (id: string, type: string) => {
        setItemToDelete({ id, type });
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            const token = await getAuthToken();
            if (!token) return;

            let endpoint = "works";
            if (itemToDelete.type === "Evento") endpoint = "events";
            if (itemToDelete.type === "Fornecedor") endpoint = "suppliers";
            if (itemToDelete.type === "Equipe") endpoint = "team";

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/${endpoint}/${itemToDelete.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.ok) {
                setToast({ message: `${itemToDelete.type} excluíd${itemToDelete.type === "Obra" ? "a" : "o"} com sucesso!`, type: "success" });
                fetchWorks();
                setIsDeleteModalOpen(false);
                setItemToDelete(null);
            } else {
                setToast({ message: `Erro ao excluir ${itemToDelete.type.toLowerCase()}.`, type: "error" });
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            setToast({ message: "Erro ao conectar com o servidor.", type: "error" });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = await getAuthToken();
            if (!token) {
                setToast({ message: "Usuário não autenticado.", type: "error" });
                setIsSaving(false);
                return;
            }

            let endpoint = "";
            let payload: any = {};

            if (modalType === "Cadastrar Obra") {
                // Ensure default empty strings for ALL address fields to satisfy Pydantic
                // This covers cases where CEP API omits fields (e.g. general CEPs) or address is null
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
                    internal_order: internalOrder
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
            } else {
                setToast({ message: "Funcionalidade em desenvolvimento.", type: "error" });
                setIsSaving(false);
                return;
            }

            const url = editingWorkId
                ? `${import.meta.env.VITE_API_BASE_URL}/${endpoint}/${editingWorkId}`
                : `${import.meta.env.VITE_API_BASE_URL}/${endpoint}`;

            const method = editingWorkId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setToast({ message: editingWorkId ? "Item atualizado com sucesso!" : "Item cadastrado com sucesso!", type: "success" });
                setIsModalOpen(false);
                fetchWorks(); // Refresh list
                resetForm();
            } else {
                const errorData = await response.json();
                let errorMessage = "Erro desconhecido";
                if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else if (Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map((err: any) => `${err.loc.join('.')} - ${err.msg}`).join(', ');
                } else if (typeof errorData.detail === 'object') {
                    errorMessage = JSON.stringify(errorData.detail);
                }
                setToast({ message: `Erro ao salvar: ${errorMessage}`, type: "error" });
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setToast({ message: "Erro ao conectar com o servidor.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCepBlur = async () => {
        if (cep.length === 8) {
            setIsLoadingCep(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cep/${cep}`);
                if (response.ok) {
                    const data = await response.json();
                    if (!data.error) {
                        setAddress(data);
                    } else {
                        alert("CEP não encontrado.");
                        setAddress(null);
                    }
                }
            } catch (error) {
                console.error("Error fetching CEP:", error);
            } finally {
                setIsLoadingCep(false);
            }
        }
    };

    const filteredWorks = works.filter((item) => {
        const matchesSearch = searchTerm === "" ||
            item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.regional && item.regional.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.address?.city && item.address.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.address?.neighborhood && item.address.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.work_type && item.work_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.social_reason && item.social_reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesType = filterType === null ||
            item.itemType === filterType;

        return matchesSearch && matchesType;
    });

    return (
        <div className="relative min-h-full w-full">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 pr-80 p-8">
                {filteredWorks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 mt-20">
                        <div className="p-6 rounded-full bg-white/30 backdrop-blur-md shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium">Nenhum item encontrado</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredWorks.map((item) => (
                            <div key={item.id} className="relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all hover:scale-[1.02] hover:bg-white/50 group">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    {/* Icon based on type */}
                                    {item.itemType === "Obra" && (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                                        </svg>
                                    )}
                                    {item.itemType === "Evento" && (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                        </svg>
                                    )}
                                    {item.itemType === "Fornecedor" && (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                                        </svg>
                                    )}
                                    {item.itemType === "Equipe" && (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 5.472m0 0a9.09 9.09 0 00-3.279 3.298m.944-5.463A5.991 5.991 0 0112 12.75a5.991 5.991 0 015.058 5.472M12 12.75a5.995 5.995 0 01-5.058 5.472m0 0a9.08 9.08 0 00-3.279 3.298M15 11.25a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                        </svg>
                                    )}
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100/50 text-blue-700 border border-blue-200/50">
                                            {item.itemType}
                                        </span>
                                        {/* Action Buttons */}
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-1.5 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors"
                                                title="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(item.id, item.itemType)}
                                                className="p-1.5 rounded-full bg-white/50 hover:bg-red-100 text-red-600 transition-colors"
                                                title="Excluir"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Content based on Type */}
                                    {item.itemType === "Obra" && (
                                        <>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{item.id}</h3>
                                            <p className="text-sm text-gray-600 mb-4">{item.address?.neighborhood}</p>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-500 text-xs">Regional</p>
                                                    <p className="font-medium text-gray-800">{item.regional}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs">Go Live</p>
                                                    <p className="font-medium text-gray-800">
                                                        {new Date(item.go_live_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {item.has_engineering && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                                                        Engenharia
                                                    </span>
                                                )}
                                                {item.has_control_tower && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                                                        Control Tower
                                                    </span>
                                                )}
                                                {item.has_planning && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                                                        Planejamento
                                                    </span>
                                                )}
                                                {item.has_report && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                                                        Report
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {item.itemType === "Evento" && (
                                        <>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{item.id}</h3>
                                            <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-500 text-xs">Tipo</p>
                                                    <p className="font-medium text-gray-800">{item.type}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs">SLA</p>
                                                    <p className="font-medium text-gray-800">{item.sla} dias</p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {item.itemType === "Fornecedor" && (
                                        <>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{item.social_reason}</h3>
                                            <p className="text-sm text-gray-600 mb-4">{item.project}</p>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-500 text-xs">Status</p>
                                                    {(() => {
                                                        const today = new Date();
                                                        const end = new Date(item.contract_end + 'T12:00:00');
                                                        const diffTime = end.getTime() - today.getTime();
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                        let status = "Ativo";
                                                        let color = "text-green-600";

                                                        if (diffDays < 0) {
                                                            status = "Vencido";
                                                            color = "text-red-600";
                                                        } else if (diffDays <= 30) {
                                                            status = "Próximo";
                                                            color = "text-yellow-600";
                                                        }

                                                        return <p className={`font-bold ${color}`}>{status}</p>;
                                                    })()}
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-xs">Término</p>
                                                    <p className="font-medium text-gray-800">
                                                        {new Date(item.contract_end + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {item.itemType === "Equipe" && (
                                        <>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{item.name}</h3>
                                            <p className="text-sm text-gray-600 mb-4">{item.role}</p>
                                            <div className="text-sm">
                                                <p className="text-gray-500 text-xs">ID</p>
                                                <p className="font-medium text-gray-800">{item.id}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Sidebar */}
            <div className="fixed right-8 top-32 flex flex-col gap-6 w-64 z-10">
                {/* Cadastro Menu */}
                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl">
                    <h3 className="text-sm font-bold text-gray-700 px-2 mb-1 uppercase tracking-wider">Cadastro</h3>
                    {buttons.map((label) => (
                        <button
                            key={label}
                            onClick={() => handleButtonClick(label)}
                            className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                        >
                            {label}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">
                                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                        </button>
                    ))}
                </div>

                {/* Filtros Section */}
                <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl">
                    <h3 className="text-sm font-bold text-gray-700 px-2 mb-1 uppercase tracking-wider">Filtros</h3>

                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full rounded-xl bg-white/80 pl-10 pr-4 py-3 text-sm font-medium text-gray-900 shadow-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-500"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 absolute left-3 top-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>

                    {/* Filter Toggles */}
                    <div className="flex flex-col gap-3 mt-2">
                        {["Obra", "Atividade", "Evento", "Fornecedor", "Equipe"].map((type) => (
                            <div key={type} className="flex items-center justify-between px-2">
                                <span className="text-sm font-medium text-gray-700">{type}</span>
                                <button
                                    onClick={() => setFilterType(filterType === type ? null : type)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${filterType === type ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${filterType === type ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingWorkId ? "Editar Obra" : modalType}
            >
                {modalType === "Cadastrar Obra" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">ID</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => setWorkId(e.target.value)}
                                    disabled={!!editingWorkId}
                                    className={`mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200 ${editingWorkId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="ID"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Regional</label>
                                <select
                                    value={regional}
                                    onChange={(e) => setRegional(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                >
                                    <option>Rimes</option>
                                    <option>Noneco</option>
                                    <option>SPCIL</option>
                                    <option>Sul</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Go Live</label>
                                <input
                                    type="date"
                                    value={goLiveDate}
                                    onChange={(e) => setGoLiveDate(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">CEP</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={cep}
                                        onChange={(e) => setCep(e.target.value.replace(/\D/g, ""))}
                                        onBlur={handleCepBlur}
                                        maxLength={8}
                                        className="block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                        placeholder="00000000"
                                    />
                                    {isLoadingCep && (
                                        <div className="absolute right-2 top-2">
                                            <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Tipo</label>
                                <select
                                    value={workType}
                                    onChange={(e) => setWorkType(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                >
                                    <option>Moving</option>
                                    <option>Expansão</option>
                                    <option>Startup</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">CNPJ</label>
                                <input
                                    type="text"
                                    value={cnpj}
                                    onChange={handleCnpjChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="xx.xxx.xxx/xxxx-xx"
                                />
                            </div>
                        </div>

                        {/* Address Display - Full Width if exists */}
                        {address && (
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-200">
                                <span className="font-semibold">{address.street}</span>, {address.neighborhood} - {address.city}/{address.state}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Número</label>
                                <input
                                    type="text"
                                    value={addressNumber}
                                    onChange={(e) => setAddressNumber(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="N/A"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Complemento</label>
                                <input
                                    type="text"
                                    value={complement}
                                    onChange={(e) => setComplement(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Ex: Apto 101"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Business Case</label>
                                <input
                                    type="text"
                                    value={businessCase}
                                    onChange={(e) => handleCurrencyChange(e, setBusinessCase)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="R$ 0,00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Capex</label>
                                <input
                                    type="text"
                                    value={capex}
                                    onChange={(e) => handleCurrencyChange(e, setCapex)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="R$ 0,00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Ordem Interna</label>
                                <input
                                    type="text"
                                    value={internalOrder}
                                    onChange={(e) => setInternalOrder(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="OI"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                            >
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Atividade" && (
                    <form className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome da Atividade</label>
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                                placeholder="Ex: Instalação Elétrica"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">SLA (dias)</label>
                            <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Urgência</label>
                            <select className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200">
                                <option>Impacto Leve</option>
                                <option>Impacto Moderado</option>
                                <option>Impacto Crítico</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Categoria (Opcional)</label>
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ring-1 ring-gray-200"
                                placeholder="Ex: Infraestrutura"
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-md transition-all hover:shadow-lg"
                            >
                                Salvar
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Evento" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">ID</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => setWorkId(e.target.value)}
                                    disabled={!!editingWorkId}
                                    className={`mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200 ${editingWorkId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="ID do Evento"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">SLA (dias)</label>
                                <input
                                    type="number"
                                    value={eventSla}
                                    onChange={(e) => setEventSla(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Ex: 5"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Tipo</label>
                            <select
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                            >
                                <option value="Novo">Novo</option>
                                <option value="Backlog">Backlog</option>
                                <option value="Acompanhamento">Acompanhamento</option>
                                <option value="Carry Over">Carry Over</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Em Andamento">Em Andamento</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Descrição</label>
                            <textarea
                                value={eventDescription}
                                onChange={(e) => setEventDescription(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                placeholder="Descrição do evento"
                                rows={2}
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                            >
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Fornecedor" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">ID</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => setWorkId(e.target.value)}
                                    disabled={!!editingWorkId}
                                    className={`mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200 ${editingWorkId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="ID"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Início de Contrato</label>
                                <input
                                    type="date"
                                    value={supplierContractStart}
                                    onChange={(e) => setSupplierContractStart(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Término de Contrato</label>
                                <input
                                    type="date"
                                    value={supplierContractEnd}
                                    onChange={(e) => setSupplierContractEnd(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-700">Razão Social</label>
                                <input
                                    type="text"
                                    value={supplierSocialReason}
                                    onChange={(e) => setSupplierSocialReason(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Razão Social"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">CNPJ</label>
                                <input
                                    type="text"
                                    value={supplierCnpj}
                                    onChange={handleSupplierCnpjChange}
                                    maxLength={18}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="00.000.000/0000-00"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Projeto</label>
                                <input
                                    type="text"
                                    value={supplierProject}
                                    onChange={(e) => setSupplierProject(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Projeto"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Tipo Contratação</label>
                                <input
                                    type="text"
                                    value={supplierHiringType}
                                    onChange={(e) => setSupplierHiringType(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Ex: CLT"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Sede</label>
                                <input
                                    type="text"
                                    value={supplierHeadquarters}
                                    onChange={(e) => setSupplierHeadquarters(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Cidade/UF"
                                />
                            </div>
                        </div>

                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2 border-t pt-2">Representante</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Nome</label>
                                <input
                                    type="text"
                                    value={supplierLegalRep}
                                    onChange={(e) => setSupplierLegalRep(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Nome"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    value={supplierRepEmail}
                                    onChange={(e) => setSupplierRepEmail(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Contato</label>
                                <input
                                    type="text"
                                    value={supplierContact}
                                    onChange={handlePhoneChange}
                                    maxLength={15}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>

                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2 border-t pt-2">Testemunha</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Nome</label>
                                <input
                                    type="text"
                                    value={supplierWitness}
                                    onChange={(e) => setSupplierWitness(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="Nome"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    value={supplierWitnessEmail}
                                    onChange={(e) => setSupplierWitnessEmail(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700">Observações</label>
                            <textarea
                                value={supplierObs}
                                onChange={(e) => setSupplierObs(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                placeholder="Observações adicionais"
                                rows={2}
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                            >
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}

                {modalType === "Cadastrar Equipe" && (
                    <form className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">ID</label>
                                <input
                                    type="text"
                                    value={workId}
                                    onChange={(e) => setWorkId(e.target.value)}
                                    disabled={!!editingWorkId}
                                    className={`mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200 ${editingWorkId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="ID"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Função</label>
                                <select
                                    value={teamRole}
                                    onChange={(e) => setTeamRole(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                >
                                    <option value="Engenheiro">Engenheiro</option>
                                    <option value="Control Tower">Control Tower</option>
                                    <option value="Planejamento">Planejamento</option>
                                    <option value="Coordenador">Coordenador</option>
                                    <option value="Gerente">Gerente</option>
                                    <option value="Arquiteto">Arquiteto</option>
                                    <option value="CM">CM</option>
                                    <option value="PM">PM</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700">Nome</label>
                            <input
                                type="text"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-2 ring-1 ring-gray-200"
                                placeholder="Nome completo"
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`rounded-lg px-4 py-2 text-xs font-medium text-white shadow-md transition-all hover:shadow-lg flex items-center gap-2 ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                            >
                                {isSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
            {/* Delete Confirmation Modal */}
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
