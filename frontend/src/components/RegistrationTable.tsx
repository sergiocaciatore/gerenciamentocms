import { useState } from "react";
import type { RegistrationItem, RegistrationWork, RegistrationEvent, RegistrationSupplier, RegistrationTeam } from "../types/Registration";

interface RegistrationTableProps {
    items: RegistrationItem[];
    onEdit: (item: RegistrationItem) => void;
    onDelete: (item: RegistrationItem) => void;
    onInlineUpdate?: (id: string, type: string, field: string, value: string) => Promise<void>;
}

export default function RegistrationTable({ items, onEdit, onDelete, onInlineUpdate }: RegistrationTableProps) {
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [tempValue, setTempValue] = useState("");

    const handleCellClick = (item: RegistrationItem, field: string, currentValue: string) => {
        if (!onInlineUpdate) return;
        // Only allow editing specific fields for simplicity
        // const allowEdit = ["regional", "status", "sla", "teamRole"]; 
        setEditingCell({ id: item.id, field });
        setTempValue(currentValue);
    };

    const handleBlur = async (item: RegistrationItem) => {
        if (editingCell && onInlineUpdate) {
            await onInlineUpdate(item.id, item.itemType, editingCell.field, tempValue);
        }
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, item: RegistrationItem) => {
        if (e.key === "Enter") {
            handleBlur(item);
        } else if (e.key === "Escape") {
            setEditingCell(null);
        }
    };

    // Helper to get display value or input
    const renderCell = (item: RegistrationItem, field: string, value: string | number | undefined | null) => {
        const isEditing = editingCell?.id === item.id && editingCell?.field === field;

        if (isEditing) {
            return (
                <input
                    autoFocus
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={() => handleBlur(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    className="w-full text-xs p-1 border border-blue-500 rounded bg-white"
                />
            );
        }

        return (
            <div
                onClick={() => handleCellClick(item, field, String(value))}
                className={`text-xs text-gray-700 truncate cursor-pointer hover:bg-gray-50 p-1 rounded ${onInlineUpdate ? 'hover:text-blue-600' : ''}`}
                title={String(value)}
            >
                {value || "-"}
            </div>
        );
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-white/50 shadow-sm bg-white/40 backdrop-blur-xl">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 text-transform uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 text-transform uppercase tracking-wider">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 text-transform uppercase tracking-wider">Detalhe Principal</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 text-transform uppercase tracking-wider">Status/Info</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 text-transform uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-transparent">
                    {items.map((item) => (
                        <tr key={item.id} className="hover:bg-white/60 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-xs font-bold text-gray-900">{item.id}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.itemType === 'Obra' ? 'bg-blue-100 text-blue-700' :
                                    item.itemType === 'Evento' ? 'bg-purple-100 text-purple-700' :
                                        item.itemType === 'Fornecedor' ? 'bg-green-100 text-green-700' :
                                            'bg-orange-100 text-orange-700'
                                    }`}>
                                    {item.itemType}
                                </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap max-w-xs overflow-hidden">
                                {item.itemType === 'Obra' && renderCell(item, 'regional', (item as RegistrationWork).regional)}
                                {item.itemType === 'Evento' && renderCell(item, 'description', (item as RegistrationEvent).description)}
                                {item.itemType === 'Fornecedor' && renderCell(item, 'social_reason', (item as RegistrationSupplier).social_reason)}
                                {item.itemType === 'Equipe' && renderCell(item, 'name', (item as RegistrationTeam).name)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                {item.itemType === 'Obra' && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500">GoLive: {(item as RegistrationWork).go_live_date}</span>
                                        <span className="text-[10px] text-gray-500">Tipo: {(item as RegistrationWork).work_type}</span>
                                    </div>
                                )}
                                {item.itemType === 'Evento' && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500">Tipo: {(item as RegistrationEvent).type}</span>
                                        <span className="text-[10px] text-gray-500">SLA: {(item as RegistrationEvent).sla} dias</span>
                                    </div>
                                )}
                                {item.itemType === 'Fornecedor' && (
                                    <span className="text-[10px] text-gray-500">CNPJ: {(item as RegistrationSupplier).cnpj}</span>
                                )}
                                {item.itemType === 'Equipe' && (
                                    <span className="text-[10px] text-gray-500">Função: {(item as RegistrationTeam).role}</span>
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                    <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Histórico (Audit Log)">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1.5 rounded-lg transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                    </button>
                                    <button
                                        onClick={() => onDelete(item)}
                                        className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                                Nenhum item encontrado.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
