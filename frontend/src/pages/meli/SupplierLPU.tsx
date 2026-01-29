import { useState, useEffect } from "react";
import { LPU_STANDARD_ITEMS } from "../../data/lpu_standard_items";
import type { SupplierLPUProps, SupplierLPUData } from "../../types/Supplier";

// Helper: Currency Input Component
const CurrencyInput = ({ value, onChange, disabled }: { value: number, onChange: (val: string) => void, disabled?: boolean }) => {
    // We keep local state for formatting stability while typing
    const [displayValue, setDisplayValue] = useState(
        value === 0 ? "" : value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );

    // Sync external changes (if any) - e.g. initial load
    // This effect ensures that if the 'value' prop changes from outside (e.g., initial load or reset),
    // the internal displayValue is updated.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDisplayValue(value === 0 ? "" : value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\D/g, ""); // Remove non-digits

        // Handle Backspace causing empty
        if (v === "") {
            setDisplayValue("");
            onChange("0");
            return;
        }

        // Convert to float (e.g. 1234 -> 12,34)
        const floatVal = parseFloat(v) / 100;

        // Update display with formatting
        setDisplayValue(floatVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));

        // Send raw string or float up? Handler expects string currently but converts to float.
        // Let's send the string representation of the float for the parent handler
        onChange(floatVal.toString().replace(".", ","));
    };

    return (
        <input
            type="text"
            className="w-full text-right bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            placeholder="0,00"
            value={displayValue}
            onChange={handleChange}
            disabled={disabled}
        />
    );
};

export default function SupplierLPU({ initialLpu, token, cnpj }: SupplierLPUProps) {
    const [lpu, setLpu] = useState<SupplierLPUData>(initialLpu);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Submission Custom Modal State
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [signerName, setSignerName] = useState("");

    // Permissions Shortcuts
    const canEditQuantities = lpu.quote_permissions?.allow_quantity_change ?? false;

    // Filter Logic: If selected_items exists and is not empty, only show those.
    const hasSelectionFilter = lpu.selected_items && lpu.selected_items.length > 0;
    const allowedItems = new Set(lpu.selected_items || []);

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
                // If filter is active, skip excluded items
                if (hasSelectionFilter && !allowedItems.has(item.id)) return;

                const price = lpu.prices?.[item.id] || 0;
                const qty = lpu.quantities?.[item.id] || 0;
                total += price * qty;
            }
        });
        return total;
    };

    // Open Modal instead of confirm()
    const handlePreSubmit = () => {
        setIsSubmitModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signerName.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/supplier/lpus/${lpu.id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    cnpj,
                    signer_name: signerName,
                    prices: lpu.prices,
                    quantities: lpu.quantities,
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Falha ao enviar cotação");
            }

            setIsSubmitModalOpen(false);
            setIsSuccess(true);
        } catch (error: unknown) {
            console.error("Erro ao enviar:", error);
            const msg = error instanceof Error ? error.message : "Ocorreu um erro ao enviar sua cotação. Tente novamente.";
            alert(`Erro: ${msg}`);
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
                    <p className="text-gray-600 mb-6 font-medium">Cotação enviada por {signerName}.</p>
                    <p className="text-xs text-gray-400">Nossa equipe comercial entrará em contato.</p>
                    <div className="mt-8 p-4 bg-green-100 rounded-lg text-sm text-green-800">
                        <p className="font-bold">Processo finalizado.</p>
                        <p>Você já pode fechar esta janela ou aba do navegador.</p>
                    </div>
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
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-mono font-medium text-gray-700">ID: {lpu.work_id}</span>
                                {lpu.work?.regional && (
                                    <>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span>{lpu.work.regional}</span>
                                    </>
                                )}
                            </div>
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
                            onClick={handlePreSubmit}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Enviar Cotação
                        </button>
                    </div>
                </div>

                {/* Work Details Banner */}
                {lpu.work && (
                    <div className="bg-blue-50 border-t border-blue-100 px-4 py-2">
                        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 text-xs text-blue-800">
                            <div className="flex items-center gap-2">
                                <span className="uppercase font-bold text-blue-400 tracking-wider">Site/Regional:</span>
                                <span className="font-medium">{lpu.work.regional}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="uppercase font-bold text-blue-400 tracking-wider">Go Live:</span>
                                <span className="font-medium">{lpu.work.go_live_date ? new Date(lpu.work.go_live_date).toLocaleDateString() : '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="uppercase font-bold text-blue-400 tracking-wider">Endereço:</span>
                                <span className="font-medium">{lpu.work.address ? `${lpu.work.address.street}, ${lpu.work.address.number} - ${lpu.work.address.city}/${lpu.work.address.state}` : '-'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">

                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex gap-3 text-sm text-blue-800">
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p>Preencha os valores unitários para cada item abaixo. O cálculo total é feito automaticamente.{canEditQuantities && " Você também tem permissão para ajustar as quantidades solicitadas."}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {LPU_STANDARD_ITEMS.filter(item => item.isGroup).map(group => {
                        // Filter items in this group
                        const groupItems = LPU_STANDARD_ITEMS.filter(i => {
                            if (!i.id.startsWith(group.id + ".") || i.id === group.id) return false;
                            // Check item filter
                            if (hasSelectionFilter && !allowedItems.has(i.id) && !i.isSubGroup) return false;
                            return true;
                        });

                        // If all items in this group are filtered out, don't show the group
                        if (groupItems.length === 0) return null;

                        const isExpanded = expandedGroups.has(group.id);

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
                                    <div className="flex items-center gap-3">
                                        {hasSelectionFilter && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">LPU Definitiva</span>}
                                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
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
                                                                    <CurrencyInput
                                                                        value={lpu.prices?.[item.id] || 0}
                                                                        onChange={(val) => handlePriceChange(item.id, val)}
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
                        onClick={handlePreSubmit}
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

            {/* Custom Submission Modal */}
            {isSubmitModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsSubmitModalOpen(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Envio da Cotação</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            Ao confirmar, você concorda com os valores e quantitativos preenchidos.
                            Após o envio, <b>não será possível realizar alterações</b>.
                        </p>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                                    Assinado Por (Digite seu Nome Completo)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={signerName}
                                    onChange={(e) => setSignerName(e.target.value)}
                                    placeholder="Ex: João da Silva"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                                    autoFocus
                                />
                                <p className="mt-2 text-[10px] text-gray-400">
                                    Este registro será armazenado para auditoria.
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsSubmitModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!signerName.trim() || isSubmitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Enviando...' : 'Confirmar e Enviar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
