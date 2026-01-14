
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Re-defining UserData locally
interface UserData {
    id: string;
    contractType?: string;
    role?: string;
}

interface UserConfigModalProps {
    user: UserData;
    onClose: () => void;
    onSave: (userId: string, data: { contractType: string; role: string }) => Promise<void>;
}

export default function UserConfigModal({ user, onClose, onSave }: UserConfigModalProps) {
    const [localUser, setLocalUser] = useState(user);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [onClose]);

    // Keep local state in sync if prop changes (not strictly necessary if used as modal)
    // useEffect(() => setLocalUser(user), [user]); 

    const handleSaveClick = async () => {
        setSaving(true);
        await onSave(localUser.id, {
            contractType: localUser.contractType || 'PJ',
            role: localUser.role || 'user'
        });
        setSaving(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">
                        Configurar Usuário
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">Tipo de Contratação</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['PJ', 'CLT'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setLocalUser({ ...localUser, contractType: type })}
                                    className={`
                                        p-2 rounded-xl border text-sm font-medium transition-all
                                        ${localUser.contractType === type
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">Permissão de Acesso</label>
                        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="font-semibold text-gray-800">Administrador</span>
                                <span className="text-xs text-gray-500">Acesso total ao sistema</span>
                            </div>
                            <button
                                onClick={() => setLocalUser({
                                    ...localUser,
                                    role: localUser.role === 'admin' ? 'user' : 'admin'
                                })}
                                className={`
                                    relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    ${localUser.role === 'admin' ? 'bg-blue-600' : 'bg-gray-300'}
                                `}
                            >
                                <span
                                    className={`
                                        inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                                        ${localUser.role === 'admin' ? 'translate-x-6' : 'translate-x-1'}
                                    `}
                                />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveClick}
                            disabled={saving}
                            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                                <span className="material-symbols-rounded text-lg">save</span>
                            )}
                            {saving ? "Salvando..." : "Salvar Alterações"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
