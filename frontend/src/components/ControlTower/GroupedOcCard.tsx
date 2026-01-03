import { useState } from "react";
import type { Oc, OcEvent, ControlTowerWork, FinancialRecord } from "../../types/ControlTower";
import OcCard from "./OcCard";

interface GroupedOcCardProps {
    ocs: Oc[];
    works: ControlTowerWork[];
    ocEvents: OcEvent[];
    expandedOcId: string | null;
    onExpand: (id: string | null) => void;
    onEdit: (oc: Oc) => void;
    onDeleteOc: (id: string) => void;
    onAddEvent: (ocId: string) => void;
    onUpdateEvent: (event: OcEvent, field: string, value: string) => void;
    onDeleteEvent: (id: string) => void;
    onAddFinancialRecord: (ocId: string) => void;
    onEditFinancialRecord: (record: FinancialRecord, ocId: string) => void;
}

const GroupedOcCard = ({
    ocs,
    works,
    ocEvents,
    expandedOcId,
    onExpand,
    onEdit,
    onDeleteOc,
    onAddEvent,
    onUpdateEvent,
    onDeleteEvent,
    onAddFinancialRecord,
    onEditFinancialRecord
}: GroupedOcCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const workId = ocs[0]?.work_id;
    const work = works.find(w => w.id === workId);

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl transition-all ${isExpanded ? 'bg-white/60' : 'hover:bg-white/50'} group`}>
            <div className="p-6">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-800">{workId || "Sem Obra"}</h3>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Regional</span>
                            <span className="text-[11px] font-medium text-gray-700">{work?.regional || "-"}</span>
                        </div>
                        <div className="flex flex-col pl-4 border-l border-gray-300">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Ocorrências</span>
                            <span className="text-[11px] font-bold text-blue-600">{ocs.length} Card{ocs.length > 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 rounded-full bg-white/50 hover:bg-blue-100 text-blue-600 transition-colors"
                        title={isExpanded ? "Recolher" : "Expandir"}
                    >
                        {isExpanded ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="px-6 pb-6 pt-0 space-y-4 border-t border-white/30 mt-2 bg-black/5 rounded-b-2xl">
                    <div className="pt-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cartões da Obra</div>
                    <div className="grid grid-cols-1 gap-4">
                        {ocs.map(oc => {
                            const work = works.find(w => w.id === oc.work_id);
                            const workName = work ? `${work.id} - ${work.regional}` : (oc.work_id || "Sem Obra");

                            return (
                                <OcCard
                                    key={oc.id}
                                    oc={oc}
                                    workName={workName}
                                    ocEvents={ocEvents}
                                    expandedOcId={expandedOcId}
                                    onExpand={onExpand}
                                    onEdit={onEdit}
                                    onDelete={onDeleteOc}
                                    onAddEvent={onAddEvent}
                                    onUpdateEvent={onUpdateEvent}
                                    onDeleteEvent={onDeleteEvent}
                                    onAddFinancialRecord={onAddFinancialRecord}
                                    onEditFinancialRecord={onEditFinancialRecord}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
            {/* Visual Accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isExpanded ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-200'} transition-colors`}></div>
        </div>
    );
};

export default GroupedOcCard;
