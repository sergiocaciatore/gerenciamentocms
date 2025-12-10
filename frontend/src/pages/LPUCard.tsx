import { useState } from "react";
import { LPU_STANDARD_ITEMS } from "../data/lpu_standard_items";
import { LPU_PRICES } from "../data/lpu_prices";
import Modal from "../components/Modal";

interface Work {
    id: string;
    regional: string;
    go_live_date: string;
    cep: string;
    address: {
        street: string;
        neighborhood: string;
        city: string;
        state: string;
        number: string;
        complement: string;
    };
    work_type: string;
    cnpj: string;
}

interface LPU {
    id: string;
    work_id: string;
    limit_date: string;
    created_at?: string;
    // Permissions
    allow_quantity_change?: boolean;
    allow_add_items?: boolean;
    allow_remove_items?: boolean;
    allow_lpu_edit?: boolean;
    // Data
    prices?: Record<string, number>;
    quantities?: Record<string, number>;
    // Phase 1: Quotation Status
    status?: 'draft' | 'waiting';
    quote_token?: string;
    invited_suppliers?: { id: string, name: string }[];
    quote_permissions?: {
        allow_quantity_change: boolean;
        allow_add_items: boolean;
        allow_remove_items: boolean;
        allow_lpu_edit: boolean;
    };
    conditions?: string; // Optional: Stores applied conditions
}

interface Supplier {
    id: string;
    social_reason: string;
    // ... other fields not needed for dropdown
}


interface LPUCardProps {
    lpu: LPU;
    work: Work | undefined;
    suppliers: Supplier[];
    onUpdateLpu: (lpuId: string, updates: Partial<LPU>) => Promise<void>;
    onDeleteLpu: (lpu: LPU) => void;
    onEditLpu: (lpu: LPU) => void;
    // Focus Mode
    isFocused: boolean;
    onToggleFocus: () => void;
}

export default function LPUCard({ lpu, work, suppliers, onUpdateLpu, onDeleteLpu, onEditLpu, isFocused, onToggleFocus }: LPUCardProps) {
    // === Local State for Menu Interno ===
    const [showPrices, setShowPrices] = useState(false);
    const [showQuantities, setShowQuantities] = useState(false);
    const [isDefinitive, setIsDefinitive] = useState(false);

    // === Item Selection & Expansion ===
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const toggleGroupExpansion = (groupId: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) newSet.delete(groupId);
            else newSet.add(groupId);
            return newSet;
        });
    };

    const expandAll = () => {
        const newSet = new Set<string>();
        LPU_STANDARD_ITEMS.filter(item => item.isGroup).forEach(g => newSet.add(g.id));
        setExpandedGroups(newSet);
    };

    const collapseAll = () => setExpandedGroups(new Set());

    const toggleItemSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId);
            else newSet.add(itemId);
            return newSet;
        });
    };

    // === Handlers ===
    const handlePriceChange = (itemId: string, value: string) => {
        const num = parseFloat(value.replace(',', '.'));
        const safeNum = isNaN(num) ? 0 : num;
        onUpdateLpu(lpu.id, {
            prices: { ...(lpu.prices || {}), [itemId]: safeNum }
        });
    };

    const handleQuantityChange = (itemId: string, value: string) => {
        const num = parseInt(value);
        const safeNum = isNaN(num) ? 0 : num;
        onUpdateLpu(lpu.id, {
            quantities: { ...(lpu.quantities || {}), [itemId]: safeNum }
        });
    };

    // === Quotation Workflow State & Logic ===
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [quoteSuppliers, setQuoteSuppliers] = useState<{ id: string, name: string }[]>([]);
    // Default quote permissions (start enabled or disabled? User requested "configuracoes pre definidas serao aplicadas")
    // Let's copy from current LPU or default false
    const [quotePermissions, setQuotePermissions] = useState({
        allow_quantity_change: lpu.allow_quantity_change || false,
        allow_add_items: lpu.allow_add_items || false,
        allow_remove_items: lpu.allow_remove_items || false,
        allow_lpu_edit: lpu.allow_lpu_edit || false
    });
    const [isSavingQuote, setIsSavingQuote] = useState(false);


    const handleAddSupplier = (supplierId: string) => {
        const sup = suppliers.find(s => s.id === supplierId);
        if (sup && !quoteSuppliers.find(qs => qs.id === sup.id)) {
            setQuoteSuppliers([...quoteSuppliers, { id: sup.id, name: sup.social_reason }]);
        }
    };

    const handleRemoveSupplier = (id: string) => {
        setQuoteSuppliers(quoteSuppliers.filter(s => s.id !== id));
    };

    const handleSaveQuote = async () => {
        setIsSavingQuote(true);
        const token = Math.random().toString(36).substring(2, 10).toUpperCase(); // Simple random token

        await onUpdateLpu(lpu.id, {
            status: 'waiting',
            quote_token: token,
            invited_suppliers: quoteSuppliers,
            quote_permissions: quotePermissions
        });

        setIsSavingQuote(false);
        setIsQuoteModalOpen(false);
    };

    const handleCancelQuote = async () => {
        if (!confirm("Tem certeza que deseja cancelar a cotação e voltar para o rascunho?")) return;
        await onUpdateLpu(lpu.id, {
            status: 'draft',
            quote_token: undefined, // Clear or keep history? keeping simple for now
        });
    };

    // === Toggle Component ===
    const ToggleSwitch = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <div className="flex items-center justify-between py-2 border-b border-white/30 last:border-0 hover:bg-white/10 px-2 rounded-lg transition-colors cursor-pointer" onClick={onChange}>
            <span className="text-xs font-medium text-gray-700 select-none">{label}</span>
            <button
                type="button"
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
        </div>
    );

    // === Render ===

    const isWaiting = lpu.status === 'waiting';

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl hover:bg-white/50 group transition-all duration-300 ${isWaiting ? 'bg-stripes-blue' : ''}`}>
            {/* Background Icon */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </div>

            <div className="relative z-10 p-6 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-gray-800">{work?.id || lpu.work_id}</h3>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Regional</span>
                            <span className="text-sm font-medium text-gray-700">{work?.regional || "-"}</span>
                        </div>
                        {isWaiting && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-200 animate-pulse">
                                Aguardando Cotação
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {/* Quote Button (Only in Draft) */}
                        {!isWaiting && (
                            <button
                                onClick={() => setIsQuoteModalOpen(true)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <span className="text-base font-bold">+</span> Solicitar Cotação
                            </button>
                        )}

                        {/* Expand/Collapse/Focus (Only in Draft) */}
                        {!isWaiting && (
                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                <button onClick={expandAll} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all">Expandir</button>
                                <div className="w-px h-3 bg-gray-300"></div>
                                <button onClick={collapseAll} className="px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:shadow-sm rounded transition-all">Recolher</button>
                                <div className="w-px h-3 bg-gray-300"></div>
                                {/* Foco Button */}
                                <button
                                    onClick={onToggleFocus}
                                    className={`px-2 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1 ${isFocused ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
                                    title="Modo Foco (Tela Cheia)"
                                >
                                    Foco
                                </button>
                            </div>
                        )}

                        {!isWaiting && (
                            <div className="flex gap-1 ml-2">
                                <button onClick={() => onEditLpu(lpu)} className="p-1.5 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button>
                                <button onClick={() => onDeleteLpu(lpu)} className="p-1.5 rounded-full bg-white/50 hover:bg-red-100 text-red-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/30 rounded-xl p-4 border border-white/40">
                    <div className="space-y-1">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Endereço</div>
                        <p className="text-sm text-gray-800">{work?.address?.street}, {work?.address?.number} - {work?.address?.city}/{work?.address?.state}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Prazo LPU</div>
                        <p className="text-sm font-medium text-orange-700">{new Date(lpu.limit_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                    </div>
                </div>

                {/* CONTENT: Waiting Mode vs Draft Mode */}
                {isWaiting ? (
                    <div className="mt-4 bg-white/60 p-6 rounded-xl border border-blue-200/50 shadow-inner space-y-6 animate-in fade-in">
                        {/* Token & Link */}
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Token de Acesso do Fornecedor</h4>
                            <div className="text-4xl font-mono font-bold text-blue-600 tracking-wider mb-4 select-all">{lpu.quote_token}</div>
                            <div className="text-xs text-gray-500">
                                Link de acesso: <span className="text-blue-500 underline break-all">{window.location.protocol}//{window.location.host}/fornecedor/login/{lpu.quote_token}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Invited Suppliers */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Fornecedores Convidados</h4>
                                <ul className="space-y-2">
                                    {lpu.invited_suppliers?.map(s => (
                                        <li key={s.id} className="flex items-center gap-2 p-2 bg-white/50 rounded-lg border border-gray-100/50">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                                                {s.name.charAt(0)}
                                            </div>
                                            <span className="text-sm text-gray-700">{s.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Conditions */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Condições Aplicadas</h4>
                                <div className="space-y-1 text-xs text-gray-600">
                                    <p className={lpu.quote_permissions?.allow_quantity_change ? "text-green-600 font-bold" : "opacity-50"}>• Alterar Quantitativos</p>
                                    <p className={lpu.quote_permissions?.allow_add_items ? "text-green-600 font-bold" : "opacity-50"}>• Adicionar Itens</p>
                                    <p className={lpu.quote_permissions?.allow_remove_items ? "text-green-600 font-bold" : "opacity-50"}>• Remover Itens</p>
                                    <p className={lpu.quote_permissions?.allow_lpu_edit ? "text-green-600 font-bold" : "opacity-50"}>• Editar Descrições/Obs</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center pt-4 border-t border-gray-200/50">
                            <button onClick={handleCancelQuote} className="text-xs text-red-500 hover:text-red-700 hover:underline">Cancelar Cotação e Voltar para Rascunho</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Menu Interno (Local per Card) - Using ToggleSwitch now */}
                        <div className="mt-2 p-3 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-wrap gap-4 items-center">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Visualização:</span>
                            <div className="flex gap-4">
                                <div className="min-w-[120px]">
                                    <ToggleSwitch label="Preços" checked={showPrices} onChange={() => setShowPrices(!showPrices)} />
                                </div>
                                <div className="min-w-[140px]">
                                    <ToggleSwitch label="Quantidades" checked={showQuantities} onChange={() => setShowQuantities(!showQuantities)} />
                                </div>
                                <div className="min-w-[140px]">
                                    <ToggleSwitch label="LPU Definitiva" checked={isDefinitive} onChange={() => setIsDefinitive(!isDefinitive)} />
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="mt-4 flex flex-col gap-2">
                            {/* ... (Existing Loop Logic for Accordions) ... */}
                            {LPU_STANDARD_ITEMS.filter(item => item.isGroup).map(group => {
                                const isExpanded = expandedGroups.has(group.id);
                                const groupItems = LPU_STANDARD_ITEMS.filter(i => i.id.startsWith(group.id + ".") && i.id !== group.id);

                                return (
                                    <div key={group.id} className="border-t border-white/40 pt-2 first:border-0">
                                        <button
                                            onClick={() => toggleGroupExpansion(group.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl group/acc ${isExpanded ? 'bg-blue-50 border-blue-200' : 'bg-white/40 hover:bg-blue-50/50 border-transparent hover:border-blue-100'} border`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${isExpanded ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>{group.id}</span>
                                                <span className="font-bold text-sm uppercase text-gray-700">{group.description}</span>
                                            </div>
                                            <svg className={`w-5 h-5 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-2 bg-white/60 rounded-xl border border-white/50 overflow-hidden shadow-sm ml-2">
                                                <table className="min-w-full divide-y divide-gray-200/50">
                                                    <thead className="bg-gray-50/50">
                                                        <tr>
                                                            <th className="pl-4 pr-2 py-2 text-left text-[10px] uppercase w-16">Sel.</th>
                                                            <th className="px-2 py-2 text-left text-[10px] uppercase w-16">ID</th>
                                                            <th className="px-2 py-2 text-left text-[10px] uppercase">Descrição</th>
                                                            <th className="px-2 py-2 text-center text-[10px] uppercase w-14">Unid.</th>
                                                            {showPrices && <th className="px-2 py-2 text-right text-[10px] uppercase w-24">Preço</th>}
                                                            {showQuantities && <th className="px-2 py-2 text-center text-[10px] uppercase w-20">Qtd.</th>}
                                                            {showQuantities && <th className="px-2 py-2 text-right text-[10px] uppercase w-24">Total</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {groupItems.map(item => {
                                                            const isSelected = selectedItems.has(item.id);
                                                            if (isDefinitive && !isSelected && !item.isSubGroup) return null;

                                                            return (
                                                                <tr key={item.id} className={item.isSubGroup ? "bg-gray-100/80" : "hover:bg-blue-50/50"}>
                                                                    <td className="pl-4 pr-2 py-1.5 align-middle">
                                                                        {!item.isSubGroup && (
                                                                            <button onClick={() => toggleItemSelection(item.id)} className={`w-4 h-4 rounded-full border ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}></button>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-xs text-gray-500 font-mono">{item.id}</td>
                                                                    <td className={`px-2 py-1.5 text-xs ${item.isSubGroup ? 'font-bold uppercase' : 'text-gray-700'}`}>{item.description}</td>
                                                                    <td className="px-2 py-1.5 text-[10px] text-center text-gray-500">{item.unit}</td>
                                                                    {showPrices && (
                                                                        <td className="px-2 py-1.5 text-right">
                                                                            {!item.isSubGroup && (
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-20 text-right text-xs bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
                                                                                    value={(lpu.prices?.[item.id] ?? LPU_PRICES[item.id] ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                                    onChange={e => handlePriceChange(item.id, e.target.value)}
                                                                                />
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                    {showQuantities && (
                                                                        <td className="px-2 py-1.5 text-center">
                                                                            {!item.isSubGroup && (
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-16 text-center text-xs bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                                                    value={lpu.quantities?.[item.id] ?? ""}
                                                                                    onChange={e => handleQuantityChange(item.id, e.target.value)}
                                                                                    placeholder="0"
                                                                                />
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                    {showQuantities && (
                                                                        <td className="px-2 py-1.5 text-right text-xs font-medium">
                                                                            {!item.isSubGroup && (
                                                                                ((lpu.prices?.[item.id] ?? LPU_PRICES[item.id] ?? 0) * (lpu.quantities?.[item.id] ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* QUOTATION MODAL - Using Standard Modal Component */}
            <Modal
                isOpen={isQuoteModalOpen}
                onClose={() => setIsQuoteModalOpen(false)}
                title="Solicitar Cotação"
                width="40rem" // Slightly wider
            >
                <div className="space-y-6">
                    {/* 1. Add Suppliers */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Convidar Fornecedores</label>
                        <div className="flex gap-2 mb-3">
                            <select
                                className="flex-1 rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleAddSupplier(e.target.value);
                                        e.target.value = ""; // reset
                                    }
                                }}
                            >
                                <option value="">Selecione um fornecedor...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.social_reason}</option>
                                ))}
                            </select>
                        </div>
                        {/* List Added */}
                        <div className="flex flex-wrap gap-2">
                            {quoteSuppliers.length === 0 && <span className="text-sm text-gray-400 italic">Nenhum fornecedor adicionado.</span>}
                            {quoteSuppliers.map(s => (
                                <div key={s.id} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium border border-blue-100">
                                    {s.name}
                                    <button onClick={() => handleRemoveSupplier(s.id)} className="hover:text-red-500">×</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Permissions */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Condições da LPU</label>
                        <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <ToggleSwitch label="Permitir alterar quantitativos" checked={quotePermissions.allow_quantity_change} onChange={() => setQuotePermissions({ ...quotePermissions, allow_quantity_change: !quotePermissions.allow_quantity_change })} />
                            <ToggleSwitch label="Permitir adicionar novos itens" checked={quotePermissions.allow_add_items} onChange={() => setQuotePermissions({ ...quotePermissions, allow_add_items: !quotePermissions.allow_add_items })} />
                            <ToggleSwitch label="Permitir remover itens" checked={quotePermissions.allow_remove_items} onChange={() => setQuotePermissions({ ...quotePermissions, allow_remove_items: !quotePermissions.allow_remove_items })} />
                            <ToggleSwitch label="Permitir edição de descrições/obs" checked={quotePermissions.allow_lpu_edit} onChange={() => setQuotePermissions({ ...quotePermissions, allow_lpu_edit: !quotePermissions.allow_lpu_edit })} />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            onClick={handleSaveQuote}
                            disabled={quoteSuppliers.length === 0 || isSavingQuote}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSavingQuote ? 'Salvando...' : 'Salvar e Gerar Token'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
