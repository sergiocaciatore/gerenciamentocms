import { calculateDifferenceInMinutes, formatMinutesToHHMM, isWeekend } from "./utils";
import type { SubOperation } from "../../constants/operations";

interface Shift {
    in: string;
    out: string;
}

export interface DayData {
    morning: Shift;
    afternoon: Shift;
    night: Shift;
    allocations?: Allocation[];
}

export interface Allocation {
    id: string;
    subOperation: SubOperation | null;
    minutes: number;
}

interface TimesheetRowProps {
    date: Date;
    data: DayData;
    onChange: (date: Date, data: DayData) => void;
    readOnly?: boolean;
    subOpsList: SubOperation[];
}

export default function TimesheetRow({ date, data, onChange, readOnly, subOpsList }: TimesheetRowProps) {
    const morning = calculateDifferenceInMinutes(data.morning.in, data.morning.out);
    const afternoon = calculateDifferenceInMinutes(data.afternoon.in, data.afternoon.out);
    const night = calculateDifferenceInMinutes(data.night.in, data.night.out);
    const totalMinutes = morning + afternoon + night;

    const handleChange = (period: 'morning' | 'afternoon' | 'night', type: 'in' | 'out', value: string) => {
        if (readOnly) return;
        const newData = { ...data, [period]: { ...data[period], [type]: value } };
        
        // Recalculate total minutes for the new data to update allocations immediately if needed
        const m = calculateDifferenceInMinutes(newData.morning.in, newData.morning.out);
        const a = calculateDifferenceInMinutes(newData.afternoon.in, newData.afternoon.out);
        const n = calculateDifferenceInMinutes(newData.night.in, newData.night.out);
        const newTotal = m + a + n;

        // Auto-initialize allocations if we have time but no allocations
        if (newTotal > 0 && (!newData.allocations || newData.allocations.length === 0)) {
           newData.allocations = [{
               id: crypto.randomUUID(), // Native UUID
               subOperation: null, 
               minutes: newTotal 
           }];
        }

        onChange(date, newData);
    };

    // Allocation Handlers
    const handleAllocationChange = (id: string, field: 'subOperation' | 'minutes', value: SubOperation | null | number) => {
        if (readOnly || !data.allocations) return;
        
        const newAllocations = data.allocations.map(alloc => {
            if (alloc.id === id) {
                return { ...alloc, [field]: value };
            }
            return alloc;
        });
        
        onChange(date, { ...data, allocations: newAllocations });
    };

    const removeAllocation = (id: string) => {
         if (readOnly || !data.allocations) return;
         const newAllocations = data.allocations.filter(a => a.id !== id);
         onChange(date, { ...data, allocations: newAllocations });
    };

    // Calculate Allocated Total
    const totalAllocated = data.allocations?.reduce((acc, curr) => acc + curr.minutes, 0) || 0;
    const remainingMinutes = totalMinutes - totalAllocated;
    
    // Auto-add "ghost" row logic or button?
    // Requirement: "automatically opens another line to fill". 
    // We can effect this by checking if remainingMinutes > 0. 
    // If so, we can render a "Pending Allocation" line or auto-add it to state?
    // Auto-adding to state during render is bad (side-effect).
    // Better to render an input that, when interacted with, adds the allocation.
    // OR: We can use a useEffect to auto-add if we want strictly state-based.
    // Let's use a "Ghost Row" that represents the remaining time. 
    // When the user selects an operation for it, it becomes a real allocation.

    const isWeekendDay = isWeekend(date);
    const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
    const dayNumber = date.getDate().toString().padStart(2, '0');

    // Threshold: 9 hours = 540 minutes
    const isTargetMet = totalMinutes >= 540;
    const totalTimeColor = totalMinutes === 0 ? "text-gray-400" : isTargetMet ? "text-green-600 font-bold" : "text-red-500 font-bold";
    const bgColor = isWeekendDay ? "bg-gray-100" : "bg-white";

    return (
        <div className={`flex flex-col border-b border-gray-100 ${bgColor} ${readOnly ? '' : 'hover:bg-gray-50'} transition-colors`}>
            {/* Main Row: Time Inputs */}
            <div className="grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-2 items-center p-2">
                {/* Date Column */}
                <div className="flex flex-col items-center justify-center p-1 rounded-lg">
                    <span className={`text-xs font-bold ${isWeekendDay ? "text-red-400" : "text-gray-500"}`}>{dayName}</span>
                    <span className="text-lg font-bold text-gray-700">{dayNumber}</span>
                </div>

                {/* Morning */}
                <div className={`flex flex-col md:flex-row gap-1 items-center justify-center p-1 rounded-md border ${readOnly ? 'border-transparent' : 'bg-gray-50/50 border-gray-100'}`}>
                    <div className="text-[10px] text-gray-400 md:hidden">MANHÃ</div>
                    <input
                        type="time"
                        value={data.morning.in}
                        disabled={readOnly}
                        onChange={(e) => handleChange('morning', 'in', e.target.value)}
                        className={`w-full md:w-20 p-1 text-sm rounded text-center outline-none ${readOnly ? 'bg-transparent text-gray-600' : 'bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                    />
                    <span className="text-gray-300 hidden md:inline">-</span>
                    <input
                        type="time"
                        value={data.morning.out}
                        disabled={readOnly}
                        onChange={(e) => handleChange('morning', 'out', e.target.value)}
                        className={`w-full md:w-20 p-1 text-sm rounded text-center outline-none ${readOnly ? 'bg-transparent text-gray-600' : 'bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                    />
                </div>

                {/* Afternoon */}
                <div className={`flex flex-col md:flex-row gap-1 items-center justify-center p-1 rounded-md border ${readOnly ? 'border-transparent' : 'bg-gray-50/50 border-gray-100'}`}>
                    <div className="text-[10px] text-gray-400 md:hidden">TARDE</div>
                    <input
                        type="time"
                        value={data.afternoon.in}
                        disabled={readOnly}
                        onChange={(e) => handleChange('afternoon', 'in', e.target.value)}
                        className={`w-full md:w-20 p-1 text-sm rounded text-center outline-none ${readOnly ? 'bg-transparent text-gray-600' : 'bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                    />
                    <span className="text-gray-300 hidden md:inline">-</span>
                    <input
                        type="time"
                        value={data.afternoon.out}
                        disabled={readOnly}
                        onChange={(e) => handleChange('afternoon', 'out', e.target.value)}
                        className={`w-full md:w-20 p-1 text-sm rounded text-center outline-none ${readOnly ? 'bg-transparent text-gray-600' : 'bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                    />
                </div>

                {/* Night */}
                <div className={`flex flex-col md:flex-row gap-1 items-center justify-center p-1 rounded-md border ${readOnly ? 'border-transparent' : 'bg-gray-50/50 border-gray-100'}`}>
                    <div className="text-[10px] text-gray-400 md:hidden">NOITE</div>
                    <input
                        type="time"
                        value={data.night.in}
                        disabled={readOnly}
                        onChange={(e) => handleChange('night', 'in', e.target.value)}
                        className={`w-full md:w-20 p-1 text-sm rounded text-center outline-none ${readOnly ? 'bg-transparent text-gray-600' : 'bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                    />
                    <span className="text-gray-300 hidden md:inline">-</span>
                    <input
                        type="time"
                        value={data.night.out}
                        disabled={readOnly}
                        onChange={(e) => handleChange('night', 'out', e.target.value)}
                        className={`w-full md:w-20 p-1 text-sm rounded text-center outline-none ${readOnly ? 'bg-transparent text-gray-600' : 'bg-white border border-gray-200 focus:ring-2 focus:ring-blue-500'}`}
                    />
                </div>

                {/* Total */}
                <div className={`flex items-center justify-center text-sm ${totalTimeColor}`}>
                    {formatMinutesToHHMM(totalMinutes)}
                </div>
            </div>

            {/* Allocations Section */}
            {totalMinutes > 0 && (
                <div className="pl-[80px] pr-[80px] pb-2 text-xs">
                    <div className="bg-gray-50/50 rounded-lg p-2 border border-dashed border-gray-200 flex flex-col gap-2">
                        {/* Existing Allocations */}
                        {data.allocations?.map((alloc) => (
                            <div key={alloc.id} className="flex items-center gap-2 animate-fadeIn">
                                <span className="text-gray-400 material-symbols-rounded text-sm">subdirectory_arrow_right</span>
                                
                                <select
                                    value={alloc.subOperation ? JSON.stringify(alloc.subOperation) : ""}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleAllocationChange(alloc.id, 'subOperation', JSON.parse(e.target.value));
                                        }
                                    }}
                                    disabled={readOnly}
                                    className={`flex-1 p-1.5 rounded border border-gray-200 text-gray-700 outline-none focus:border-blue-500 ${!alloc.subOperation ? 'border-red-300 bg-red-50' : 'bg-white'}`}
                                >
                                    <option value="">Selecione a Operação...</option>
                                    {subOpsList.map((op, idx) => (
                                        <option key={idx} value={JSON.stringify(op)}>
                                            {op.obra} (Cte: {op.cte})
                                        </option>
                                    ))}
                                </select>

                                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded p-0.5">
                                    <input
                                        type="number"
                                        min="0"
                                        max={totalMinutes}
                                        value={Math.floor(alloc.minutes / 60)}
                                        onChange={(e) => {
                                            const h = parseInt(e.target.value) || 0;
                                            const m = alloc.minutes % 60;
                                            handleAllocationChange(alloc.id, 'minutes', h * 60 + m);
                                        }}
                                        disabled={readOnly}
                                        className="w-10 text-center outline-none text-gray-700"
                                        placeholder="HH"
                                    />
                                    <span className="text-gray-300">:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={alloc.minutes % 60}
                                        onChange={(e) => {
                                            const h = Math.floor(alloc.minutes / 60);
                                            const m = parseInt(e.target.value) || 0;
                                            handleAllocationChange(alloc.id, 'minutes', h * 60 + m);
                                        }}
                                        disabled={readOnly}
                                        className="w-10 text-center outline-none text-gray-700"
                                        placeholder="MM"
                                    />
                                </div>

                                {!readOnly && (
                                     <button 
                                        onClick={() => removeAllocation(alloc.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                        title="Remover alocação"
                                     >
                                         <span className="material-symbols-rounded text-sm">close</span>
                                     </button>
                                )}
                            </div>
                        ))}

                        {/* Ghost Row for Remaining Time */}
                        {remainingMinutes !== 0 && (
                            <div className="flex items-center gap-2 opacity-80">
                                <span className="text-blue-400 material-symbols-rounded text-sm">add</span>
                                
                                <select
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const op = JSON.parse(e.target.value);
                                            // Add new allocation with remaining minutes and selected op
                                            const newAlloc = {
                                                id: crypto.randomUUID(),
                                                subOperation: op,
                                                minutes: remainingMinutes
                                            };
                                            const newAllocations = [...(data.allocations || []), newAlloc];
                                            onChange(date, { ...data, allocations: newAllocations });
                                        }
                                    }}
                                    disabled={readOnly}
                                    className="flex-1 p-1.5 rounded border border-blue-200 bg-blue-50/50 text-blue-700 outline-none focus:border-blue-500 italic"
                                >
                                    <option value="">
                                        {remainingMinutes > 0 
                                            ? `Alocar restantes ${formatMinutesToHHMM(remainingMinutes)}...` 
                                            : `Ajustar excesso de ${formatMinutesToHHMM(Math.abs(remainingMinutes))}...`
                                        }
                                    </option>
                                    {remainingMinutes > 0 && subOpsList.map((op, idx) => (
                                        <option key={idx} value={JSON.stringify(op)}>
                                            {op.obra} (Cte: {op.cte})
                                        </option>
                                    ))}
                                </select>
                                
                                <div className="text-blue-600 font-medium text-xs px-2">
                                    {remainingMinutes > 0 ? '+' : ''}{formatMinutesToHHMM(remainingMinutes)}
                                </div>
                            </div>
                        )}
                        
                        {/* Validation Message */}
                        {remainingMinutes !== 0 && (
                            <div className={`text-[10px] text-right ${remainingMinutes > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                {remainingMinutes > 0 ? 'Faltam alocar horas' : 'Horas alocadas excedem o total trabalhado'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
