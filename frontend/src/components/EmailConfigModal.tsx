import { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

interface EmailConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EmailConfigModal({ isOpen, onClose }: EmailConfigModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleVerify = async () => {
        setVerifying(true);
        setError(null);
        setSuccess(false);

        try {
            // 1. Verify with Backend
            const token = await auth.currentUser?.getIdToken();
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/verify-email`,
                { email, password },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.valid) {
                // 2. Save to Firestore Setting (Global or User context?)
                if (auth.currentUser) {
                    await setDoc(doc(db, "settings", "email_config"), {
                        email,
                        password,
                        updatedAt: new Date().toISOString(),
                        updatedBy: auth.currentUser.uid
                    });
                }

                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                    setEmail('');
                    setPassword('');
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || "Erro ao verificar credenciais. Verifique email e senha.");
            } else {
                setError("Erro desconhecido ao verificar credenciais.");
            }
        } finally {
            setVerifying(false);
        }
    };

    // Using Portal to ensure proper z-index layering over the entire app
    const portalElement = document.getElementById('root') || document.body;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in relative z-10">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-100 p-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Configurar Email</h3>
                        <p className="text-sm text-gray-500 mt-1">Insira as credenciais do email de envio.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 font-medium">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-rounded text-base">info</span>
                            <span>Servidor Vinculado:</span>
                        </div>
                        <p className="pl-6 font-mono text-blue-800">postmail.cmseng.com.br</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">mail</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="exemplo@cmseng.com.br"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <div className="relative">
                            <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">key</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-sm">
                            <span className="material-symbols-rounded text-base mt-0.5">error</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2 text-green-600 text-sm font-medium">
                            <span className="material-symbols-rounded text-base">check_circle</span>
                            <span>Configuração validada e salva com sucesso!</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t border-gray-100 p-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
                        disabled={verifying}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleVerify}
                        disabled={verifying || !email || !password || success}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {verifying ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Verificando...
                            </>
                        ) : success ? (
                            <>Salvo!</>
                        ) : (
                            <>
                                <span className="material-symbols-rounded text-lg">check</span>
                                Verificar e Salvar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        portalElement
    );
}
