import { useState } from "react";
import { useParams } from "react-router-dom";
import SupplierLPU from "./SupplierLPU";
import type { SupplierLPUData } from "../types/Supplier";

export default function SupplierLogin() {
    const { token } = useParams<{ token: string }>();
    const [cnpj, setCnpj] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lpu, setLpu] = useState<SupplierLPUData | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!token) {
            setError("Token inválido.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/supplier/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, cnpj })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Falha na autenticação.");
            }

            const data = await response.json();
            setLpu(data);
            setIsAuthenticated(true);

        } catch (err: unknown) {
            console.error(err);
            if (err instanceof Error) {
                setError(err.message || "Erro ao acessar. Verifique o CNPJ.");
            } else {
                setError("Erro desconhecido ao acessar.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!isAuthenticated || !lpu) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Acesso do Fornecedor</h2>
                        <p className="text-gray-500 text-sm mt-1">Insira seu CNPJ para acessar a cotação.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">CNPJ</label>
                            <input
                                type="text"
                                value={cnpj}
                                onChange={(e) => {
                                    // Mask CNPJ: 00.000.000/0000-00
                                    let v = e.target.value.replace(/\D/g, "");
                                    if (v.length > 14) v = v.slice(0, 14);

                                    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
                                    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
                                    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
                                    v = v.replace(/(\d{4})(\d)/, "$1-$2");

                                    setCnpj(v);
                                }}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="00.000.000/0000-00"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-200"
                        >
                            Acessar Cotação
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // === VALIDATION LOGIC ===

    // 1. Expiration Check
    const today = new Date();
    const limitDate = new Date(lpu.limit_date);
    // Reset hours to compare dates only? Or exact time? Usually end of day. 
    // Let's assume strict comparison for safety.
    if (today > limitDate) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Prazo Expirado</h2>
                    <p className="text-gray-600">O prazo para envio desta cotação expirou em <b>{limitDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</b>.</p>
                </div>
            </div>
        );
    }

    // 2. Status Check (One-time access)
    if (lpu.status === 'submitted') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Cotação Enviada</h2>
                    <p className="text-gray-600">Esta cotação já foi preenchida e enviada com sucesso par ao sistema.</p>
                </div>
            </div>
        );
    }

    // If all valid, render the actual LPU interface
    // Passing the LPU data down along with credentials for submission
    return <SupplierLPU initialLpu={lpu} token={token || ""} cnpj={cnpj} />;
}
