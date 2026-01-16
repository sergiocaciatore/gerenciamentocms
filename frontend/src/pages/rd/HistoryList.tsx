import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import ConfirmationModal from "../../components/ConfirmationModal";
import Timesheet from './Timesheet';
import type { RDData } from './MyRDs';

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

export default function HistoryList() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [viewingRD, setViewingRD] = useState<RDData | null>(null);
    const [userRds, setUserRds] = useState<Record<string, RDData[]>>({});
    const [selectedYear, setSelectedYear] = useState(2025);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'restore' | 'delete';
    }>({ isOpen: false, title: "", message: "", onConfirm: () => { }, type: 'restore' });

    useEffect(() => {
        const fetchArchivedUsers = async () => {
            try {
                const q = query(collection(db, "users"));
                const querySnapshot = await getDocs(q);

                const usersList = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as UserData))
                    .filter(u => u.archived === true);

                setUsers(usersList);
            } catch (error) {
                console.error("Error fetching archived users:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchArchivedUsers();
    }, []);

    const fetchUserRds = async (userId: string) => {
        if (userRds[userId]) return;

        try {
            const q = query(collection(db, "users", userId, "rds"));
            const snapshot = await getDocs(q);
            const rds = snapshot.docs.map(doc => {
                const data = doc.data();
                let year = data.year;
                let month = data.month;
                // Polyfill if missing
                if (year === undefined || month === undefined) {
                    const parts = doc.id.split('-');
                    if (parts.length === 2) {
                        year = Number(parts[0]);
                        month = Number(parts[1]);
                    }
                }
                return { id: doc.id, ...data, year, month } as RDData;
            });
            setUserRds(prev => ({ ...prev, [userId]: rds }));
        } catch (error) {
            console.error("Error fetching RDs:", error);
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

    const restoreUser = async (user: UserData) => {
        setConfirmModal({
            isOpen: true,
            title: "Restaurar Usuário?",
            message: `O usuário ${user.fullName || user.email} voltará para o painel administrativo.`,
            type: 'restore',
            onConfirm: async () => {
                try {
                    await updateDoc(doc(db, "users", user.id), {
                        archived: false,
                        archivedAt: null,
                        archivedBy: null
                    });
                    setUsers(prev => prev.filter(u => u.id !== user.id));
                } catch (error) {
                    console.error("Error restoring user:", error);
                    alert("Erro ao restaurar usuário.");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const permanentlyDeleteUser = async (user: UserData) => {
        setConfirmModal({
            isOpen: true,
            title: "Excluir Permanentemente?",
            message: `ATENÇÃO: Isso excluirá o usuário ${user.fullName || user.email} e TODOS os seus dados permanentemente. Essa ação NÃO pode ser desfeita.`,
            type: 'delete',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, "users", user.id));
                    setUsers(prev => prev.filter(u => u.id !== user.id));
                } catch (error) {
                    console.error("Error deleting user:", error);
                    alert("Erro ao excluir usuário permanentemente.");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

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
        <div className="flex flex-col h-full gap-6 animate-fadeIn p-4 md:p-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <span className="material-symbols-rounded text-gray-600">history</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Histórico de Usuários</h2>
                        <p className="text-gray-500 text-sm">Usuários e dados arquivados.</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800">Usuários Arquivados</h3>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <span className="animate-spin material-symbols-rounded text-3xl text-gray-400">progress_activity</span>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                            <span className="material-symbols-rounded text-4xl">inventory_2</span>
                            <p>Nenhum usuário arquivado encontrado.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="p-4 pl-6">Nome / Email</th>
                                    <th className="p-4">Arquivado em</th>
                                    <th className="p-4">Por</th>
                                    <th className="p-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map((user) => (
                                    <React.Fragment key={user.id}>
                                        <tr className={`transition-colors ${expandedUserId === user.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                                            <td className="p-4 pl-6">
                                                <div className="font-medium text-gray-800">
                                                    {user.fullName || user.razaoSocial || "Sem Nome"}
                                                </div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </td>
                                            <td className="p-4 text-gray-600 font-mono text-xs">
                                                {user.archivedAt ? new Date(user.archivedAt).toLocaleString() : "-"}
                                            </td>
                                            <td className="p-4 text-gray-600 text-xs">
                                                {user.archivedBy || "-"}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => restoreUser(user)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center gap-1"
                                                        title="Restaurar Usuário"
                                                    >
                                                        <span className="material-symbols-rounded text-[20px]">restore_from_trash</span>
                                                        <span className="text-xs font-semibold">Restaurar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => permanentlyDeleteUser(user)}
                                                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-700 hover:bg-red-50 transition-all flex items-center gap-1"
                                                        title="Excluir Permanentemente"
                                                    >
                                                        <span className="material-symbols-rounded text-[20px]">delete_forever</span>
                                                    </button>
                                                    <button
                                                        onClick={() => toggleExpand(user.id)}
                                                        className={`p-1.5 rounded-xl transition-all ${expandedUserId === user.id ? 'bg-gray-200 text-gray-800 rotate-180' : 'text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        <span className="material-symbols-rounded text-[20px]">expand_more</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedUserId === user.id && (
                                            <tr className="bg-gray-50/50">
                                                <td colSpan={4} className="p-4">
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                                        <div className="p-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                                            <span className="text-xs font-bold text-gray-500 uppercase">Relatórios (RDs)</span>
                                                            <select
                                                                value={selectedYear}
                                                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                                                className="text-xs p-1 rounded border border-gray-300"
                                                            >
                                                                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                                            </select>
                                                        </div>
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-gray-50 text-gray-500">
                                                                <tr>
                                                                    <th className="p-2 pl-4">Período</th>
                                                                    <th className="p-2">Status</th>
                                                                    <th className="p-2">Valor</th>
                                                                    <th className="p-2">Ação</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {(userRds[user.id] || [])
                                                                    .filter(rd => rd.year === selectedYear)
                                                                    .sort((a, b) => b.month - a.month)
                                                                    .map(rd => (
                                                                        <tr key={rd.id}>
                                                                            <td className="p-2 pl-4 font-medium">
                                                                                {MONTHS[rd.month]} / {rd.year}
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${rd.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                                                                                    rd.status === 'Rejeitado' ? 'bg-red-100 text-red-700' :
                                                                                        'bg-yellow-100 text-yellow-700'
                                                                                    }`}>
                                                                                    {rd.status || 'Pendente'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-2 text-gray-600">
                                                                                {rd.invoiceData?.value || "-"}
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <button
                                                                                    onClick={() => setViewingRD(rd)}
                                                                                    className="text-blue-600 hover:underline font-medium"
                                                                                >
                                                                                    Ver Detalhes
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                {!(userRds[user.id] || []).some(rd => rd.year === selectedYear) && (
                                                                    <tr>
                                                                        <td colSpan={4} className="p-4 text-center text-gray-400 italic">
                                                                            Nenhuma RD neste ano.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            {/* Configuration / Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type === 'delete' ? 'danger' : 'success'}
                confirmText="Confirmar"
            />
        </div>
    );
}
