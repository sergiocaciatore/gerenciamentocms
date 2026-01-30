import { memo } from "react";
import type { Oc, OcEvent, FinancialRecord } from "../../types/ControlTower";

interface OcCardProps {
    oc: Oc;
    workName: string; // New prop
    ocEvents: OcEvent[];
    expandedOcId: string | null;
    isGrouped?: boolean;
    onExpand: (id: string | null) => void;
    onEdit: (oc: Oc) => void;
    onDelete: (id: string) => void;
    onAddEvent: (ocId: string) => void;
    onUpdateEvent: (event: OcEvent, field: string, value: string) => void;
    onDeleteEvent: (id: string) => void;
    onAddFinancialRecord: (ocId: string) => void;
    onEditFinancialRecord: (record: FinancialRecord, ocId: string) => void;
}

const OcCard = ({
    oc,
    workName,
    ocEvents,
    expandedOcId,
    onExpand,
    onEdit,
    onDelete,
    onAddEvent,
    onUpdateEvent,
    onDeleteEvent,
    onAddFinancialRecord,
    onEditFinancialRecord
}: OcCardProps) => {
    const isExpanded = expandedOcId === oc.id;
    // When grouped, we might not want to rely on global expansion state usually, 
    // but the original code passed setExpandedOcId globally even for grouped items?
    // Actually, in the original code: 
    // - renderOcCard used global `expandedOcId`.
    // - GroupedOcCard had its OWN `isExpanded` state for the group wrapper, but rendered `renderOcCard` inside.
    // So the card itself still largely relied on global expansion if passed?
    // Let's assume yes.

    // Note: Parent should pass ALREADY FILTERED events for efficiency, 
    // but current usage passes ALL events globally and filters inside. 
    // To match original logic 1:1 first, we filter here.
    const filteredEvents = ocEvents.filter(e => e.oc_id === oc.id);

    return (
        <div key={oc.id} className={`relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-md p-6 transition-all hover:shadow-lg group flex flex-col ${isExpanded ? 'row-span-2' : ''}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </div>
            <div className="relative z-10 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-blue-100/50 text-blue-700 border border-blue-200/50">
                            {workName}
                        </span>
                        {filteredEvents.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                {filteredEvents.length} Eventos
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onExpand(isExpanded ? null : oc.id)}
                            className="p-1.5 rounded-full bg-white/50 hover:bg-gray-100 text-gray-600 transition-colors"
                            title={isExpanded ? "Recolher" : "Expandir"}
                        >
                            {isExpanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={() => onEdit(oc)}
                            className="p-1.5 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors"
                            title="Editar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <button
                            onClick={() => onDelete(oc.id)}
                            className="p-1.5 rounded-full bg-white/50 hover:bg-red-100 text-red-600 transition-colors"
                            title="Excluir"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-1">{oc.description}</h3>
                        <p className="text-xs text-gray-600 mb-2">Tipo: {oc.type}</p>
                        {oc.value > 0 && (
                            <p className="text-xs font-bold text-gray-800">
                                Orçado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(oc.value)}
                            </p>
                        )}
                    </div>
                    {/* Financial Records Mini-Cards */}
                    <div className="flex flex-wrap gap-2 items-start">
                        {oc.financial_records?.map(record => (
                            <div
                                key={record.id}
                                onClick={() => onEditFinancialRecord(record, oc.id)}
                                className="w-16 h-16 bg-white/60 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:scale-105 transition-all cursor-pointer flex flex-col justify-center items-center p-1 group/card"
                                title={`Nota: ${record.invoiceNumber}\nFornecedor: ${record.supplier || '-'}`}
                            >
                                <div className="text-[9px] font-bold text-gray-800 text-center leading-tight">
                                    {record.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact" }).format(record.value) : "R$ -"}
                                </div>
                                {(record.issuanceDate || record.paymentDate) && (
                                    <div className="text-[8px] text-gray-500 mt-1 text-center leading-none">
                                        {record.paymentDate ? new Date(record.paymentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : new Date(record.issuanceDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Eventos vinculados</h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onAddFinancialRecord(oc.id)}
                                    className="py-1 px-3 rounded-lg border border-dashed border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3.228-9.941a.75.75 0 01.75-.75h5.956a.75.75 0 01.75.75v3.5a.75.75 0 01-.75.75H9.522a.75.75 0 01-.75-.75v-3.5zM6.75 12h10.5m-15 4.5h15" />
                                    </svg>
                                    Novo Registro Financeiro
                                </button>
                                <button
                                    onClick={() => onAddEvent(oc.id)}
                                    className="py-1 px-3 rounded-lg border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Novo Evento
                                </button>
                            </div>
                        </div>

                        {filteredEvents.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-2">Nenhum evento vinculado.</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-2">
                                    <div className="col-span-3">Descrição</div>
                                    <div className="col-span-2">Início</div>
                                    <div className="col-span-2">Fim</div>
                                    <div className="col-span-2">Status</div>
                                    <div className="col-span-2">Protocolo</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {filteredEvents.map(evt => (
                                    <div key={evt.id} className="grid grid-cols-12 gap-2 items-center bg-white/40 p-2 rounded-lg border border-white/50 text-sm">
                                        <div className="col-span-3 font-medium text-gray-800 truncate" title={evt.description}>
                                            {evt.description}
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="date"
                                                value={evt.start_date || ""}
                                                onChange={(e) => onUpdateEvent(evt, 'start_date', e.target.value)}
                                                className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-600"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="date"
                                                value={evt.end_date || ""}
                                                onChange={(e) => onUpdateEvent(evt, 'end_date', e.target.value)}
                                                className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-600"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <select
                                                value={evt.status || ""}
                                                onChange={(e) => onUpdateEvent(evt, 'status', e.target.value)}
                                                className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-600"
                                            >
                                                <option value="">Status</option>
                                                {(evt.status_options || []).map((opt: string) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                value={evt.protocol || ""}
                                                onChange={(e) => onUpdateEvent(evt, 'protocol', e.target.value)}
                                                placeholder="Protocolo"
                                                className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 text-gray-600 placeholder-gray-300"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={() => onDeleteEvent(evt.id)}
                                                className="text-red-400 hover:text-red-600 transition-colors"
                                                title="Excluir Evento"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* Visual Accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isExpanded ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-200'} transition-colors`}></div>
        </div>
    );
};

export default memo(OcCard);
