import { useState } from "react";
import { LPU_STANDARD_ITEMS } from "../data/lpu_standard_items";

interface LPU {
    id: string;
    work_id: string;
    limit_date: string;
    status?: 'draft' | 'waiting' | 'submitted';
    quote_token?: string;
    quote_permissions?: {
        allow_quantity_change: boolean;
        allow_add_items: boolean;
        allow_remove_items: boolean;
        allow_lpu_edit: boolean;
    };
    prices?: Record<string, number>;
    quantities?: Record<string, number>;
}

interface SupplierLPUProps {
    initialLpu: LPU;
    token: string;
    cnpj: string;
}

export default function SupplierLPU({ initialLpu, token, cnpj }: SupplierLPUProps) {
    const [lpu, setLpu] = useState<LPU>(initialLpu);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Permissions Shortcuts
    const canEditQuantities = lpu.quote_permissions?.allow_quantity_change ?? false;

    // Expand/Collapse State
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroupExpansion = (groupId: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) newSet.delete(groupId);
            else newSet.add(groupId);
            return newSet;
        });
    };

    // Form Handlers
    const handlePriceChange = (itemId: string, value: string) => {
        const num = parseFloat(value.replace(',', '.'));
        const safeNum = isNaN(num) ? 0 : num;
        setLpu(prev => ({
            ...prev,
            prices: { ...(prev.prices || {}), [itemId]: safeNum }
        }));
    };

    const handleQuantityChange = (itemId: string, value: string) => {
        if (!canEditQuantities) return;
        const num = parseInt(value);
        const safeNum = isNaN(num) ? 0 : num;
        setLpu(prev => ({
            ...prev,
            quantities: { ...(prev.quantities || {}), [itemId]: safeNum }
        }));
    };

    // Total Calculation Helper
    const calculateTotal = () => {
        let total = 0;
        LPU_STANDARD_ITEMS.forEach(item => {
            if (!item.isGroup && !item.isSubGroup) {
                const price = lpu.prices?.[item.id] || 0;
                const qty = lpu.quantities?.[item.id] || 0;
                total += price * qty;
            }
        });
        return total;
    };

    // Submit Handler
    const handleSubmit = async () => {
        if (!confirm("Tem certeza que deseja enviar a cotação? Após o envio não será possível fazer mais alterações.")) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/supplier/lpus/${lpu.id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    cnpj,
                    prices: lpu.prices,
                    quantities: lpu.quantities,
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Falha ao enviar cotação");
            }

            setIsSuccess(true);
        } catch (error: any) {
            console.error("Erro ao enviar:", error);
            alert(`Erro: ${error.message || "Ocorreu um erro ao enviar sua cotação. Tente novamente."}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-green-100 animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Sucesso!</h2>
                    <p className="text-gray-600 mb-6">Sua cotação foi enviada com sucesso para nossa equipe.</p>
                    <button onClick={() => window.close()} className="text-sm text-green-700 font-medium hover:underline">Fechar Janela</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            {/* Top Bar / Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
                            P
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">Portal de Cotação</h1>
                            <p className="text-xs text-gray-500">ID da Obra: <span className="font-mono font-medium text-gray-700">{lpu.work_id}</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Prazo de Entrega</p>
                            <p className="text-sm font-bold text-orange-600">{new Date(lpu.limit_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                        <div className="bg-gray-100 h-8 w-px"></div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Cotado</p>
                            <p className="text-lg font-bold text-blue-600">{calculateTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Enviando...' : 'Enviar Cotação'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">

                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex gap-3 text-sm text-blue-800">
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p>Preencha os valores unitários para cada item abaixo. O cálculo total é feito automaticamente.{canEditQuantities && " Você também tem permissão para ajustar as quantidades solicitadas."}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {LPU_STANDARD_ITEMS.filter(item => item.isGroup).map(group => {
                        const isExpanded = expandedGroups.has(group.id);
                        const groupItems = LPU_STANDARD_ITEMS.filter(i => i.id.startsWith(group.id + ".") && i.id !== group.id);

                        return (
                            <div key={group.id} className="border-b border-gray-100 last:border-0">
                                <button
                                    onClick={() => toggleGroupExpansion(group.id)}
                                    className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${isExpanded ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{group.id}</span>
                                        <span className="font-bold text-sm uppercase text-gray-700">{group.description}</span>
                                    </div>
                                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>

                                {isExpanded && (
                                    <div className="p-2 bg-gray-50 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                                        <table className="w-full">
                                            <thead className="text-[10px] uppercase text-gray-400 font-bold tracking-wider text-left">
                                                <tr>
                                                    <th className="px-4 py-2 w-16">ID</th>
                                                    <th className="px-4 py-2">Descrição</th>
                                                    <th className="px-4 py-2 w-14 text-center">Unid.</th>
                                                    <th className="px-4 py-2 w-32 text-right">Preço Unit. (R$)</th>
                                                    <th className="px-4 py-2 w-24 text-center">Qtd.</th>
                                                    <th className="px-4 py-2 w-32 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm">
                                                {groupItems.map(item => (
                                                    <tr key={item.id} className={`border-b border-gray-100 last:border-0 ${item.isSubGroup ? 'bg-gray-100' : 'bg-white'}`}>
                                                        <td className="px-4 py-2 font-mono text-gray-500 text-xs">{item.id}</td>
                                                        <td className={`px-4 py-2 ${item.isSubGroup ? 'font-bold uppercase text-gray-600 text-xs' : 'text-gray-700'}`}>{item.description}</td>
                                                        {item.isSubGroup ? (
                                                            <td colSpan={4}></td>
                                                        ) : (
                                                            <>
                                                                <td className="px-4 py-2 text-center text-gray-500 text-xs">{item.unit}</td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <input
                                                                        type="text"
                                                                        className="w-full text-right bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                                                        placeholder="0,00"
                                                                        value={(lpu.prices?.[item.id] || 0) === 0 ? '' : (lpu.prices?.[item.id] || 0)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        onChange={e => handlePriceChange(item.id, e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        disabled={!canEditQuantities}
                                                                        className={`w-full text-center border rounded px-2 py-1 text-sm outline-none transition-shadow ${canEditQuantities ? 'bg-white border-gray-300 focus:ring-2 focus:ring-blue-500' : 'bg-gray-100 border-transparent text-gray-500 cursor-not-allowed'}`}
                                                                        value={lpu.quantities?.[item.id] || 0}
                                                                        onChange={e => handleQuantityChange(item.id, e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-right font-medium text-gray-900">
                                                                    {((lpu.prices?.[item.id] || 0) * (lpu.quantities?.[item.id] || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="flex justify-end pt-4 pb-12">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-base font-bold shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? 'Enviando...' : (
                            <>
                                <span>Enviar Cotação Final</span>
                                <svg className="w-5 h-5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
