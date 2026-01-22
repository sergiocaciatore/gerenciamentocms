import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import ConfirmationModal from '../../components/ConfirmationModal';
import axios from 'axios';

interface Recipient {
    email: string;
    name: string;
}

interface ScheduledEmail {
    id: string;
    title: string;
    date: string;
    time: string; // HH:mm
    body: string;
    senderEmail?: string;
    senderPassword?: string;
    recipients: Recipient[]; // Multiple recipients
    recurrence?: 'none' | 'weekly' | 'biweekly' | 'monthly';
    lastSentAt?: string; // ISO timestamp
    isEditing: boolean;
    isNew?: boolean;
}

interface UserSummary {
    id: string;
    email: string;
    fullName?: string;
}

export default function EmailConfigPage() {
    const [emails, setEmails] = useState<ScheduledEmail[]>([]);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [backupEmails, setBackupEmails] = useState<Record<string, ScheduledEmail>>({});
    const [visibleSenderConfig, setVisibleSenderConfig] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});

    // User Selection Modal State
    const [userSelectModal, setUserSelectModal] = useState<{
        isOpen: boolean;
        targetEmailId: string | null;
        selectedRecipients: Recipient[]; // Temporary selection in modal
    }>({
        isOpen: false,
        targetEmailId: null,
        selectedRecipients: []
    });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
    });

    // Fetch Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Users
                const usersSnap = await getDocs(collection(db, "users"));
                const userList: UserSummary[] = usersSnap.docs.map(doc => ({
                    id: doc.id,
                    email: doc.data().email,
                    fullName: doc.data().fullName || doc.data().razaoSocial || doc.data().email
                }));
                // Sort users alphabetically
                userList.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
                setUsers(userList);

                // Fetch Emails
                const emailsSnap = await getDocs(collection(db, "scheduled_emails"));
                const emailList: ScheduledEmail[] = emailsSnap.docs.map(doc => {
                    const data = doc.data();

                    // Migration / Compatibility check
                    const recipients: Recipient[] = data.recipients || [];
                    if (recipients.length === 0 && data.recipientEmail) {
                        recipients.push({
                            email: data.recipientEmail,
                            name: data.recipientName || data.recipientEmail
                        });
                    }

                    return {
                        id: doc.id,
                        ...data,
                        recipients: recipients,
                        isEditing: false
                    } as ScheduledEmail;
                });

                // Sort dates descending
                emailList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setEmails(emailList);
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleNewEmail = () => {
        const newTempId = "new_" + Date.now().toString();
        const newEmail: ScheduledEmail = {
            id: newTempId,
            title: '',
            date: '',
            time: '08:00', // Default time
            body: '',
            recipients: [],
            recurrence: 'none',
            isEditing: true,
            isNew: true
        };
        setEmails([newEmail, ...emails]);
    };

    const confirmDelete = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Excluir Agendamento",
            message: "Tem certeza que deseja excluir este email agendado? Essa ação não pode ser desfeita.",
            onConfirm: () => handleDelete(id)
        });
    };

    const handleDelete = async (id: string) => {
        // Optimistic update
        setEmails(prev => prev.filter(e => e.id !== id));
        setConfirmModal({ ...confirmModal, isOpen: false });

        if (!id.startsWith("new_")) {
            try {
                await deleteDoc(doc(db, "scheduled_emails", id));
            } catch (error) {
                console.error("Error deleting doc:", error);
                alert("Erro ao excluir do banco de dados.");
            }
        }
    };

    const handleEdit = (id: string) => {
        const emailToEdit = emails.find(e => e.id === id);
        if (emailToEdit) {
            setBackupEmails(prev => ({ ...prev, [id]: JSON.parse(JSON.stringify(emailToEdit)) }));
        }
        setEmails(prev => prev.map(e => e.id === id ? { ...e, isEditing: true } : e));
    };

    const handleCancel = (id: string) => {
        const email = emails.find(e => e.id === id);
        if (!email) return;

        if (email.isNew) {
            setEmails(prev => prev.filter(e => e.id !== id));
        } else {
            const backup = backupEmails[id];
            if (backup) {
                setEmails(prev => prev.map(e => e.id === id ? { ...backup, isEditing: false } : e));
                const newBackups = { ...backupEmails };
                delete newBackups[id];
                setBackupEmails(newBackups);
            } else {
                setEmails(prev => prev.map(e => e.id === id ? { ...e, isEditing: false } : e));
            }
        }
    };

    const handleSave = async (id: string) => {
        const email = emails.find(e => e.id === id);
        if (!email) return;

        if (!email.title) return alert("Título é obrigatório");
        if (email.recipients.length === 0) return alert("Selecione pelo menos um destinatário");

        // Optimistic update UI
        setEmails(prev => prev.map(e => e.id === id ? { ...e, isEditing: false, isNew: false } : e));

        // Remove backup
        const newBackups = { ...backupEmails };
        delete newBackups[id];
        setBackupEmails(newBackups);

        try {
            const docData = {
                title: email.title,
                date: email.date,
                time: email.time || '08:00',
                body: email.body,
                senderEmail: email.senderEmail || null,
                senderPassword: email.senderPassword || null,
                recipients: email.recipients,
                recurrence: email.recurrence || 'none',
                lastSentAt: email.lastSentAt || null,
                updatedAt: new Date().toISOString(),
                updatedBy: auth.currentUser?.uid || 'unknown',
                status: 'pending' // Reset status on edit
            };

            if (id.startsWith("new_")) {
                const docRef = await addDoc(collection(db, "scheduled_emails"), {
                    ...docData,
                    createdAt: new Date().toISOString()
                });
                // Update local ID with real Firestore ID
                setEmails(prev => prev.map(e => e.id === id ? { ...e, id: docRef.id } : e));
            } else {
                await setDoc(doc(db, "scheduled_emails", id), docData, { merge: true });
            }
        } catch (error) {
            console.error("Error saving email:", error);
            alert("Erro ao salvar. Verifique o console.");
        }
    };

    const handleChange = (id: string, field: keyof ScheduledEmail, value: string) => {
        setEmails(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const toggleSenderConfig = (id: string) => {
        setVisibleSenderConfig(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- User Selection Modal Logic ---

    const openUserSelect = (id: string) => {
        const email = emails.find(e => e.id === id);
        if (!email) return;
        setUserSelectModal({
            isOpen: true,
            targetEmailId: id,
            selectedRecipients: [...email.recipients]
        });
    };

    const toggleUserInModal = (user: UserSummary) => {
        const currentSelected = userSelectModal.selectedRecipients;
        const exists = currentSelected.find(r => r.email === user.email);

        if (exists) {
            // Remove
            setUserSelectModal(prev => ({
                ...prev,
                selectedRecipients: currentSelected.filter(r => r.email !== user.email)
            }));
        } else {
            // Add
            setUserSelectModal(prev => ({
                ...prev,
                selectedRecipients: [...currentSelected, { email: user.email, name: user.fullName || user.email }]
            }));
        }
    };

    const saveModalSelection = () => {
        if (!userSelectModal.targetEmailId) return;
        const id = userSelectModal.targetEmailId;

        setEmails(prev => prev.map(e => e.id === id ? {
            ...e,
            recipients: userSelectModal.selectedRecipients
        } : e));

        setUserSelectModal({ isOpen: false, targetEmailId: null, selectedRecipients: [] });
    };

    // --- End User Selection Logic ---

    const handleSendTest = async (email: ScheduledEmail) => {
        if (email.recipients.length === 0 || !email.title || !email.body) {
            return alert("Preencha destinatários, título e corpo para enviar.");
        }

        setSendingMap(prev => ({ ...prev, [email.id]: true }));

        try {
            const token = await auth.currentUser?.getIdToken();
            const payload = {
                recipients: email.recipients,
                subject: email.title,
                body: email.body,
                sender_email: email.senderEmail,
                sender_password: email.senderPassword
            };

            await axios.post(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/send-custom-email`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert("Emails enviados com sucesso!");
        } catch (error) {
            console.error("Erro ao enviar:", error);
            if (axios.isAxiosError(error)) {
                alert(`Falha no envio: ${error.response?.data?.detail || error.message}`);
            } else {
                alert("Erro desconhecido ao enviar email.");
            }
        } finally {
            setSendingMap(prev => ({ ...prev, [email.id]: false }));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col p-6 h-full max-w-5xl mx-auto w-full relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Agendamento de Emails</h2>
                    <p className="text-gray-500">Gerencie os emails automáticos do sistema.</p>
                </div>
                <button
                    onClick={handleNewEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                    <span className="material-symbols-rounded">add</span>
                    Novo Email
                </button>
            </div>

            {/* List */}
            <div className="space-y-6">
                {emails.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-300">
                        <span className="material-symbols-rounded text-4xl text-gray-300 mb-2">upcoming</span>
                        <p className="text-gray-500">Nenhum email agendado.</p>
                        <p className="text-sm text-gray-400">Clique em "Novo Email" para começar.</p>
                    </div>
                )}

                {emails.map((email) => {
                    return (
                        <div key={email.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-scale-in relative">
                            <div className="p-6 space-y-4">
                                {/* Top Row: Title (50%) & Recipient (50%) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Title */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Título do Email</label>
                                        <input
                                            type="text"
                                            value={email.title}
                                            disabled={!email.isEditing}
                                            onChange={(e) => handleChange(email.id, 'title', e.target.value)}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 transition-all font-medium text-gray-800"
                                            placeholder="Ex: Lembrete Mensal"
                                        />
                                    </div>

                                    {/* Recipient Selection - MULTIPLE */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            Destinatários ({email.recipients.length})
                                        </label>

                                        <div
                                            onClick={() => email.isEditing && openUserSelect(email.id)}
                                            className={`w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl min-h-[46px] flex flex-wrap gap-1 relative ${email.isEditing ? 'cursor-pointer hover:bg-gray-100 hover:border-blue-300' : 'cursor-default bg-gray-100'}`}
                                        >
                                            {email.recipients.length === 0 ? (
                                                <span className="text-gray-400 text-sm self-center">Selecione os destinatários...</span>
                                            ) : (
                                                email.recipients.slice(0, 3).map((r, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800">
                                                        {r.name.split(' ')[0]}
                                                    </span>
                                                ))
                                            )}
                                            {email.recipients.length > 3 && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-700">
                                                    +{email.recipients.length - 3}
                                                </span>
                                            )}

                                            {email.isEditing && (
                                                <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">arrow_drop_down</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Second Row: Date (50%) & Time (50%) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Date */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data</label>
                                        <input
                                            type="date"
                                            value={email.date}
                                            disabled={!email.isEditing}
                                            onChange={(e) => handleChange(email.id, 'date', e.target.value)}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 transition-all font-medium text-gray-800"
                                        />
                                    </div>

                                    {/* Time - IMPROVED VISIBILITY */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Hora do Envio</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                                <span className="material-symbols-rounded text-lg">schedule</span>
                                            </span>
                                            <input
                                                type="time"
                                                value={email.time || "08:00"}
                                                disabled={!email.isEditing}
                                                onChange={(e) => handleChange(email.id, 'time', e.target.value)}
                                                className="w-full p-2.5 pl-10 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 transition-all font-bold text-lg text-gray-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Recurrence Field */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Recorrência</label>
                                    <select
                                        value={email.recurrence || 'none'}
                                        disabled={!email.isEditing}
                                        onChange={(e) => handleChange(email.id, 'recurrence', e.target.value)}
                                        className="w-full md:w-1/2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 transition-all font-medium text-gray-800"
                                    >
                                        <option value="none">Nenhuma (Envio único)</option>
                                        <option value="weekly">Semanal</option>
                                        <option value="biweekly">Quinzenal</option>
                                        <option value="monthly">Mensal</option>
                                    </select>
                                </div>

                                {/* Recurrence Info - Show when recurrence is active */}
                                {email.recurrence && email.recurrence !== 'none' && (
                                    <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-rounded text-purple-600">schedule_send</span>
                                            <h4 className="font-bold text-purple-900 text-sm">Email Recorrente</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <span className="text-gray-600 font-medium">Último email enviado:</span>
                                                <p className="font-bold text-gray-800 mt-1">
                                                    {email.lastSentAt
                                                        ? new Date(email.lastSentAt).toLocaleString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })
                                                        : 'Ainda não enviado'
                                                    }
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-gray-600 font-medium">Próximo envio em:</span>
                                                <p className="font-bold text-purple-700 mt-1">
                                                    {(() => {
                                                        const baseDate = email.lastSentAt
                                                            ? new Date(email.lastSentAt)
                                                            : new Date(`${email.date}T${email.time || '08:00'}`);

                                                        const nextDate = new Date(baseDate);

                                                        if (email.recurrence === 'weekly') {
                                                            nextDate.setDate(nextDate.getDate() + 7);
                                                        } else if (email.recurrence === 'biweekly') {
                                                            nextDate.setDate(nextDate.getDate() + 14);
                                                        } else if (email.recurrence === 'monthly') {
                                                            nextDate.setMonth(nextDate.getMonth() + 1);
                                                        }

                                                        return nextDate.toLocaleString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        });
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Toggle Sender Config */}
                                <div>
                                    <button
                                        onClick={() => toggleSenderConfig(email.id)}
                                        className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline"
                                    >
                                        <span className="material-symbols-rounded text-base">
                                            {visibleSenderConfig[email.id] ? 'expand_less' : 'expand_more'}
                                        </span>
                                        {visibleSenderConfig[email.id] ? "Ocultar configuração de origem" : "Configurar email de origem"}
                                    </button>

                                    {/* Sender Config Section */}
                                    {visibleSenderConfig[email.id] && (
                                        <div className="mt-2 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email de Origem</label>
                                                <input
                                                    type="email"
                                                    value={email.senderEmail || ''}
                                                    disabled={!email.isEditing}
                                                    onChange={(e) => handleChange(email.id, 'senderEmail', e.target.value)}
                                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                                                    placeholder="ex: contato@empresa.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Senha SMTP</label>
                                                <input
                                                    type="password"
                                                    value={email.senderPassword || ''}
                                                    disabled={!email.isEditing}
                                                    onChange={(e) => handleChange(email.id, 'senderPassword', e.target.value)}
                                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Body */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Corpo do Email</label>
                                    <textarea
                                        value={email.body}
                                        disabled={!email.isEditing}
                                        onChange={(e) => handleChange(email.id, 'body', e.target.value)}
                                        rows={6}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 transition-all font-medium text-gray-800 resize-none font-sans"
                                        placeholder="Digite o conteúdo da mensagem..."
                                    />
                                </div>

                                {/* Action Bar */}
                                <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
                                    {email.isEditing ? (
                                        <>
                                            <button
                                                onClick={() => handleCancel(email.id)}
                                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-bold rounded-xl transition-colors text-sm"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={() => handleSave(email.id)}
                                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 text-sm"
                                            >
                                                <span className="material-symbols-rounded">save</span>
                                                Salvar
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => confirmDelete(email.id)}
                                                className="px-4 py-2 text-red-500 hover:bg-red-50 font-bold rounded-xl transition-all flex items-center gap-2 text-sm mr-auto"
                                            >
                                                <span className="material-symbols-rounded">delete</span>
                                                Excluir
                                            </button>

                                            <button
                                                onClick={() => handleSendTest(email)}
                                                disabled={sendingMap[email.id]}
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-wait"
                                            >
                                                {sendingMap[email.id] ? (
                                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                ) : (
                                                    <span className="material-symbols-rounded">send</span>
                                                )}
                                                {sendingMap[email.id] ? "Enviando..." : "Enviar Agora"}
                                            </button>

                                            <button
                                                onClick={() => handleEdit(email.id)}
                                                className="px-4 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2 text-sm"
                                            >
                                                <span className="material-symbols-rounded">edit</span>
                                                Editar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* User Selection Modal - MULTI SELECT */}
            {userSelectModal.isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setUserSelectModal({ ...userSelectModal, isOpen: false })}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col relative z-10 animate-scale-in">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Selecionar Destinatários</h3>
                                <p className="text-sm text-gray-500">{userSelectModal.selectedRecipients.length} selecionados</p>
                            </div>
                            <button onClick={() => setUserSelectModal({ ...userSelectModal, isOpen: false })} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>

                        {/* Search could be added here */}

                        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar flex-1">
                            {users.length === 0 ? (
                                <p className="text-center py-4 text-gray-500">Nenhum usuário encontrado.</p>
                            ) : (
                                users.map(user => {
                                    const isSelected = userSelectModal.selectedRecipients.some(r => r.email === user.email);
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => toggleUserInModal(user)}
                                            className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 cursor-pointer border ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-gray-50 border-transparent'}`}
                                        >
                                            {/* Checkbox Visual */}
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                                {isSelected && <span className="material-symbols-rounded text-white text-sm">check</span>}
                                            </div>

                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0 uppercase">
                                                {user.fullName ? user.fullName[0] : user.email[0]}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`font-bold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>{user.fullName || "Sem Nome"}</p>
                                                <p className="text-gray-500 text-xs truncate">{user.email}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
                            <button
                                onClick={() => setUserSelectModal({ ...userSelectModal, isOpen: false })}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 font-bold rounded-xl transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveModalSelection}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                            >
                                Confirmar Seleção
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type="danger"
                confirmText="Excluir"
            />
        </div>
    );
}
