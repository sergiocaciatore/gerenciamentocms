export function getMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

export function calculateDifferenceInMinutes(start: string, end: string): number {
    if (!start || !end) return 0;

    const startMin = getMinutes(start);
    let endMin = getMinutes(end);

    if (endMin < startMin) {
        // Assume crossing midnight (next day)
        endMin += 1440; // 24 * 60
    }

    return endMin - startMin;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatCurrency(val: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(val);
}

export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

export function getDaysInMonth(year: number, month: number): Date[] {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}
