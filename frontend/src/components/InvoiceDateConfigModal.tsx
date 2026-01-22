import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface InvoiceDateConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function InvoiceDateConfigModal({ isOpen, onClose }: InvoiceDateConfigModalProps) {
    const [startDay, setStartDay] = useState('');
    const [endDay, setEndDay] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, "settings", "invoice_dates");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setStartDay(data.startDay?.toString() || '');
                setEndDay(data.endDay?.toString() || '');
            }
        } catch (err) {
            console.error("Error loading invoice dates:", err);
            setError("Erro ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const start = parseInt(startDay);
        const end = parseInt(endDay);

        if (isNaN(start) || isNaN(end) || start < 1 || start > 31 || end < 1 || end > 31 || start > end) {
            setError("Insira dias válidos (1-31). Início deve ser menor ou igual ao fim.");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            if (auth.currentUser) {
                await setDoc(doc(db, "settings", "invoice_dates"), {
                    startDay: start,
                    endDay: end,
                    updatedAt: new Date().toISOString(),
                    updatedBy: auth.currentUser.uid
                });
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                }, 1500);
            }
        } catch (err) {
            console.error("Error saving invoice dates:", err);
            setError("Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    };

    if (typeof document === 'undefined') return null;
    const portalElement = document.getElementById('root') || document.body;

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in relative z-10">
                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-100 p-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Datas de Envio</h3>
                        <p className="text-sm text-gray-500 mt-1">Configure o período permitido.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dia Início</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={startDay}
                                    onChange={(e) => setStartDay(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-center font-bold text-lg"
                                    placeholder="01"
                                />
                            </div>
                            <span className="text-gray-400 font-medium">até</span>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dia Fim</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={endDay}
                                    onChange={(e) => setEndDay(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-center font-bold text-lg"
                                    placeholder="10"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-sm">
                            <span className="material-symbols-rounded text-base mt-0.5">error</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2 text-green-600 text-sm font-medium">
                            <span className="material-symbols-rounded text-base">check_circle</span>
                            <span>Configuração salva!</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t border-gray-100 p-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading || success}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {saving ? "Salvando..." : "Salvar Configuração"}
                    </button>
                </div>
            </div>
        </div>,
        portalElement
    );
}
