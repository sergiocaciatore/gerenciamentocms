
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

interface UserDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string; // Passed for header display
}

interface SettingsData {
    fullName: string;
    cpf: string;
    rg: string;
    birthDate: string;
    documents: {
        contract?: string;
        cnpjCard?: string;
        cnd?: string;
        cndt?: string;
    };
    // Banking Info
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
    pixKey?: string;
}

interface RegistrationData {
    cnpj: string;
    razaoSocial: string;
}

const DOCUMENTS = [
    { id: "contract", label: "Contrato Social" },
    { id: "cnpjCard", label: "Carta CNPJ" },
    { id: "cnd", label: "Certidão Negativa de Débitos (CND)" },
    { id: "cndt", label: "Certidão Negativa de Débitos Trabalhistas (CNDT)" },
];

export default function UserDetailsModal({ isOpen, onClose, userId, userName }: UserDetailsModalProps) {
    const [formData, setFormData] = useState<SettingsData | null>(null);
    const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && userId) {
            const loadData = async () => {
                setLoading(true);
                try {
                    // Load Settings Profile
                    const profileRef = doc(db, "users", userId, "settings", "profile");
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        setFormData(profileSnap.data() as SettingsData);
                    } else {
                        setFormData(null); // No profile data yet
                    }

                    // Load Registration Data (CNPJ/Razão)
                    const userRef = doc(db, "users", userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        setRegistrationData({
                            cnpj: userData.cnpj || "",
                            razaoSocial: userData.razaoSocial || ""
                        });
                    }
                } catch (error) {
                    console.error("Error loading user details:", error);
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }
    }, [isOpen, userId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            // Optional: Lock body scroll when modal is open
            document.body.style.overflow = "hidden";
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">
                            Detalhes do Usuário
                        </h3>
                        <p className="text-sm text-gray-500">
                            Visualizando dados de: <span className="font-semibold text-gray-700">{userName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <span className="animate-spin material-symbols-rounded text-3xl text-blue-600">progress_activity</span>
                            <span className="text-gray-400 font-medium text-sm">Carregando informações...</span>
                        </div>
                    ) : !formData && !registrationData ? (
                        <div className="text-center py-10 text-gray-500">
                            Nenhum dado encontrado para este usuário.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {/* Dados Pessoais */}
                            <section>
                                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                    <span className="material-symbols-rounded text-blue-500">person</span>
                                    Dados Pessoais
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InfoField label="Nome Completo" value={formData?.fullName} />
                                    <InfoField label="Data de Nascimento" value={formData?.birthDate} />
                                    <InfoField label="CPF" value={formData?.cpf} />
                                    <InfoField label="RG" value={formData?.rg} />
                                </div>
                            </section>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Informações CNPJ */}
                                <section>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                        <span className="material-symbols-rounded text-amber-500">business</span>
                                        Informações CNPJ
                                    </h3>
                                    <div className="space-y-4">
                                        <InfoField label="Razão Social" value={registrationData?.razaoSocial} />
                                        <InfoField label="CNPJ" value={registrationData?.cnpj} />
                                    </div>
                                </section>

                                {/* Documentações */}
                                <section>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                        <span className="material-symbols-rounded text-purple-500">folder_open</span>
                                        Documentações
                                    </h3>
                                    <div className="flex flex-col gap-3">
                                        {DOCUMENTS.map((docItem) => {
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            const fileUrl = (formData?.documents as any)?.[docItem.id];
                                            return (
                                                <div key={docItem.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className={`p-2 rounded-lg ${fileUrl ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"}`}>
                                                            <span className="material-symbols-rounded text-lg">description</span>
                                                        </div>
                                                        <span className="font-medium text-gray-700 text-sm">{docItem.label}</span>
                                                    </div>

                                                    {fileUrl ? (
                                                        <a
                                                            href={fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Visualizar
                                                            <span className="material-symbols-rounded text-sm">open_in_new</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>

                            {/* Dados Bancários */}
                            <section>
                                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                    <span className="material-symbols-rounded text-green-500">account_balance</span>
                                    Dados Bancários
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <InfoField label="Banco" value={formData?.bankName} />
                                    </div>
                                    <InfoField label="Agência" value={formData?.bankAgency} />
                                    <InfoField label="Conta" value={formData?.bankAccount} />
                                    <div className="md:col-span-2">
                                        <InfoField label="Chave Pix" value={formData?.pixKey} />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl shadow-sm transition-all text-sm"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Helper component for consistent display
function InfoField({ label, value }: { label: string, value?: string }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {label}
            </label>
            <div className={`
                w-full p-2.5 rounded-xl border border-transparent
                ${value ? "bg-gray-50 text-gray-800" : "bg-gray-50/50 text-gray-400 italic"}
                font-medium text-sm
            `}>
                {value || "-"}
            </div>
        </div>
    );
}
