import { useState, useMemo, useEffect, useRef } from "react";
import { getDaysInMonth, calculateDifferenceInMinutes, formatMinutesToHHMM } from "./utils";
import TimesheetRow from "./TimesheetRow";
import type { DayData } from "./TimesheetRow";
import type { RDData } from "./MyRDs";
import type { SubOperation } from "../../constants/operations";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import ConfirmationModal from "../../components/ConfirmationModal";
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
// Using unpkg or cdnjs as a safe default for client-side loading without bundler config complexity
pdfjsLib.GlobalWorkerOptions.workerSrc = '//unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface TimesheetProps {
    viewMode?: boolean;
    initialData?: RDData | null;
    onBack?: () => void;
}

export default function Timesheet({ viewMode = false, initialData, onBack }: TimesheetProps) {
    const [selectedMonth, setSelectedMonth] = useState(initialData?.month ?? new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(initialData?.year ?? new Date().getFullYear());
    const [timesheetData, setTimesheetData] = useState<Record<string, DayData>>(initialData?.data || {});
    const [submittedPeriods, setSubmittedPeriods] = useState<Set<string>>(new Set());

    // User Info
    const [userName, setUserName] = useState("Usuário");
    const [userFullName, setUserFullName] = useState("");
    const [userCompany, setUserCompany] = useState("");
    const [userContractType, setUserContractType] = useState<string>("");
    const [invoiceUrl, setInvoiceUrl] = useState<string | null>(initialData?.invoiceUrl || null);
    const [invoiceData, setInvoiceData] = useState<{ issuer: string; value: string; } | null>(initialData?.invoiceData || null);
    const [invoiceRejected, setInvoiceRejected] = useState(initialData?.invoiceRejected || false);
    const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);

    // Sub-Operation Selection State
    const [subOpsList, setSubOpsList] = useState<SubOperation[]>([]);
    const [selectedSubOp, setSelectedSubOp] = useState<SubOperation | null>(initialData?.subOperation || null);
    const [assignedOperation, setAssignedOperation] = useState<string>("");

    const [isSaving, setIsSaving] = useState(false);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: "success" | "danger" | "warning" | "info";
        onConfirm?: () => void;
        isAlert?: boolean;
        confirmText?: string;
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    const isSubmitted = initialData?.status === 'submitted' || false;
    const effectiveReadOnly = viewMode || isSubmitted;

    const days = useMemo(() => getDaysInMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

    // Load Submitted RDs
    useEffect(() => {
        if (!auth.currentUser || viewMode) return;
        const uid = auth.currentUser!.uid;

        const loadSubmitted = async () => {
            try {
                const q = query(
                    collection(db, "users", uid, "rds"),
                    where("status", "==", "submitted")
                );
                const snapshot = await getDocs(q);
                const periods = new Set<string>();
                snapshot.forEach(doc => {
                    const data = doc.data();
                    periods.add(`${data.year}-${data.month}`);
                });
                setSubmittedPeriods(periods);
            } catch (error) {
                console.error("Error loading submitted RDs:", error);
            }
        };
        loadSubmitted();
    }, [viewMode]);

    // ... (unchanged useEffect for validation) ...

    // ... (unchanged useEffect for loadData) ...

    // ... (rendering part) ...



    // Validate current selection
    useEffect(() => {
        if (!viewMode && submittedPeriods.has(`${selectedYear}-${selectedMonth}`)) {
            // Find first available month in selectedYear
            // If all 12 are taken, we might stay stuck or switch year.
            // Simple heuristic: Try to find next available month in cycle.
            let nextMonth = -1;
            for (let i = 0; i < 12; i++) {
                if (!submittedPeriods.has(`${selectedYear}-${i}`)) {
                    nextMonth = i;
                    break;
                }
            }

            if (nextMonth !== -1) {
                setSelectedMonth(nextMonth);
            } else {
                // All months submitted for this year? Rare but possible.
                // Could wipe selection or show global warning.
            }
        }
    }, [submittedPeriods, selectedYear, selectedMonth, viewMode]);

    // Load Data Effect
    useEffect(() => {
        if (!auth.currentUser) return;

        const loadData = async () => {
            setIsSaving(true);
            try {
                if (auth.currentUser) {
                    // 1. Fetch User Name from Settings Profile
                    const profileRef = doc(db, "users", auth.currentUser.uid, "settings", "profile");
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const fullName = profileSnap.data().fullName || "";
                        setUserFullName(fullName);
                        const firstName = fullName.split(" ")[0];
                        setUserName(firstName || "Usuário");
                    }

                    // 1b. Fetch User Company (Razão Social) from Root User Doc
                    const userRef = doc(db, "users", auth.currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        setUserCompany(userSnap.data().razaoSocial || "");
                        setUserContractType(userSnap.data().contractType || "");
                    }
                }

                // 2. Fetch RD Data
                if (auth.currentUser) {
                    const docId = `${selectedYear}-${selectedMonth}`;
                    const docRef = doc(db, "users", auth.currentUser.uid, "rds", docId);
                    const docSnap = await getDoc(docRef);

                    // 2a. Fetch Assignment for fallback/default (Decoupled Logic)
                    let assignedOpName = "";
                    try {
                        const assignRef = doc(db, "users", auth.currentUser.uid, "settings", "rd_assignments");
                        const assignSnap = await getDoc(assignRef);
                        if (assignSnap.exists()) {
                            assignedOpName = assignSnap.data()[`${selectedYear}-${selectedMonth}`] || "";
                        }
                    } catch (e) {
                        console.error("Error fetching assignments:", e);
                    }

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setTimesheetData(data.data || {});
                        setInvoiceUrl(data.invoiceUrl || null);
                        setInvoiceData(data.invoiceData || null);
                        setInvoiceRejected(data.invoiceRejected || false);

                        // Load Operation Info (Prioritize RD data, fallback to assignment)
                        const opName = data.operation || assignedOpName || "";
                        setAssignedOperation(opName);
                        setSelectedSubOp(data.subOperation || null);

                        if (opName) {
                            try {
                                const opRef = doc(db, "operations", opName);
                                const opSnap = await getDoc(opRef);
                                if (opSnap.exists()) {
                                    setSubOpsList(opSnap.data().subOperations || []);
                                }
                            } catch (e) {
                                console.error("Error loading sub-operations:", e);
                            }
                        }
                    } else {
                        setTimesheetData({});
                        setInvoiceUrl(null);
                        setInvoiceData(null);
                        setInvoiceRejected(false);
                        setAssignedOperation(assignedOpName || ""); // Use assignment if no RD exists
                        setSelectedSubOp(null);

                        // Load subops if assigned
                        if (assignedOpName) {
                            try {
                                const opRef = doc(db, "operations", assignedOpName);
                                const opSnap = await getDoc(opRef);
                                if (opSnap.exists()) {
                                    setSubOpsList(opSnap.data().subOperations || []);
                                }
                            } catch (e) {
                                console.error("Error loading sub-operations for new RD:", e);
                                setSubOpsList([]);
                            }
                        } else {
                            setSubOpsList([]);
                        }
                    }
                }
            } catch (err) {
                console.error("Error loading data:", err);
            } finally {
                setIsSaving(false);
            }
        };

        loadData();
    }, [selectedYear, selectedMonth, viewMode]);

    // Summary Calculation
    const summary = useMemo(() => {
        let totalMinutesMonth = 0;
        let daysWorked = 0;

        days.forEach(day => {
            const key = day.toISOString().split('T')[0];
            const data = timesheetData[key];
            if (data) {
                const dayMinutes =
                    calculateDifferenceInMinutes(data.morning?.in, data.morning?.out) +
                    calculateDifferenceInMinutes(data.afternoon?.in, data.afternoon?.out) +
                    calculateDifferenceInMinutes(data.night?.in, data.night?.out);

                if (dayMinutes > 0) {
                    totalMinutesMonth += dayMinutes;
                    daysWorked++;
                }
            }
        });

        return { totalMinutesMonth, daysWorked };
    }, [days, timesheetData]);

    // Auto-save Logic (Updated to include Invoice URL)
    const saveData = async (
        dataToSave: Record<string, DayData>,
        status: 'draft' | 'submitted' = 'draft',
        currentInvoiceUrl?: string | null,
        currentInvoiceData?: { issuer: string; value: string; } | null
    ) => {
        if (!auth.currentUser || viewMode) return;

        const docId = `${selectedYear}-${selectedMonth}`;
        const docRef = doc(db, "users", auth.currentUser.uid, "rds", docId);

        // Use provided invoice URL or current state
        const urlToSave = currentInvoiceUrl !== undefined ? currentInvoiceUrl : invoiceUrl;
        const dataInfoToSave = currentInvoiceData !== undefined ? currentInvoiceData : invoiceData;

        try {
            await setDoc(docRef, {
                year: selectedYear,
                month: selectedMonth,
                data: dataToSave,
                status: status,
                invoiceUrl: urlToSave,
                invoiceData: dataInfoToSave,
                totalMinutes: summary.totalMinutesMonth,
                daysWorked: summary.daysWorked,
                updatedAt: serverTimestamp(),
                invoiceRejected: false // Reset rejection on save/update
            }, { merge: true });

            if (status === 'draft') setIsSaving(false);
        } catch (error) {
            console.error("Auto-save failed:", error);
            setIsSaving(false);
        }
    };

    const handleDataChange = (date: Date, data: DayData) => {
        const key = date.toISOString().split('T')[0];
        const newData = { ...timesheetData, [key]: data };
        setTimesheetData(newData);

        if (!viewMode) {
            setIsSaving(true);
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = setTimeout(() => {
                saveData(newData);
            }, 1000);
        }
    };

    const extractPdfData = async (file: File, expectedIssuer: string): Promise<{ issuer: string; value: string; }> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            // Extract text from the first page
            const page = await pdf.getPage(1);
            const textContent = await page.getTextContent();

            // Check if we actually have text
            if (textContent.items.length === 0) {
                return { issuer: "PDF Scanner (Imagem)", value: "Não identificado" };
            }

            // Join with " | " to help debug/separation or just space. 
            // Using " " matches typical flow.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const textItems = textContent.items.map((item: any) => item.str).join(" ");

            console.log("PDF Text Content:", textItems); // For debugging if needed

            // 1. EXTRACT ISSUER (Prioritize Settings Match)
            let issuer = "Não identificado";

            if (expectedIssuer && textItems.toLowerCase().includes(expectedIssuer.toLowerCase())) {
                issuer = expectedIssuer;
            } else {
                // Fallback: Try regex if strictly needed, but relying on settings is safer as requested.
                // We keep a simple regex fallback just in case settings are empty
                const issuerMatch = textItems.match(/Nome\/Razão\s*Social.*?[:.]?\s*(.*?)(?=\s*(?:Endereço|CPF|CNPJ))/i);
                if (issuerMatch && issuerMatch[1]) {
                    issuer = issuerMatch[1].trim().replace(/^[^A-Z0-9a-zÀ-Ú]+/, "").substring(0, 50);
                }
            }

            // 2. EXTRACT VALUE
            let value = "R$ 0,00";

            // Permissive value match: "Valor" followed by keywords, then eventually the number
            // We look for the last occurrence of a monetary shape if possible, but first match is safer for "Total"
            // The user's text: "VALOR TOTAL DO SERVIÇO = R$ 10.000,00"
            // Regex: Valor ... digits
            const valueMatch = textItems.match(/Valor\s*(?:Total|Líquido|do\s*Serviço|da\s*Nota|da\s*Danfe|Aproximado).*?[:=]?\s*(?:R\$\s*)?([\d.,]+)/i);

            if (valueMatch && valueMatch[1]) {
                // Check if it looks like a valid number
                if (/\d/.test(valueMatch[1])) {
                    value = `R$ ${valueMatch[1].trim()}`;
                }
            }

            return { issuer, value };
        } catch (error) {
            console.error("PDF Extraction failed:", error);
            return { issuer: "Erro ao ler PDF", value: "Erro" };
        }
    };

    const handleInvoiceUpload = async (file: File) => {
        if (!auth.currentUser || viewMode) return;

        // Check if PDF
        if (file.type !== "application/pdf") {
            setModalConfig({
                isOpen: true,
                title: "Arquivo Inválido",
                message: "Apenas arquivos PDF são aceitos.",
                type: "danger",
                isAlert: true
            });
            return;
        }

        setIsUploadingInvoice(true);
        try {
            // 1. Generate Filename
            const cleanName = userFullName.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ");
            const firstName = cleanName[0] || "USUARIO";
            const lastName = cleanName.length > 1 ? cleanName[cleanName.length - 1] : "";
            const formattedName = lastName ? `${firstName}_${lastName}` : firstName;

            const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
            const newFileName = `${formattedName}_${monthStr}_${selectedYear}.pdf`;

            // 2. Extract Data (Client Side)
            const extracted = await extractPdfData(file, userCompany);
            setInvoiceData(extracted);

            // 3. Upload File
            const storageRef = ref(storage, `users/${auth.currentUser.uid}/rds/${selectedYear}_${selectedMonth}/${newFileName}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setInvoiceUrl(downloadURL);
            setInvoiceRejected(false);

            // 4. Save Everything
            await saveData(timesheetData, 'draft', downloadURL, extracted);

            setModalConfig({
                isOpen: true,
                title: "Upload Concluído",
                message: "Nota fiscal enviada e analisada com sucesso!",
                type: "success",
                isAlert: true
            });

        } catch (error) {
            console.error("Invoice upload failed:", error);
            setModalConfig({
                isOpen: true,
                title: "Erro no Upload",
                message: "Não foi possível enviar a nota fiscal. Tente novamente.",
                type: "danger",
                isAlert: true
            });
        } finally {
            setIsUploadingInvoice(false);
        }
    };

    const handleSubOpChange = async (subOp: SubOperation) => {
        setSelectedSubOp(subOp);
        if (!auth.currentUser || viewMode) return;

        const docId = `${selectedYear}-${selectedMonth}`;
        const docRef = doc(db, "users", auth.currentUser.uid, "rds", docId);

        try {
            await setDoc(docRef, { subOperation: subOp }, { merge: true });
        } catch (error) {
            console.error("Error updating sub-operation:", error);
            // Optionally revert UI change if error
        }
    };

    const confirmSend = () => {
        // Validation: Invoice required only if NOT CLT
        if (!invoiceUrl && userContractType !== 'CLT') {
            setModalConfig({
                isOpen: true,
                title: "Atenção",
                message: "Para enviar sua RD por favor anexe a nota.",
                type: "warning",
                isAlert: true,
                confirmText: "Voltar"
            });
            return;
        }

        setModalConfig({
            isOpen: true,
            title: "Enviar Relatório?",
            message: (
                <span>
                    Deseja enviar a RD com <strong>{summary.daysWorked} dias</strong> trabalhados e <strong>{formatMinutesToHHMM(summary.totalMinutesMonth)} horas</strong>?
                    <br /><br />
                    <span className="text-red-500 font-bold">⚠️ Essa ação não pode ser desfeita.</span>
                </span>
            ),
            type: "success",
            confirmText: "Sim, enviar",
            onConfirm: handleSendAction
        });
    };

    const handleSendAction = async () => {
        await saveData(timesheetData, 'submitted');
        // Optionally reset local state, but keeping it visible is sometimes better. The requirement says "visualizá-la na aba Minhas RDs".
        // If we reset, the screen clears.
        setTimesheetData({});
        setInvoiceUrl(null);

        setModalConfig({
            isOpen: true,
            title: "Sucesso",
            message: "RD enviada com sucesso! Você pode visualizá-la na aba 'Minhas RDs'.",
            type: "success",
            isAlert: true
        });
    };

    const confirmClear = () => {
        setModalConfig({
            isOpen: true,
            title: "Apagar Dados?",
            message: (
                <span>
                    Isso irá apagar <strong>todos os dados</strong> da RD de {MONTHS[selectedMonth]}/{selectedYear}.
                    <br /><br />
                    <span className="text-red-500 font-bold">Tem certeza que deseja continuar?</span>
                </span>
            ),
            type: "danger",
            confirmText: "Apagar tudo",
            onConfirm: handleClearAction
        });
    };

    const handleClearAction = async () => {
        if (!auth.currentUser || viewMode) return;
        const docId = `${selectedYear}-${selectedMonth}`;

        try {
            await deleteDoc(doc(db, "users", auth.currentUser.uid, "rds", docId));
            setTimesheetData({});
            setInvoiceUrl(null);
        } catch (error) {
            console.error("Clear failed:", error);
            setModalConfig({
                isOpen: true,
                title: "Erro",
                message: "Erro ao limpar dados.",
                type: "danger",
                isAlert: true
            });
        }
    };

    return (
        <div className="flex flex-col h-full gap-6 relative">
            {/* Top Controls Grid 
                Modified to 4 columns: Date | Summary | Welcome/Upload | Actions
                Grid columns logic: `grid-cols-1 xl:grid-cols-[1fr_1.2fr_1.8fr_auto]` to fit nicely
            */}
            <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_auto] gap-6 items-stretch">
                {/* 1. Date Selection & Summary Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center h-auto min-h-[112px]">
                    {viewMode ? (
                        <div className="text-center">
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Período</p>
                            <h2 className="text-2xl font-bold text-gray-800">{MONTHS[selectedMonth]} {selectedYear}</h2>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-1">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm min-w-0"
                                >
                                    {MONTHS.map((m, i) => {
                                        const isSubmitted = submittedPeriods.has(`${selectedYear}-${i}`);
                                        return (
                                            <option key={i} value={i} disabled={isSubmitted}>
                                                {m} {isSubmitted ? '(Env)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="w-20 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Summary Metrics */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Horas</span>
                                    <span className="text-lg font-bold text-blue-600">{formatMinutesToHHMM(summary.totalMinutesMonth)}</span>
                                </div>
                                <div className="h-6 w-px bg-gray-100"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Dias</span>
                                    <span className="text-lg font-bold text-purple-600">{summary.daysWorked}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Welcome & Upload Card (New) */}
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-3xl flex items-center justify-between gap-4 h-28 lg:h-auto relative">
                    <div className="z-10 flex-1">
                        {viewMode ? (
                            <>
                                <h3 className="font-bold text-gray-800 text-sm mb-1">
                                    Nota Fiscal
                                </h3>
                                <p className="text-xs text-gray-500 leading-snug">
                                    Documento anexado.
                                </p>
                                {selectedSubOp && (
                                    <div className="mt-1 text-xs text-purple-700 font-medium bg-purple-50 px-2 py-1 rounded inline-block">
                                        {selectedSubOp.obra}
                                    </div>
                                )}
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
                                {assignedOperation && subOpsList.length > 0 && (
                                    <div className="mt-3 mb-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                            Operação / Obra
                                        </label>
                                        <select
                                            value={selectedSubOp ? JSON.stringify(selectedSubOp) : ""}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const subOp = JSON.parse(e.target.value);
                                                    handleSubOpChange(subOp);
                                                }
                                            }}
                                            className="w-64 text-xs p-2 bg-white border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 shadow-sm"
                                        >
                                            <option value="">Selecione a Sub-Operação...</option>
                                            {subOpsList.map((op, idx) => (
                                                <option key={idx} value={JSON.stringify(op)}>
                                                    {op.obra} (Cte: {op.cte} ref. {op.contabil})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                        {invoiceUrl && (() => {
                            const cleanName = userFullName.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ");
                            const firstName = cleanName[0] || "USUARIO";
                            const lastName = cleanName.length > 1 ? cleanName[cleanName.length - 1] : "";
                            const formattedName = lastName ? `${firstName}_${lastName}` : firstName;
                            const monthStr = (selectedMonth + 1).toString().padStart(2, '0');
                            const fileName = `${formattedName}_${monthStr}_${selectedYear}.pdf`;

                            return (
                                <div className="mt-3 text-xs flex flex-col gap-2">
                                    {/* Link & Filename Row */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 text-gray-700 bg-white/60 px-2.5 py-1.5 rounded-lg border border-purple-100 shadow-sm">
                                            <span className="material-symbols-rounded text-sm text-purple-600">description</span>
                                            <span className="font-medium">{fileName}</span>
                                        </div>

                                        <a
                                            href={invoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Abrir PDF"
                                        >
                                            <span className="material-symbols-rounded text-lg">open_in_new</span>
                                        </a>
                                    </div>

                                    {/* Data Row */}
                                    {invoiceData && (
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white/60 px-3 py-2 rounded-lg border border-purple-100 shadow-sm w-fit">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                                <span className="text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Emissor</span>
                                                <span className="text-gray-800 font-medium">{invoiceData.issuer}</span>
                                            </div>

                                            <div className="hidden sm:block h-4 w-px bg-gray-300"></div>

                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                                <span className="text-gray-500 font-semibold uppercase text-[10px] tracking-wider">Valor</span>
                                                <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                                    {invoiceData.value}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Upload Button - Hidden for CLT unless viewing an existing file */}
                    {(userContractType !== 'CLT' || invoiceUrl) && (
                        <div className="z-10">
                            {effectiveReadOnly && !invoiceRejected ? (
                                <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center opacity-50 cursor-not-allowed">
                                    <span className="material-symbols-rounded text-gray-400">upload_file</span>
                                </div>
                            ) : (
                                <div className="relative group">
                                    <input
                                        type="file"
                                        id="invoice-upload"
                                        className="hidden"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) handleInvoiceUpload(e.target.files[0]);
                                        }}
                                        disabled={isUploadingInvoice}
                                    />
                                    <label
                                        htmlFor="invoice-upload"
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm cursor-pointer transition-all active:scale-95 ${invoiceUrl ? "bg-white text-purple-600 border-2 border-purple-100 hover:border-purple-300"
                                            : "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200"
                                            }`}
                                    >
                                        {isUploadingInvoice ? (
                                            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                        ) : (
                                            <span className="material-symbols-rounded text-2xl">
                                                {invoiceUrl ? 'edit_document' : 'upload_file'}
                                            </span>
                                        )}
                                    </label>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        {invoiceUrl ? "Alterar Nota" : "Enviar Nota"}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                {/* 4. Actions Buttons */}
                <div className="flex flex-col gap-2 h-28 lg:h-auto justify-center">
                    {viewMode ? (
                        <button
                            onClick={onBack}
                            className="h-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-2xl transition-all shadow-sm active:scale-95"
                        >
                            Voltar
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={confirmSend}
                                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all shadow-sm active:scale-95 text-xs lg:text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <span className="material-symbols-rounded text-lg">send</span>
                                {invoiceRejected ? "Reenviar Nota" : "Enviar RD"}
                            </button>
                            <button
                                onClick={confirmClear}
                                className="flex-1 px-4 py-2 bg-white hover:bg-red-50 text-red-500 border border-red-100 font-bold rounded-xl transition-all shadow-sm active:scale-95 text-xs lg:text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <span className="material-symbols-rounded text-lg">delete</span>
                                Limpar RD
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Auto-save Indicator (moved down slightly or same pos) */}
            {
                !viewMode && (
                    <div className="absolute top-0 right-0 -mt-8 flex items-center gap-2 text-xs text-gray-400">
                        {isSaving ? (
                            <>
                                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-rounded text-sm">cloud_done</span>
                                Salvo
                            </>
                        )}
                    </div>
                )
            }

            {/* Timesheet List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-2 items-center p-4 bg-gray-50 border-b border-gray-200 font-semibold text-xs text-gray-500 uppercase tracking-wider text-center sticky top-0 z-10">
                    <div>Data</div>
                    <div>Manhã</div>
                    <div>Tarde</div>
                    <div>Noite</div>
                    <div>Total</div>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 relative">
                    {days.map((date) => {
                        const key = date.toISOString().split('T')[0];
                        const data = timesheetData[key] || {
                            morning: { in: "", out: "" },
                            afternoon: { in: "", out: "" },
                            night: { in: "", out: "" }
                        };

                        return (
                            <TimesheetRow
                                key={key}
                                date={date}
                                data={data}
                                onChange={handleDataChange}
                                readOnly={effectiveReadOnly}
                            />
                        );
                    })}

                    {isSaving && Object.keys(timesheetData).length === 0 && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                isAlert={modalConfig.isAlert}
                confirmText={modalConfig.confirmText}
            />
        </div >
    );
}
