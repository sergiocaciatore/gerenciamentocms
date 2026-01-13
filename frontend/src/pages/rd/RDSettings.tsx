import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import ConfirmationModal from "../../components/ConfirmationModal";

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
}

const DOCUMENTS = [
    { id: "contract", label: "Contrato Social" },
    { id: "cnpjCard", label: "Carta CNPJ" },
    { id: "cnd", label: "Certidão Negativa de Débitos (CND)" },
    { id: "cndt", label: "Certidão Negativa de Débitos Trabalhistas (CNDT)" },
];

export default function RDSettings() {
    const [originalData, setOriginalData] = useState<SettingsData | null>(null);
    const [formData, setFormData] = useState<SettingsData>({
        fullName: "",
        cpf: "",
        rg: "",
        birthDate: "",
        documents: {}
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});

    // Formatting / Masking Helpers
    const formatCPF = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1,2})/, "$1-$2")
            .replace(/(-\d{2})\d+?$/, "$1");
    };

    const formatRG = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{2})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1})/, "$1-$2")
            .replace(/(-\d{1})\d+?$/, "$1"); // Basic RG mask, varies by state but this fits the xx.xxx.xxx-x requirement
    };

    const formatDate = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/(\d{2})(\d)/, "$1/$2")
            .replace(/(\d{2})(\d)/, "$1/$2")
            .replace(/(\d{4})\d+?$/, "$1");
    };

    const [registrationData, setRegistrationData] = useState<{ cnpj: string; razaoSocial: string } | null>(null);

    // Data Loading
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                const loadData = async () => {
                    try {
                        // Load Settings Profile
                        const profileRef = doc(db, "users", user.uid, "settings", "profile");
                        const profileSnap = await getDoc(profileRef);
                        if (profileSnap.exists()) {
                            const data = profileSnap.data() as SettingsData;
                            setFormData(data);
                            setOriginalData(data);
                        }

                        // Load Registration Data (CNPJ/Razão)
                        const userRef = doc(db, "users", user.uid);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            setRegistrationData({
                                cnpj: userData.cnpj || "",
                                razaoSocial: userData.razaoSocial || ""
                            });
                        }
                    } catch (error) {
                        console.error("Error loading data:", error);
                    } finally {
                        setLoading(false);
                    }
                };
                loadData();
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleChange = (field: keyof SettingsData, value: string) => {
        let formattedValue = value;
        if (field === "cpf") formattedValue = formatCPF(value);
        if (field === "rg") formattedValue = formatRG(value);
        if (field === "birthDate") formattedValue = formatDate(value);

        setFormData(prev => ({ ...prev, [field]: formattedValue }));
    };

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
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

    const handleFileUpload = async (key: string, file: File) => {
        if (!auth.currentUser) return;
        setUploading(prev => ({ ...prev, [key]: true }));

        try {
            const storageRef = ref(storage, `users/${auth.currentUser.uid}/documents/${key}_${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setFormData(prev => ({
                ...prev,
                documents: { ...prev.documents, [key]: downloadURL }
            }));

            // Optional: Show success toast or small modal for upload success if desired, but user just asked for Save/Clear modals. 
            // Keeping it subtle for uploads unless error.
        } catch (error) {
            console.error("Upload failed:", error);
            setModalConfig({
                isOpen: true,
                title: "Erro no Upload",
                message: "Não foi possível enviar o documento. Tente novamente.",
                type: "danger",
                isAlert: true
            });
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleSave = async () => {
        if (!auth.currentUser) return;
        setSaving(true);
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid, "settings", "profile"), formData);
            setOriginalData(formData);
            setModalConfig({
                isOpen: true,
                title: "Sucesso!",
                message: "Suas configurações foram salvas com sucesso.",
                type: "success",
                isAlert: true
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            setModalConfig({
                isOpen: true,
                title: "Erro ao Salvar",
                message: "Ocorreu um erro ao salvar suas alterações. Tente novamente.",
                type: "danger",
                isAlert: true
            });
        } finally {
            setSaving(false);
        }
    };

    const handleClear = () => {
        setModalConfig({
            isOpen: true,
            title: "Limpar Dados",
            message: "Tem certeza que deseja limpar todos os campos? Isso não apagará os dados salvos até que você clique em Salvar.",
            type: "warning",
            confirmText: "Sim, Limpar",
            onConfirm: () => {
                setFormData({
                    fullName: "",
                    cpf: "",
                    rg: "",
                    birthDate: "",
                    documents: {}
                });
            }
        });
    };

    const handleCancel = () => {
        if (originalData) {
            setFormData(originalData);
        } else {
            // Reset to empty if no saved data
            setFormData({
                fullName: "",
                cpf: "",
                rg: "",
                birthDate: "",
                documents: {}
            });
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;

    return (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 h-full flex flex-col overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Configurações</h2>

            {/* Dados Pessoais */}
            <section className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Nome Completo</label>
                        <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => handleChange("fullName", e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-800"
                            placeholder="Seu nome completo"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Data de Nascimento</label>
                        <input
                            type="text"
                            value={formData.birthDate}
                            maxLength={10}
                            onChange={(e) => handleChange("birthDate", e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-800"
                            placeholder="DD/MM/AAAA"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">CPF</label>
                        <input
                            type="text"
                            value={formData.cpf}
                            maxLength={14}
                            onChange={(e) => handleChange("cpf", e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-800"
                            placeholder="000.000.000-00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">RG</label>
                        <input
                            type="text"
                            value={formData.rg}
                            maxLength={12} // xx.xxx.xxx-x = 12 chars
                            onChange={(e) => handleChange("rg", e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-800"
                            placeholder="00.000.000-0"
                        />
                    </div>
                </div>
            </section>

            {/* Split Section: CNPJ Info & Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">

                {/* Informações CNPJ */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Informações CNPJ</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">Razão Social</label>
                            <input
                                type="text"
                                value={registrationData?.razaoSocial || ""}
                                disabled
                                className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl outline-none text-gray-600 font-medium cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">CNPJ</label>
                            <input
                                type="text"
                                value={registrationData?.cnpj || ""}
                                disabled
                                className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl outline-none text-gray-600 font-medium cursor-not-allowed"
                            />
                        </div>
                    </div>
                </section>

                {/* Documentações */}
                <section className="flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Documentações</h3>
                    <div className="flex flex-col gap-3">
                        {DOCUMENTS.map((docItem) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const fileUrl = (formData.documents as any)[docItem.id];
                            const isUploading = uploading[docItem.id];

                            return (
                                <div key={docItem.id} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-2 rounded-lg ${fileUrl ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-500"}`}>
                                            <span className="material-symbols-rounded text-xl">description</span>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-gray-700 text-sm truncate">{docItem.label}</span>
                                            {fileUrl ? (
                                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">
                                                    Ver documento
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400">Pendente</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type="file"
                                            id={`file-${docItem.id}`}
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    handleFileUpload(docItem.id, e.target.files[0]);
                                                }
                                            }}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                        />
                                        <label
                                            htmlFor={`file-${docItem.id}`}
                                            className={`cursor-pointer p-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1 ${isUploading
                                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                                                }`}
                                        >
                                            {isUploading ? (
                                                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                                            ) : (
                                                <span className="material-symbols-rounded text-lg">upload_file</span>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>


            {/* Actions Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-auto">
                <button
                    onClick={handleCancel}
                    className="px-6 py-3 text-gray-500 hover:bg-gray-50 font-semibold rounded-xl transition-all"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleClear}
                    className="px-6 py-3 text-red-500 bg-red-50 hover:bg-red-100 font-semibold rounded-xl transition-all"
                >
                    Limpar
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Salvando...
                        </>
                    ) : (
                        "Salvar Alterações"
                    )}
                </button>
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
        </div>
    );
}
