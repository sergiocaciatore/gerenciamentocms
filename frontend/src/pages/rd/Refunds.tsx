import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import ConfirmationModal from "../../components/ConfirmationModal";
import type { SubOperation } from "../../constants/operations";

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const EXPENSE_TYPES = [
    { id: 1, label: "Ônibus/ Uber" },
    { id: 2, label: "Pedágio" },
    { id: 3, label: "Estacionamento" },
    { id: 4, label: "Supermercado" },
    { id: 5, label: "Material Escritório" },
    { id: 6, label: "Copiadora" },
    { id: 8, label: "Lavanderia/ Faxina" },
    { id: 9, label: "Contas Luz/Gás/Água/Internet" },
    { id: 10, label: "Manutenção Carro" },
    { id: 11, label: "Correio" },
    { id: 12, label: "Refeição" },
    { id: 13, label: "Taxas" },
    { id: 14, label: "Manutenção Escritório" }
];

const FUEL_TYPES = [
    "Gasolina",
    "Gasolina Aditivada",
    "Álcool",
    "Gás",
    "Diesel"
];

interface OperationData {
    name: string;
    subOperations: SubOperation[];
}

import type { RDData } from "./MyRDs";

export interface RefundItem {
    id: string;
    type: 'CAIXA' | 'COMBUSTIVEL';
    date: string;
    operation: string;
    subOperation: SubOperation;
    expenseType: string;
    value: number;
    createdAt: string;

    // Caixa-specific
    city?: string;
    observation?: string;

    // Combustivel-specific
    origem?: string;
    destino?: string;
    tipoCarro?: string;
    cidadeCombustivel?: string;
    kmAproximado?: number;
    precoLitro?: number;
    consumoKmL?: number;
}

interface RefundsProps {
    viewMode?: boolean;
    isAdmin?: boolean;
    initialData?: RDData | null;
    userName?: string;
    onBack?: () => void;
}

export default function Refunds({ viewMode = false, isAdmin = false, initialData, userName: propUserName, onBack }: RefundsProps) {
    const [selectedMonth, setSelectedMonth] = useState(initialData?.month ?? new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(initialData?.year ?? new Date().getFullYear());
    const [isSaving, setIsSaving] = useState(false);

    // User & Data State
    const [userName, setUserName] = useState(propUserName || "Usuário");
    const [rdStatus, setRdStatus] = useState<string>(initialData?.status || "open");
    const [invoiceUrl, setInvoiceUrl] = useState<string | null>(initialData?.invoiceUrl || null);
    const [invoiceRejected, setInvoiceRejected] = useState(initialData?.invoiceRejected || false);
    const [refundList, setRefundList] = useState<RefundItem[]>(initialData?.refunds || []);

    // Operations Data
    const [allOperations, setAllOperations] = useState<OperationData[]>([]);

    // Modal State
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [refundStep, setRefundStep] = useState<'SELECT_TYPE' | 'FORM'>('SELECT_TYPE');
    const [selectedType, setSelectedType] = useState<'CAIXA' | 'COMBUSTIVEL'>('CAIXA');

    const [newRefund, setNewRefund] = useState({
        // Common fields
        date: "",
        operation: "",
        subOperation: null as SubOperation | null,
        expenseType: "",

        // Caixa fields
        city: "",
        observation: "",
        value: "",

        // Combustivel fields
        origem: "",
        destino: "",
        tipoCarro: "",
        cidadeCombustivel: "",
        kmAproximado: "",
        precoLitro: "",
        consumoKmL: ""
    });

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Confirmation Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: "success" | "danger" | "warning" | "info";
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    // Load Initial Data
    useEffect(() => {
        if (!auth.currentUser || viewMode) return;

        const loadData = async () => {
            try {
                // 1. Fetch User Name
                const profileRef = doc(db, "users", auth.currentUser!.uid, "settings", "profile");
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                    const fullName = profileSnap.data().fullName || "";
                    setUserName(fullName.split(" ")[0] || "Usuário");
                }

                // 2. Fetch All Operations for Modal
                const opsQuery = await getDocs(collection(db, "operations"));
                const opsList = opsQuery.docs.map(doc => ({
                    name: doc.id,
                    subOperations: doc.data().subOperations || []
                }));
                setAllOperations(opsList);

                // 3. Fetch RD Data
                const docId = `${selectedYear}-${selectedMonth}`;
                const docRef = doc(db, "users", auth.currentUser!.uid, "rds", docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setInvoiceUrl(data.invoiceUrl || null);
                    setInvoiceRejected(data.invoiceRejected || false);
                    setRefundList(data.refunds || []);
                    setRdStatus(data.status || "open");
                } else {
                    setInvoiceUrl(null);
                    setInvoiceRejected(false);
                    setRefundList([]);
                    setRdStatus("open");
                }

            } catch (err) {
                console.error("Error loading data:", err);
            }
        };

        loadData();
    }, [selectedYear, selectedMonth, viewMode]);

    // Reset modal state when closed
    useEffect(() => {
        if (!isRefundModalOpen) {
            setTimeout(() => {
                setRefundStep('SELECT_TYPE');
                setEditingId(null);
                setNewRefund({
                    date: "",
                    operation: "",
                    subOperation: null,
                    expenseType: "",
                    city: "",
                    observation: "",
                    value: "",
                    origem: "",
                    destino: "",
                    tipoCarro: "",
                    cidadeCombustivel: "",
                    kmAproximado: "",
                    precoLitro: "",
                    consumoKmL: ""
                });
            }, 300);
        }
    }, [isRefundModalOpen]);



    const handleSubmit = () => {
        setModalConfig({
            isOpen: true,
            title: "Enviar Reembolso?",
            message: "Esta ação enviará o reembolso para aprovação. Deseja continuar?",
            type: "info",
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                setIsSaving(true);

                try {
                    if (!auth.currentUser) return;
                    const docId = `${selectedYear}-${selectedMonth}`;
                    const docRef = doc(db, "users", auth.currentUser.uid, "rds", docId);

                    await setDoc(docRef, {
                        status: 'submitted',
                        updatedAt: new Date().toISOString()
                    }, { merge: true });

                    setRdStatus('submitted');

                } catch (error) {
                    console.error("Error submitting refund:", error);
                    alert("Erro ao enviar reembolso.");
                } finally {
                    setIsSaving(false);
                }
            }
        });
    };

    const handleClear = () => {
        setModalConfig({
            isOpen: true,
            title: "Limpar Reembolso?",
            message: "Isso apagará todos os dados não salvos. Deseja continuar?",
            type: "warning",
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                if (!auth.currentUser) return;
                try {
                    const docId = `${selectedYear}-${selectedMonth}`;
                    const docRef = doc(db, "users", auth.currentUser!.uid, "rds", docId);
                    await updateDoc(docRef, { refunds: [] });
                    setRefundList([]);
                } catch (e) {
                    console.error("Error clearing refunds:", e);
                }
            }
        });
    };

    const handleEditRefund = (refund: RefundItem) => {
        // Populate form with refund data
        setSelectedType(refund.type);
        setNewRefund({
            date: refund.date,
            operation: refund.operation,
            subOperation: refund.subOperation,
            expenseType: refund.expenseType,
            city: refund.city || "",
            observation: refund.observation || "",
            value: refund.value.toString(),
            origem: refund.origem || "",
            destino: refund.destino || "",
            tipoCarro: refund.tipoCarro || "",
            cidadeCombustivel: refund.cidadeCombustivel || "",
            kmAproximado: refund.kmAproximado?.toString() || "",
            precoLitro: refund.precoLitro?.toString() || "",
            consumoKmL: refund.consumoKmL?.toString() || ""
        });

        setEditingId(refund.id);
        setRefundStep('FORM');
        setIsRefundModalOpen(true);
    };

    const handleDeleteRefund = async (refundId: string, skipConfirmation = false) => {
        const executeDelete = async () => {
            if (!auth.currentUser) return;
            try {
                const docId = `${selectedYear}-${selectedMonth}`;
                const docRef = doc(db, "users", auth.currentUser.uid, "rds", docId);

                const updatedList = refundList.filter(r => r.id !== refundId);
                await updateDoc(docRef, { refunds: updatedList });
                setRefundList(updatedList);
            } catch (error) {
                console.error("Error deleting refund:", error);
                alert("Erro ao excluir reembolso.");
            }
        };

        if (skipConfirmation) {
            await executeDelete();
        } else {
            setModalConfig({
                isOpen: true,
                title: "Excluir Reembolso?",
                message: "Esta ação não pode ser desfeita. Deseja continuar?",
                type: "danger",
                onConfirm: async () => {
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    await executeDelete();
                }
            });
        }
    };

    const handleSaveRefund = useCallback(async () => {
        if (!auth.currentUser || !newRefund.date || !newRefund.operation || !newRefund.subOperation) {
            alert("Preencha os campos obrigatórios!");
            return;
        }

        // Type-specific validation
        if (selectedType === 'CAIXA') {
            if (!newRefund.value) {
                alert("Preencha o valor!");
                return;
            }
        } else if (selectedType === 'COMBUSTIVEL') {
            if (!newRefund.kmAproximado || !newRefund.consumoKmL || !newRefund.precoLitro) {
                alert("Preencha os campos obrigatórios de combustível!");
                return;
            }
        }

        const baseRefund = {
            id: editingId || Date.now().toString(), // Use existing ID if editing
            type: selectedType,
            date: newRefund.date,
            operation: newRefund.operation,
            subOperation: newRefund.subOperation,
            expenseType: newRefund.expenseType,
            value: selectedType === 'CAIXA'
                ? parseFloat(newRefund.value.replace(",", "."))
                : parseFloat(newRefund.value),
            createdAt: new Date().toISOString() // Ideally preserve original creation date if editing, but okay update for now
        };

        const refundItem: RefundItem = selectedType === 'CAIXA'
            ? {
                ...baseRefund,
                city: newRefund.city,
                observation: newRefund.observation
            }
            : {
                ...baseRefund,
                origem: newRefund.origem,
                destino: newRefund.destino,
                tipoCarro: newRefund.tipoCarro,
                cidadeCombustivel: newRefund.cidadeCombustivel,
                kmAproximado: parseFloat(newRefund.kmAproximado),
                precoLitro: parseFloat(newRefund.precoLitro.replace(",", ".")),
                consumoKmL: parseFloat(newRefund.consumoKmL)
            };

        try {
            const docId = `${selectedYear}-${selectedMonth}`;
            const docRef = doc(db, "users", auth.currentUser.uid, "rds", docId);

            let updatedList;
            if (editingId) {
                // Update existing
                updatedList = refundList.map(r => r.id === editingId ? refundItem : r);
            } else {
                // Create new
                updatedList = [...refundList, refundItem];
            }

            // We update the whole list to ensure consistency, rather than arrayUnion which only adds
            await setDoc(docRef, {
                refunds: updatedList
            }, { merge: true });

            setRefundList(updatedList);
            setIsRefundModalOpen(false);

        } catch (error) {
            console.error("Error saving refund:", error);
            alert("Erro ao salvar reembolso.");
        }
    }, [newRefund, selectedType, editingId, refundList, selectedYear, selectedMonth]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isRefundModalOpen) return;

            if (e.key === "Escape") {
                setIsRefundModalOpen(false);
            } else if (e.key === "Enter") {
                // If focus is in a textarea, we might want to allow newlines (shift+enter) or just standard behavior.
                // Assuming no textareas or user accepts Enter = Save everywhere for now as per requirement.
                // To be safe, we can check activeElement if there's a textarea.
                const target = e.target as HTMLElement;
                if (target.tagName === 'TEXTAREA') return;

                handleSaveRefund();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isRefundModalOpen, handleSaveRefund]);

    // Helper to get sub-ops for selected operation
    const getSubOpsForSelectedOp = () => {
        const op = allOperations.find(o => o.name === newRefund.operation);
        return op ? op.subOperations : [];
    };

    // Helper to calculate fuel value
    const calculateFuelValue = (km: string, consumo: string, preco: string): string => {
        if (!km || !consumo || !preco) return "";
        const kmNum = parseFloat(km);
        const consumoNum = parseFloat(consumo);
        const precoNum = parseFloat(preco.replace(",", "."));

        if (kmNum > 0 && consumoNum > 0 && precoNum > 0) {
            const litros = kmNum / consumoNum;
            const valorTotal = litros * precoNum;
            return valorTotal.toFixed(2);
        }
        return "";
    };

    // Format helpers
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const [, month, day] = dateStr.split("-");
        return `${day}/${month}`;
    };

    return (
        <div className="flex flex-col h-full gap-6 animate-fadeIn relative">
            {/* Top Controls Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_auto] gap-6 items-stretch">

                {/* 1. Date Selection & New Button */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center h-auto min-h-[112px]">
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-1">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm min-w-0 disabled:opacity-50"
                                disabled={viewMode}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="w-20 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm disabled:opacity-50"
                                disabled={viewMode}
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-2">
                            {(!viewMode && rdStatus !== 'submitted' && rdStatus !== 'approved') && (
                                <button
                                    className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-100 active:scale-95"
                                    onClick={() => setIsRefundModalOpen(true)}
                                >
                                    <span className="material-symbols-rounded">add_circle</span>
                                    <span>Novo Reembolso</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Welcome & Upload Card - Conditional Content for View Mode */}
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-3xl flex items-center justify-between gap-4 h-28 lg:h-auto relative">
                    <div className="z-10 flex-1">
                        {viewMode ? (
                            <>
                                <h3 className="font-bold text-gray-800 text-sm mb-1">
                                    Reembolsos de {userName}
                                </h3>
                                <p className="text-xs text-gray-500 leading-snug">
                                    Visualizando detalhes de reembolso.
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="font-bold text-gray-800 text-sm mb-1">
                                    Olá, <span className="text-purple-600">{userName}</span>!
                                </h3>
                                <p className="text-xs text-gray-500 leading-snug">
                                    {invoiceUrl
                                        ? "Nota fiscal anexada com sucesso!"
                                        : invoiceRejected
                                            ? <span className="text-red-500 font-bold">Nota rejeitada! Por favor anexe uma nova nota.</span>
                                            : "Bem-vindo! Não esqueça de emitir e enviar a sua nota fiscal."
                                    }
                                </p>
                            </>
                        )}
                    </div>

                    <div className="bg-white/50 p-3 rounded-2xl border border-white/50 backdrop-blur-sm self-center">
                        <span className="material-symbols-rounded text-purple-400 text-4xl">
                            {viewMode ? 'payments' : 'upload_file'}
                        </span>
                    </div>
                </div>

                {/* 3. Actions */}
                <div className="flex flex-col justify-center gap-3 w-full xl:w-auto">
                    {viewMode ? (
                        <button
                            onClick={onBack}
                            className="w-full xl:w-32 h-full min-h-[50px] bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-rounded">arrow_back</span>
                            Voltar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {isSaving ? (
                                    <span className="material-symbols-rounded animate-spin">progress_activity</span>
                                ) : (
                                    <>
                                        <span className="material-symbols-rounded text-[20px]">send</span>
                                        <span>Enviar Reembolso</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleClear}
                                className="flex-1 px-4 py-3 rounded-xl border border-red-100 text-red-600 hover:bg-red-50 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <span className="material-symbols-rounded text-[20px]">delete_sweep</span>
                                <span>Limpar</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Refunds List - Grid of Cards */}
            <div className="flex-1 overflow-y-auto pr-2">
                {refundList.length === 0 ? (
                    <div className="h-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                            <span className="material-symbols-rounded text-3xl text-gray-400">receipt_long</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">Nenhum reembolso lançado</h3>
                        <p className="text-gray-500 max-w-sm mt-2">
                            Clique em "Novo Reembolso" para adicionar suas despesas deste mês.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {refundList.map((item) => (
                            <div
                                key={item.id}
                                className={`bg-white p-5 rounded-2xl shadow-sm border hover:shadow-md transition-shadow flex flex-col gap-3 group border-l-4 relative ${item.type === 'COMBUSTIVEL' ? 'border-l-orange-500 border-gray-100' : 'border-l-blue-500 border-gray-100'
                                    }`}
                            >
                                {/* Action Buttons */}
                                {(isAdmin || (!viewMode && rdStatus !== 'submitted' && rdStatus !== 'approved')) && (
                                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditRefund(item)}
                                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                            title="Editar"
                                        >
                                            <span className="material-symbols-rounded text-[16px]">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRefund(item.id)}
                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                            title="Excluir"
                                        >
                                            <span className="material-symbols-rounded text-[16px]">delete</span>
                                        </button>
                                    </div>
                                )}

                                {/* Header: Date and Value */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${item.type === 'COMBUSTIVEL' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <span className="material-symbols-rounded text-[16px]">
                                                {item.type === 'COMBUSTIVEL' ? 'local_gas_station' : 'payments'}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-500">{formatDate(item.date)}</span>
                                    </div>
                                    <span className={`text-lg font-bold ${item.type === 'COMBUSTIVEL' ? 'text-orange-600' : 'text-blue-600'}`}>
                                        {formatCurrency(item.value)}
                                    </span>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 space-y-2">
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-0.5">Operação</p>
                                        <p className="text-sm text-gray-800 font-semibold line-clamp-1" title={item.subOperation.obra}>
                                            {item.subOperation.obra}
                                        </p>
                                        <p className="text-xs text-gray-500 line-clamp-1" title={`${item.subOperation.cte} - ${item.subOperation.contabil}`}>
                                            CTE: {item.subOperation.cte} • {item.subOperation.contabil}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-0.5">Despesa</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'COMBUSTIVEL' ? 'bg-orange-400' : 'bg-blue-400'}`}></span>
                                            <p className="text-sm font-medium text-gray-700">{item.expenseType}</p>
                                        </div>
                                    </div>

                                    {/* Conditional Fields Based on Type */}
                                    {item.type === 'COMBUSTIVEL' ? (
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                                            <div>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">Origem</span>
                                                <p className="text-xs text-gray-700 font-medium truncate">{item.origem || "-"}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">Destino</span>
                                                <p className="text-xs text-gray-700 font-medium truncate">{item.destino || "-"}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">KM</span>
                                                <p className="text-xs text-gray-700 font-medium">{item.kmAproximado || "-"}</p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">Preço/L</span>
                                                <p className="text-xs text-gray-700 font-medium">{item.precoLitro ? `R$ ${item.precoLitro.toFixed(2)}` : "-"}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">Consumo KM/L</span>
                                                <p className="text-xs text-gray-700 font-medium">{item.consumoKmL || "-"}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-2 border-t border-gray-100">
                                            <div>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">Cidade</span>
                                                <p className="text-xs text-gray-600 font-medium truncate" title={item.city}>{item.city || "-"}</p>
                                            </div>
                                            {item.observation && (
                                                <div className="mt-2 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                                                    <p className="text-[11px] text-yellow-800 italic line-clamp-2 leading-relaxed">
                                                        "{item.observation}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Refund Modal */}
            {isRefundModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-scaleIn relative overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">
                                {refundStep === 'SELECT_TYPE' ? 'Novo Reembolso' : `Novo Reembolso - ${selectedType === 'CAIXA' ? 'Caixa' : 'Combustível'}`}
                            </h3>
                            <button
                                onClick={() => setIsRefundModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <span className="material-symbols-rounded text-gray-500">close</span>
                            </button>
                        </div>

                        {refundStep === 'SELECT_TYPE' ? (
                            <div className="grid grid-cols-2 gap-4 py-8">
                                <button
                                    onClick={() => {
                                        setSelectedType('CAIXA');
                                        setRefundStep('FORM');
                                    }}
                                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group"
                                >
                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-rounded text-4xl text-gray-400 group-hover:text-blue-500">payments</span>
                                    </div>
                                    <span className="font-bold text-lg text-gray-600 group-hover:text-blue-700">Caixa</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setSelectedType('COMBUSTIVEL');
                                        setRefundStep('FORM');
                                    }}
                                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-all group"
                                >
                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-rounded text-4xl text-gray-400 group-hover:text-orange-500">local_gas_station</span>
                                    </div>
                                    <span className="font-bold text-lg text-gray-600 group-hover:text-orange-700">Combustível</span>
                                </button>
                            </div>
                        ) : (
                            // Form with conditional fields
                            <div className="space-y-4 animate-slideInRight">
                                {/*  Common Fields */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Data *</label>
                                    <input
                                        type="date"
                                        value={newRefund.date}
                                        onChange={(e) => setNewRefund({ ...newRefund, date: e.target.value })}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Operação *</label>
                                    <select
                                        value={newRefund.operation}
                                        onChange={(e) => setNewRefund({ ...newRefund, operation: e.target.value, subOperation: null })}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione a Operação...</option>
                                        {allOperations.map(op => (
                                            <option key={op.name} value={op.name}>{op.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Centro de Custo (Sub-Op) *</label>
                                    <select
                                        value={newRefund.subOperation ? JSON.stringify(newRefund.subOperation) : ""}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setNewRefund({ ...newRefund, subOperation: JSON.parse(e.target.value) });
                                            }
                                        }}
                                        disabled={!newRefund.operation}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        <option value="">Selecione...</option>
                                        {getSubOpsForSelectedOp().map((sub, idx) => (
                                            <option key={idx} value={JSON.stringify(sub)}>{sub.cte} - {sub.obra} - {sub.contabil}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Tipo de Despesa</label>
                                    <select
                                        value={newRefund.expenseType}
                                        onChange={(e) => setNewRefund({ ...newRefund, expenseType: e.target.value })}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione o tipo...</option>
                                        {selectedType === 'COMBUSTIVEL' ? (
                                            FUEL_TYPES.map(fuel => (
                                                <option key={fuel} value={fuel}>{fuel}</option>
                                            ))
                                        ) : (
                                            EXPENSE_TYPES.map(type => (
                                                <option key={type.id} value={type.label}>{type.label}</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                {/* Type-Specific Fields */}
                                {selectedType === 'CAIXA' ? (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Cidade</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: São Paulo"
                                                value={newRefund.city}
                                                onChange={(e) => setNewRefund({ ...newRefund, city: e.target.value })}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Valor (R$) *</label>
                                            <input
                                                type="number"
                                                placeholder="0,00"
                                                value={newRefund.value}
                                                onChange={(e) => setNewRefund({ ...newRefund, value: e.target.value })}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Observação</label>
                                            <textarea
                                                rows={3}
                                                placeholder="Detalhes adicionais..."
                                                value={newRefund.observation}
                                                onChange={(e) => setNewRefund({ ...newRefund, observation: e.target.value })}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Origem *</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: São Paulo"
                                                    value={newRefund.origem}
                                                    onChange={(e) => setNewRefund({ ...newRefund, origem: e.target.value })}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Destino *</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Rio de Janeiro"
                                                    value={newRefund.destino}
                                                    onChange={(e) => setNewRefund({ ...newRefund, destino: e.target.value })}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Tipo de Carro</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Gol"
                                                    value={newRefund.tipoCarro}
                                                    onChange={(e) => setNewRefund({ ...newRefund, tipoCarro: e.target.value })}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Cidade</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: São Paulo"
                                                    value={newRefund.cidadeCombustivel}
                                                    onChange={(e) => setNewRefund({ ...newRefund, cidadeCombustivel: e.target.value })}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>


                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Km Aproximado *</label>
                                                <input
                                                    type="number"
                                                    placeholder="100"
                                                    value={newRefund.kmAproximado}
                                                    onChange={(e) => {
                                                        const newKm = e.target.value;
                                                        const calculatedValue = calculateFuelValue(newKm, newRefund.consumoKmL, newRefund.precoLitro);
                                                        setNewRefund({ ...newRefund, kmAproximado: newKm, value: calculatedValue });
                                                    }}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Preço/L (R$) *</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="5.50"
                                                    value={newRefund.precoLitro}
                                                    onChange={(e) => {
                                                        const newPreco = e.target.value;
                                                        const calculatedValue = calculateFuelValue(newRefund.kmAproximado, newRefund.consumoKmL, newPreco);
                                                        setNewRefund({ ...newRefund, precoLitro: newPreco, value: calculatedValue });
                                                    }}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase">Consumo KM/L *</label>
                                                <input
                                                    type="number"
                                                    placeholder="12"
                                                    value={newRefund.consumoKmL}
                                                    onChange={(e) => {
                                                        const newConsumo = e.target.value;
                                                        const calculatedValue = calculateFuelValue(newRefund.kmAproximado, newConsumo, newRefund.precoLitro);
                                                        setNewRefund({ ...newRefund, consumoKmL: newConsumo, value: calculatedValue });
                                                    }}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Valor Total (R$)</label>
                                            <input
                                                type="text"
                                                value={newRefund.value ? formatCurrency(parseFloat(newRefund.value)) : "R$ 0,00"}
                                                readOnly
                                                className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-xl outline-none font-mono text-green-700 font-bold"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => setRefundStep('SELECT_TYPE')}
                                        className="flex-1 py-3 px-6 rounded-xl border-2 border-gray-100 text-gray-600 font-semibold hover:bg-gray-50 transition-all active:scale-95"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        onClick={handleSaveRefund}
                                        className="flex-1 py-3 px-6 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 active:translate-y-0.5"
                                    >
                                        Salvar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                onConfirm={modalConfig.onConfirm}
            />
        </div>
    );
}
