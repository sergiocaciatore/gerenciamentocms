import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, doc, updateDoc, deleteDoc, deleteField, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import ConfirmationModal from "../../components/ConfirmationModal";
import Timesheet from './Timesheet';
import Refunds from './Refunds';
import UserDetailsModal from './UserDetailsModal';
import UserConfigModal from './UserConfigModal';
import type { RDData } from './MyRDs';
import { formatCurrency } from './utils';

interface UserData {
    id: string;
    email: string;
    razaoSocial?: string;
    fullName?: string;
    cnpj?: string;
    contractType?: string;
    role?: string;
    createdAt?: string;
    archived?: boolean;
    archivedAt?: string;
    archivedBy?: string;
}

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// OPERATIONS constant imported


export default function AdminPanel() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number>(-1);
    const [selectedYear, setSelectedYear] = useState(2026);
    const [userRds, setUserRds] = useState<Record<string, RDData[]>>({});
    const [userAssignments, setUserAssignments] = useState<Record<string, Record<string, string>>>({}); // userId -> { "year-month": "OpName" }
    const [loadingRds, setLoadingRds] = useState<Record<string, boolean>>({});
    const [editingOp, setEditingOp] = useState<{ userId: string, month: number } | null>(null);
    const [viewingRD, setViewingRD] = useState<RDData | null>(null);
    const [viewingRefunds, setViewingRefunds] = useState<{ rd: RDData, userName: string } | null>(null);
    const [viewingUserDetail, setViewingUserDetail] = useState<UserData | null>(null);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);

    // Dynamic Operations State
    const [operationsList, setOperationsList] = useState<string[]>([]);

    useEffect(() => {
        const fetchOperations = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "operations"));
                const ops = querySnapshot.docs.map(doc => doc.id).sort();
                setOperationsList(ops);
            } catch (error) {
                console.error("Error fetching operations:", error);
            }
        };
        fetchOperations();
    }, []);

    // Advanced Filters State
    const [periodRDs, setPeriodRDs] = useState<Record<string, RDData>>({}); // userId -> RD map
    const [filterRDPending, setFilterRDPending] = useState(false);
    const [filterNFPending, setFilterNFPending] = useState(false);
    const [filterValue, setFilterValue] = useState<{ min: string; max: string }>({ min: '', max: '' });
    const [filterHours, setFilterHours] = useState<{ min: string; max: string }>({ min: '', max: '' });
    const [filterDays, setFilterDays] = useState<{ min: string; max: string }>({ min: '', max: '' });
    const [filterOperation, setFilterOperation] = useState("");

    // Filter toggles UI state
    const [showValueFilter, setShowValueFilter] = useState(false);
    const [showHoursFilter, setShowHoursFilter] = useState(false);
    const [showDaysFilter, setShowDaysFilter] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: "", message: "", onConfirm: () => { } });



    // Batch Operation Modal
    const [batchModal, setBatchModal] = useState<{
        isOpen: boolean;
        userId: string;
        userName: string;
        startMonth: number;
        year: number;
        operation: string;
    }>({ isOpen: false, userId: "", userName: "", startMonth: 0, year: 2026, operation: "" });

    const deleteRD = async (userId: string, rdId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Excluir RD?",
            message: "Isso apagará este relatório permanentemente. O usuário poderá preencher o mês novamente.",
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, "users", userId, "rds", rdId));
                    // Refresh
                    fetchUserRds(userId);
                } catch (err) {
                    console.error("Error deleting RD:", err);
                    setError("Erro ao excluir RD.");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const deleteInvoice = async (userId: string, rdId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Excluir Nota Fiscal?",
            message: "A nota fiscal será removida e o usuário verá um aviso para verificar a nota.",
            onConfirm: async () => {
                try {
                    const ref = doc(db, "users", userId, "rds", rdId);
                    await updateDoc(ref, {
                        invoiceUrl: deleteField(),
                        invoiceData: deleteField(),
                        invoiceRejected: true
                    });
                    // Refresh
                    fetchUserRds(userId);
                } catch (err) {
                    console.error("Error deleting invoice:", err);
                    setError("Erro ao excluir nota.");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const archiveUser = async (user: UserData) => {
        setConfirmModal({
            isOpen: true,
            title: "Arquivar Usuário?",
            message: `O usuário ${user.fullName || user.email} será movido para o Histórico. Todas as suas RDs e notas fiscais serão preservadas.`,
            onConfirm: async () => {
                try {
                    const userRef = doc(db, "users", user.id);
                    await updateDoc(userRef, {
                        archived: true,
                        archivedAt: new Date().toISOString(),
                        archivedBy: auth.currentUser?.email || "unknown"
                    });
                    // Remove from local list
                    setUsers(prev => prev.filter(u => u.id !== user.id));
                    setExpandedUserId(null);
                } catch (err) {
                    console.error("Error archiving user:", err);
                    setError("Erro ao arquivar usuário.");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleSetOperation = async (userId: string, year: number, month: number, newOperation: string) => {
        const rdId = `${year}-${month}`;
        const assignmentKey = `${year}-${month}`;

        try {
            // 1. Save to Assignments Map (Source of Truth for Assignments)
            const assignRef = doc(db, "users", userId, "settings", "rd_assignments");
            await setDoc(assignRef, { [assignmentKey]: newOperation }, { merge: true });

            // 2. If RD exists, update it to keep sync. NEVER create RD here.
            const ref = doc(db, "users", userId, "rds", rdId);
            const docSnap = await getDoc(ref);

            if (docSnap.exists()) {
                await updateDoc(ref, { operation: newOperation });
            }

            // Refresh
            fetchUserRds(userId);
        } catch (err) {
            console.error("Error setting operation:", err);
            setError("Erro ao atualizar operação.");
        }
    };

    const handleConfirmBatch = useCallback(async () => {
        const { userId, startMonth, year, operation } = batchModal;
        setBatchModal(prev => ({ ...prev, isOpen: false }));

        try {
            const promises = [];
            // Iterate from next month (startMonth + 1) to December (11)
            for (let m = startMonth + 1; m < 12; m++) {
                const rdId = `${year}-${m}`;
                const ref = doc(db, "users", userId, "rds", rdId);

                // Read first to avoid overwriting and only update EXISTING RDs
                promises.push((async () => {
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        return updateDoc(ref, { operation });
                    }
                    return Promise.resolve();
                })());
            }
            await Promise.all(promises);
            fetchUserRds(userId);
        } catch (err) {
            console.error("Batch update error:", err);
            setError("Erro ao aplicar em lote.");
        }
    }, [batchModal]);

    const handleSaveUserConfig = useCallback(async (userId: string, newData: { contractType: string, role: string }) => {
        try {
            await updateDoc(doc(db, "users", userId), newData);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...newData } : u));
            setEditingUser(null);
        } catch (error) {
            console.error("Error updating user:", error);
            setError("Erro ao atualizar usuário.");
        }
    }, []);



    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const q = query(collection(db, "users"));
                const querySnapshot = await getDocs(q);

                // Fetch profile data for each user in parallel
                const usersList = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
                    const userData = docSnap.data();
                    let fullName = userData.razaoSocial; // Default fallback

                    try {
                        const profileSnap = await getDoc(doc(db, "users", docSnap.id, "settings", "profile"));
                        if (profileSnap.exists() && profileSnap.data().fullName) {
                            fullName = profileSnap.data().fullName;
                        }
                    } catch {
                        console.log(`No profile settings for ${docSnap.id}`);
                    }

                    return {
                        id: docSnap.id,
                        ...userData,
                        fullName
                    } as UserData;
                }));

                // Filter out archived users
                const activeUsers = usersList.filter(user => !user.archived);
                setUsers(activeUsers);
            } catch (err) {
                console.error("Error fetching users:", err);
                setError("Erro ao carregar usuários. Verifique as permissões.");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // Fetch All RDs for Selected Period (for filtering)
    useEffect(() => {
        const fetchPeriodRDs = async () => {
            if (selectedMonth === -1 || users.length === 0) {
                setPeriodRDs({});
                return;
            }

            try {
                const docId = `${selectedYear}-${selectedMonth}`;
                const promises = users.map(async (user) => {
                    const rdsRef = doc(db, 'users', user.id, 'rds', docId);
                    const snap = await getDoc(rdsRef);
                    if (snap.exists()) {
                        return { userId: user.id, data: { id: snap.id, ...snap.data() } as RDData };
                    }
                    return null;
                });

                const results = await Promise.all(promises);

                const rdsMap: Record<string, RDData> = {};
                results.forEach(res => {
                    if (res) {
                        rdsMap[res.userId] = res.data;
                    }
                });

                setPeriodRDs(rdsMap);
            } catch (error) {
                console.error("Error fetching period RDs:", error);
            }
        };

        fetchPeriodRDs();
    }, [selectedMonth, selectedYear, users]);

    // Shortcuts for Modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Priority to Top-most modal: Batch Modal
            if (batchModal.isOpen) {
                if (e.key === "Escape") {
                    setBatchModal(prev => ({ ...prev, isOpen: false }));
                } else if (e.key === "Enter") {
                    // Check if confirmation is allowed (at least one future month)
                    const monthsCount = Array.from({ length: 12 - (batchModal.startMonth + 1) }).length;
                    if (monthsCount > 0) {
                        handleConfirmBatch();
                    }
                }
                return; // Stop processing if batch modal is open
            }

            // User Edit Modal
            if (editingUser) {
                if (e.key === "Escape") {
                    setEditingUser(null);
                } else if (e.key === "Enter") {
                    handleSaveUserConfig(editingUser.id, {
                        contractType: editingUser.contractType || 'PJ',
                        role: editingUser.role || 'user'
                    });
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [batchModal, editingUser, handleConfirmBatch, handleSaveUserConfig]);
    // Ideally handlers should be stable or refs. For now, adding basic deps.


    // Derived Filtered Users
    const filteredUsers = users.filter(user => {
        // 0. Text Search (Global)
        if (filterSearch) {
            const searchLower = filterSearch.toLowerCase();
            const matchesEmail = user.email.toLowerCase().includes(searchLower);
            const matchesName = (user.fullName || user.razaoSocial || '').toLowerCase().includes(searchLower);
            if (!matchesEmail && !matchesName) return false;
        }

        // Only apply advanced filters if a month is selected
        if (selectedMonth === -1) return true;

        const userRd = periodRDs[user.id];

        // 1. RD Pending Filter
        if (filterRDPending) {
            // Show ONLY if NO RD exists (or status not submitted? Let's check existence first)
            if (userRd) return false;
        }

        // 2. NF Pending Filter
        if (filterNFPending) {
            // Show if RD exists BUT (no invoiceUrl OR rejected)
            // Or if no RD at all? Usually "NF Pending" implies we are waiting for NF for a DONE RD.
            if (!userRd) {
                return false; // No RD => RD Pending, not necessarily NF Pending contextually, but user said "mesma coisa".
                // Let's assume: Show users who HAVE RD but NO NF.
                // If I want users who haven't sent RD, I use RD Pending.
                // If I want users who sent RD but no NF, I use NF Pending.
            }
            if (userRd.invoiceUrl) return false; // Has valid NF -> Hide
        }

        // 3. Value Filter (requires RD)
        if (filterValue.min || filterValue.max) {
            if (!userRd || !userRd.invoiceData) return false;
            // Parse "R$ 1.200,00"
            const valStr = userRd.invoiceData.value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
            const val = parseFloat(valStr);
            const min = filterValue.min ? parseFloat(filterValue.min) : -Infinity;
            const max = filterValue.max ? parseFloat(filterValue.max) : Infinity;
            if (val < min || val > max) return false;
        }

        // 4. Hours Filter (requires RD)
        if (filterHours.min || filterHours.max) {
            if (!userRd) return false;
            const hours = userRd.totalMinutes / 60;
            const min = filterHours.min ? parseFloat(filterHours.min) : -Infinity;
            const max = filterHours.max ? parseFloat(filterHours.max) : Infinity;
            if (hours < min || hours > max) return false;
        }

        // 5. Days Filter (requires RD)
        if (filterDays.min || filterDays.max) {
            if (!userRd) return false;
            const days = userRd.daysWorked;
            const min = filterDays.min ? parseFloat(filterDays.min) : -Infinity;
            const max = filterDays.max ? parseFloat(filterDays.max) : Infinity;
            if (days < min || days > max) return false;
        }

        // 6. Operation Filter
        if (filterOperation) {
            if (!userRd || userRd.operation !== filterOperation) return false;
        }

        return true;
    });



    const fetchUserRds = async (userId: string) => {
        // if (userRds[userId]) return; // Cache hits removed to ensure freshness

        setLoadingRds(prev => ({ ...prev, [userId]: true }));
        try {
            const q = query(collection(db, "users", userId, "rds"));
            const snapshot = await getDocs(q);
            console.log(`[FetchRDs] User: ${userId}`, snapshot.docs.map(d => d.data()));
            const rds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RDData));
            setUserRds(prev => ({ ...prev, [userId]: rds }));

            // Fetch Assignments
            const assignRef = doc(db, "users", userId, "settings", "rd_assignments");
            const assignSnap = await getDoc(assignRef);
            if (assignSnap.exists()) {
                setUserAssignments(prev => ({ ...prev, [userId]: assignSnap.data() as Record<string, string> }));
            } else {
                setUserAssignments(prev => ({ ...prev, [userId]: {} }));
            }
        } catch (error) {
            console.error("Error fetching RDs:", error);
        } finally {
            setLoadingRds(prev => ({ ...prev, [userId]: false }));
        }
    };

    const toggleExpand = (userId: string) => {
        if (expandedUserId !== userId) {
            fetchUserRds(userId);
            setExpandedUserId(userId);
        } else {
            setExpandedUserId(null);
        }
    };

    if (viewingRefunds) {
        return (
            <Refunds
                viewMode={true}
                isAdmin={true}
                initialData={viewingRefunds.rd}
                userName={viewingRefunds.userName}
                onBack={() => setViewingRefunds(null)}
            />
        );
    }

    if (viewingRD) {
        return (
            <Timesheet
                viewMode={true}
                initialData={viewingRD}
                onBack={() => setViewingRD(null)}
            />
        );

    }

    return (
        <div className="flex flex-col h-full gap-6">
            <UserDetailsModal
                isOpen={!!viewingUserDetail}
                onClose={() => setViewingUserDetail(null)}
                userId={viewingUserDetail?.id || ""}
                userName={viewingUserDetail?.fullName || viewingUserDetail?.razaoSocial || ""}
            />

            {/* Modal for User Config */}
            {/* Modal for User Config */}
            {editingUser && (
                <UserConfigModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSave={async (userId, data) => {
                        await handleSaveUserConfig(userId, data);
                        setEditingUser(null);
                    }}
                />
            )}

            {/* ... Header ... */}
            {/* Header & Filters */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <span className="material-symbols-rounded text-blue-600">admin_panel_settings</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Administrativo</h2>
                        <p className="text-sm text-gray-500">Gerencie usuários e relatórios</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full xl:w-auto items-end">
                    {/* Row 1: Search Input */}
                    <div className="relative w-full md:w-80">
                        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        />
                    </div>

                    {/* Row 2: Period Selects */}
                    <div className="flex gap-2 w-full md:w-80 justify-end">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        >
                            <option value={-1}>Todos os Meses</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {/* Row 3: Advanced Filters Controls */}
                    <div className="flex gap-2 items-center flex-wrap justify-end">
                        <button
                            onClick={() => setFilterRDPending(!filterRDPending)}
                            disabled={selectedMonth === -1}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${filterRDPending
                                ? "bg-amber-100 text-amber-700 border-amber-200 shadow-inner"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                }`}
                        >
                            RD Pendente
                        </button>
                        <button
                            onClick={() => setFilterNFPending(!filterNFPending)}
                            disabled={selectedMonth === -1}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${filterNFPending
                                ? "bg-red-100 text-red-700 border-red-200 shadow-inner"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                }`}
                        >
                            NF Pendente
                        </button>

                        {/* Value Filter */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowValueFilter(!showValueFilter); setShowHoursFilter(false); setShowDaysFilter(false); }}
                                disabled={selectedMonth === -1}
                                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 ${filterValue.min || filterValue.max
                                    ? "bg-blue-100 text-blue-700 border-blue-200"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    }`}
                            >
                                Valor
                                <span className="material-symbols-rounded text-[14px]">expand_more</span>
                            </button>
                            {showValueFilter && (
                                <div className="absolute top-full right-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-gray-100 z-20 w-48 flex flex-col gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Intervalo (R$)</span>
                                    <input
                                        type="number"
                                        placeholder="Mín"
                                        value={filterValue.min}
                                        onChange={e => setFilterValue(prev => ({ ...prev, min: e.target.value }))}
                                        className="p-1.5 text-sm border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Máx"
                                        value={filterValue.max}
                                        onChange={e => setFilterValue(prev => ({ ...prev, max: e.target.value }))}
                                        className="p-1.5 text-sm border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Hours Filter */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowHoursFilter(!showHoursFilter); setShowValueFilter(false); setShowDaysFilter(false); }}
                                disabled={selectedMonth === -1}
                                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 ${filterHours.min || filterHours.max
                                    ? "bg-purple-100 text-purple-700 border-purple-200"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    }`}
                            >
                                Horas
                                <span className="material-symbols-rounded text-[14px]">expand_more</span>
                            </button>
                            {showHoursFilter && (
                                <div className="absolute top-full right-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-gray-100 z-20 w-48 flex flex-col gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Intervalo (Horas)</span>
                                    <input
                                        type="number"
                                        placeholder="Mín"
                                        value={filterHours.min}
                                        onChange={e => setFilterHours(prev => ({ ...prev, min: e.target.value }))}
                                        className="p-1.5 text-sm border rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-100 outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Máx"
                                        value={filterHours.max}
                                        onChange={e => setFilterHours(prev => ({ ...prev, max: e.target.value }))}
                                        className="p-1.5 text-sm border rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-100 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Days Filter */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowDaysFilter(!showDaysFilter); setShowValueFilter(false); setShowHoursFilter(false); }}
                                disabled={selectedMonth === -1}
                                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 ${filterDays.min || filterDays.max
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    }`}
                            >
                                Dias
                                <span className="material-symbols-rounded text-[14px]">expand_more</span>
                            </button>
                            {showDaysFilter && (
                                <div className="absolute top-full right-0 mt-2 p-3 bg-white rounded-xl shadow-xl border border-gray-100 z-20 w-48 flex flex-col gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Intervalo (Dias)</span>
                                    <input
                                        type="number"
                                        placeholder="Mín"
                                        value={filterDays.min}
                                        onChange={e => setFilterDays(prev => ({ ...prev, min: e.target.value }))}
                                        className="p-1.5 text-sm border rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-100 outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Máx"
                                        value={filterDays.max}
                                        onChange={e => setFilterDays(prev => ({ ...prev, max: e.target.value }))}
                                        className="p-1.5 text-sm border rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-100 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Operation Filter */}
                        <select
                            value={filterOperation}
                            onChange={(e) => setFilterOperation(e.target.value)}
                            disabled={selectedMonth === -1}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Todas Operações</option>
                            {operationsList.map(op => (
                                <option key={op} value={op}>{op}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                {/* ... Table ... */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800">Profissionais Cadastrados</h3>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <span className="animate-spin material-symbols-rounded text-3xl text-blue-600">progress_activity</span>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500">
                            {error}
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="p-4 pl-6">Nome Completo</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">CNPJ</th>
                                    <th className="p-4">Tipo de Contratação</th>
                                    <th className="p-4">Permissão</th>
                                    <th className="p-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map((user) => (
                                    <React.Fragment key={user.id}>
                                        <tr className={`transition-colors ${expandedUserId === user.id ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                                            <td className="p-4 pl-6 font-medium text-gray-800">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingUserDetail(user);
                                                    }}
                                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                                >
                                                    {user.fullName || user.razaoSocial || "Não informado"}
                                                </button>
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {user.email}
                                            </td>
                                            <td className="p-4 text-gray-600 font-mono text-xs">
                                                {user.cnpj || "-"}
                                            </td>
                                            <td className="p-4">
                                                <span className={`
                                                    px-2.5 py-1 rounded-lg text-xs font-semibold
                                                    ${user.contractType === 'CLT'
                                                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                                                    }
                                                `}>
                                                    {user.contractType || "PJ"}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`
                                                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                                    ${user.role === 'admin'
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                        : 'bg-gray-100 text-gray-600 border-gray-200'
                                                    }
                                                `}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'admin' ? 'bg-indigo-500' : 'bg-gray-400'}`}></span>
                                                    {user.role === 'admin' ? 'Administrador' : 'Profissional'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setEditingUser(user)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                        title="Configurações"
                                                    >
                                                        <span className="material-symbols-rounded text-[20px]">settings</span>
                                                    </button>
                                                    <button
                                                        onClick={() => archiveUser(user)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                        title="Arquivar Usuário"
                                                    >
                                                        <span className="material-symbols-rounded text-[20px]">delete</span>
                                                    </button>
                                                    <button
                                                        onClick={() => toggleExpand(user.id)}
                                                        className={`
                                                            p-1.5 rounded-xl transition-all
                                                            ${expandedUserId === user.id
                                                                ? 'bg-blue-100 text-blue-600 rotate-180'
                                                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                                            }
                                                        `}
                                                        title={expandedUserId === user.id ? "Recolher" : "Expandir"}
                                                    >
                                                        <span className="material-symbols-rounded text-[20px]">expand_more</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedUserId === user.id && (
                                            <tr className="bg-gray-50/50">
                                                <td colSpan={6} className="p-4 sm:p-6">
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                                        {(() => {
                                                            const rds = userRds[user.id] || [];
                                                            const monthsToShow = selectedMonth === -1
                                                                ? Array.from({ length: 12 }, (_, i) => i)
                                                                : [selectedMonth];

                                                            // 1. Prepare data
                                                            const rowsData = monthsToShow.map(monthIndex => {
                                                                const rd = rds.find(r => r.month === monthIndex && r.year === selectedYear);
                                                                const assignedOp = userAssignments[user.id]?.[`${selectedYear}-${monthIndex}`];
                                                                const displayOp = rd?.operation || assignedOp;

                                                                // Calculate date string
                                                                const dateStr = (() => {
                                                                    const timestamp = rd?.updatedAt || rd?.createdAt;
                                                                    if (!timestamp) return '';
                                                                    if (typeof timestamp === 'object' && 'seconds' in timestamp) {
                                                                        return new Date((timestamp as { seconds: number }).seconds * 1000).toLocaleDateString('pt-BR');
                                                                    }
                                                                    return new Date(timestamp as unknown as string).toLocaleDateString('pt-BR');
                                                                })();

                                                                return { monthIndex, rd, dateStr, displayOp };
                                                            });

                                                            if (loadingRds[user.id]) {
                                                                return (
                                                                    <div className="p-6 text-center">
                                                                        <span className="animate-spin material-symbols-rounded text-xl text-blue-600">progress_activity</span>
                                                                    </div>
                                                                );
                                                            }

                                                            // 2. Check for columns existence in ANY of the rows
                                                            const showCaixa = rowsData.some(row => row.rd?.refunds?.some(r => r.type === 'CAIXA'));
                                                            const showCombustivel = rowsData.some(row => row.rd?.refunds?.some(r => r.type === 'COMBUSTIVEL'));

                                                            return (
                                                                <table className="w-full text-left text-xs">
                                                                    <thead className="bg-gray-100 text-gray-500 font-semibold border-b border-gray-200">
                                                                        <tr>
                                                                            <th className="p-3">Mês</th>
                                                                            <th className="p-3">Ano</th>
                                                                            <th className="p-3">Dias</th>
                                                                            <th className="p-3">Horas</th>
                                                                            <th className="p-3">Valor</th>
                                                                            <th className="p-3">RD</th>
                                                                            <th className="p-3">NF</th>
                                                                            <th className="p-3">Operação</th>
                                                                            {showCaixa && <th className="p-3">Caixa</th>}
                                                                            {showCombustivel && <th className="p-3">Combustível</th>}
                                                                            <th className="p-3 w-10"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {rowsData.map(({ monthIndex, rd, dateStr, displayOp }) => {
                                                                            // Calculate refunds for this row
                                                                            const caixaRefunds = rd?.refunds?.filter(r => r.type === 'CAIXA') || [];
                                                                            const combustivelRefunds = rd?.refunds?.filter(r => r.type === 'COMBUSTIVEL') || [];

                                                                            const totalCaixa = caixaRefunds.reduce((acc, curr) => acc + curr.value, 0);
                                                                            const totalCombustivel = combustivelRefunds.reduce((acc, curr) => acc + curr.value, 0);

                                                                            // Unique sub-operations for display
                                                                            const caixaCtes = Array.from(new Set(caixaRefunds.map(r => r.subOperation?.obra).filter(Boolean)));
                                                                            const combCtes = Array.from(new Set(combustivelRefunds.map(r => r.subOperation?.obra).filter(Boolean)));

                                                                            return (
                                                                                <tr key={monthIndex} className={rd ? "bg-green-50/30" : ""}>
                                                                                    <td className="p-3 text-gray-700">{MONTHS[monthIndex]}</td>
                                                                                    <td className="p-3 text-gray-700">{selectedYear}</td>
                                                                                    <td className="p-3 text-gray-600 text-xs">
                                                                                        {rd && rd.daysWorked !== undefined ? `${rd.daysWorked} dias` : '-'}
                                                                                    </td>
                                                                                    <td className="p-3 text-gray-600 text-xs">
                                                                                        {rd && rd.totalMinutes !== undefined ? `${Math.floor(rd.totalMinutes / 60)}h ${rd.totalMinutes % 60}m` : '-'}
                                                                                    </td>
                                                                                    <td className="p-3 text-xs font-medium text-green-600">
                                                                                        {rd?.invoiceData?.value || '-'}
                                                                                    </td>

                                                                                    <td className="p-3 text-xs font-medium">
                                                                                        {rd && rd.status === 'submitted' ? (
                                                                                            <button
                                                                                                onClick={() => rd && setViewingRD(rd)}
                                                                                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                                                            >
                                                                                                Recebida em {dateStr}
                                                                                            </button>
                                                                                        ) : rd && (rd.status === 'draft' || rd.status === 'assigned') ? (
                                                                                            <span className="text-amber-500 font-normal">Em andamento</span>
                                                                                        ) : (
                                                                                            <span className="text-gray-400 font-normal italic">Pendente</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-3 text-xs font-medium">
                                                                                        {rd && rd.status === 'submitted' ? (
                                                                                            rd.invoiceUrl ? (
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <a
                                                                                                        href={rd.invoiceUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className={`hover:underline ${rd.invoiceRejected ? "text-red-500 font-bold" : "text-blue-600 hover:text-blue-800"}`}
                                                                                                    >
                                                                                                        {rd.invoiceRejected ? "NF Rejeitada" : `NF Recebida em ${dateStr}`}
                                                                                                    </a>
                                                                                                    <button
                                                                                                        onClick={() => deleteInvoice(user.id, rd.id)}
                                                                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                                                                        title="Excluir Nota Fiscal"
                                                                                                    >
                                                                                                        <span className="material-symbols-rounded text-sm">close</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="text-gray-500">Sem NF</span>
                                                                                            )
                                                                                        ) : (
                                                                                            <span className="text-amber-600">pendente</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-3">
                                                                                        {editingOp?.userId === user.id && editingOp.month === monthIndex ? (
                                                                                            <select
                                                                                                value={displayOp || ""}
                                                                                                onChange={(e) => {
                                                                                                    handleSetOperation(user.id, selectedYear, monthIndex, e.target.value);
                                                                                                    setEditingOp(null);
                                                                                                }}
                                                                                                onBlur={() => setEditingOp(null)}
                                                                                                autoFocus
                                                                                                className="w-full p-1 bg-white border border-blue-500 rounded text-xs outline-none"
                                                                                            >
                                                                                                <option value="">Selecione...</option>
                                                                                                {operationsList.map(op => (
                                                                                                    <option key={op} value={op}>{op}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                        ) : (
                                                                                            <div
                                                                                                onClick={() => setEditingOp({ userId: user.id, month: monthIndex })}
                                                                                                className="cursor-pointer hover:bg-gray-100 p-1 rounded group flex items-center justify-between"
                                                                                            >
                                                                                                <span className={displayOp ? "text-gray-700 font-medium" : "text-gray-400 italic"}>
                                                                                                    {displayOp || "Atribuir"}
                                                                                                </span>
                                                                                                <span className="material-symbols-rounded text-[14px] text-gray-400 opacity-0 group-hover:opacity-100">edit</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </td>

                                                                                    {/* CAIXA COLUMN */}
                                                                                    {showCaixa && (
                                                                                        <td className="p-3">
                                                                                            {caixaRefunds.length > 0 ? (
                                                                                                <div className="flex flex-col">
                                                                                                    <button
                                                                                                        onClick={() => rd && setViewingRefunds({ rd, userName: user.fullName || "Usuário" })}
                                                                                                        className="text-blue-600 hover:underline font-bold text-left text-xs mb-0.5"
                                                                                                    >
                                                                                                        Caixa
                                                                                                    </button>
                                                                                                    <span className="font-semibold text-gray-700 text-xs text-[11px]">
                                                                                                        {formatCurrency(totalCaixa)}
                                                                                                    </span>
                                                                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                                                                        {caixaCtes.map(cte => (
                                                                                                            <span key={cte} className="text-[9px] text-gray-500 leading-tight truncate max-w-[100px]" title={cte}>
                                                                                                                {cte}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : <span className="text-gray-300">-</span>}
                                                                                        </td>
                                                                                    )}

                                                                                    {/* COMBUSTIVEL COLUMN */}
                                                                                    {showCombustivel && (
                                                                                        <td className="p-3">
                                                                                            {combustivelRefunds.length > 0 ? (
                                                                                                <div className="flex flex-col">
                                                                                                    <button
                                                                                                        onClick={() => rd && setViewingRefunds({ rd, userName: user.fullName || "Usuário" })}
                                                                                                        className="text-blue-600 hover:underline font-bold text-left text-xs mb-0.5"
                                                                                                    >
                                                                                                        Combustível
                                                                                                    </button>
                                                                                                    <span className="font-semibold text-gray-700 text-xs text-[11px]">
                                                                                                        {formatCurrency(totalCombustivel)}
                                                                                                    </span>
                                                                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                                                                        {combCtes.map(cte => (
                                                                                                            <span key={cte} className="text-[9px] text-gray-500 leading-tight truncate max-w-[100px]" title={cte}>
                                                                                                                {cte}
                                                                                                            </span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : <span className="text-gray-300">-</span>}
                                                                                        </td>
                                                                                    )}

                                                                                    <td className="p-3 text-right">
                                                                                        {rd && (
                                                                                            <button
                                                                                                onClick={() => deleteRD(user.id, rd.id)}
                                                                                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                                                                title="Excluir RD"
                                                                                            >
                                                                                                <span className="material-symbols-rounded text-[18px]">delete</span>
                                                                                            </button>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        {users.length === 0 && (
                                                                            <tr>
                                                                                <td colSpan={4} className="p-8 text-center text-gray-400">
                                                                                    Nenhum usuário encontrado.
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400">
                                            Nenhum usuário encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            {/* Simple Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type="danger"
                confirmText="Confirmar Exclusão"
            />

            {/* Batch Confirmation Modal */}
            {batchModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scaleIn">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Aplicar em Lote?</h3>
                        <p className="text-gray-600 mb-4">
                            Deseja aplicar a operação <strong>{batchModal.operation}</strong> para o usuário <strong>{batchModal.userName}</strong> nos seguintes meses?
                        </p>
                        <div className="bg-gray-50 p-3 rounded-xl mb-6 max-h-48 overflow-y-auto border border-gray-100">
                            <ul className="space-y-1 text-sm text-gray-600">
                                {Array.from({ length: 12 - (batchModal.startMonth + 1) }, (_, i) => batchModal.startMonth + 1 + i).map(m => (
                                    <li key={m} className="flex items-center gap-2">
                                        <span className="material-symbols-rounded text-green-500 text-sm">check_circle</span>
                                        {MONTHS[m]}
                                    </li>
                                ))}
                                {Array.from({ length: 12 - (batchModal.startMonth + 1) }).length === 0 && (
                                    <li className="text-amber-600 italic">Nenhum mês futuro disponível neste ano.</li>
                                )}
                            </ul>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setBatchModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmBatch}
                                disabled={Array.from({ length: 12 - (batchModal.startMonth + 1) }).length === 0}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirmar e Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
