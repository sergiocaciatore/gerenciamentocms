import { calculateDifferenceInMinutes, formatMinutesToHHMM, isWeekend } from "./utils";

interface Shift {
    in: string;
    out: string;
}

export interface DayData {
    morning: Shift;
    afternoon: Shift;
    night: Shift;
}

interface TimesheetRowProps {
    date: Date;
    data: DayData;
    onChange: (date: Date, data: DayData) => void;
    readOnly?: boolean;
}

export default function TimesheetRow({ date, data, onChange, readOnly }: TimesheetRowProps) {
    const morning = calculateDifferenceInMinutes(data.morning.in, data.morning.out);
    const afternoon = calculateDifferenceInMinutes(data.afternoon.in, data.afternoon.out);
    const night = calculateDifferenceInMinutes(data.night.in, data.night.out);
    const totalMinutes = morning + afternoon + night;

    const handleChange = (period: 'morning' | 'afternoon' | 'night', type: 'in' | 'out', value: string) => {
        if (readOnly) return;
        const newData = { ...data, [period]: { ...data[period], [type]: value } };
        onChange(date, newData);
    };

    const isWeekendDay = isWeekend(date);
    const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
    const dayNumber = date.getDate().toString().padStart(2, '0');

    // Threshold: 9 hours = 540 minutes
    const isTargetMet = totalMinutes >= 540;
    const totalTimeColor = totalMinutes === 0 ? "text-gray-400" : isTargetMet ? "text-green-600 font-bold" : "text-red-500 font-bold";
    const bgColor = isWeekendDay ? "bg-gray-100" : "bg-white";

    return (
        <div className={`grid grid-cols-[80px_1fr_1fr_1fr_80px] gap-2 items-center p-2 border-b border-gray-100 ${bgColor} ${readOnly ? '' : 'hover:bg-gray-50'} transition-colors`}>
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
    );
}
