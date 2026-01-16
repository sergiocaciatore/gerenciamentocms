import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import * as XLSX from "xlsx";

interface SubOperation {
    cte: number;
    contabil: string;
    obra: string;
    operationName?: string; // Parent Operation ID (e.g. "AMAZON")
}

interface OperationData {
    subOperations: SubOperation[];
}

interface UserData {
    id: string;
    fullName: string;
    firstName: string;
}

// Map: userId -> { operationName: totalMinutes }
type HoursMap = Record<string, Record<string, number>>;

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function CompiledReport() {
    // Default to current date
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

    const [reportData, setReportData] = useState<SubOperation[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [userHours, setUserHours] = useState<HoursMap>({});
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Operations and Flatten
            const opsQuery = await getDocs(collection(db, "operations"));
            let flatOperations: SubOperation[] = [];
            const parentToFirstChild: Record<string, string> = {};

            opsQuery.forEach((doc) => {
                const data = doc.data() as OperationData;
                const subs = data.subOperations || [];

                if (subs.length > 0) {
                    const enriched = subs.map(sub => ({
                        ...sub,
                        operationName: doc.id
                    }));

                    enriched.sort((a, b) => a.cte - b.cte);

                    // Fallback map: Parent -> First Child
                    if (enriched[0]?.obra) {
                        parentToFirstChild[doc.id] = enriched[0].obra;
                    }

                    flatOperations = [...flatOperations, ...enriched];
                }
            });

            flatOperations.sort((a, b) => {
                const opA = (a.operationName || "").toUpperCase();
                const opB = (b.operationName || "").toUpperCase();
                if (opA < opB) return -1;
                if (opA > opB) return 1;
                return a.cte - b.cte;
            });

            setReportData(flatOperations);

            // 2. Fetch Users
            const usersQuery = await getDocs(collection(db, "users"));
            const fetchedUsers: UserData[] = [];
            const hoursMap: HoursMap = {};

            // Fetch extra data and RDs for each user in parallel
            await Promise.all(usersQuery.docs.map(async (userDoc) => {
                const d = userDoc.data();
                if (d.archived) return;

                const userId = userDoc.id;
                let fullName = d.razaoSocial || d.fullName || d.email || "Sem Nome";
                hoursMap[userId] = {};

                try {
                    // Fetch Profile, RDs, AND Assignments map
                    const [profileSnap, rdsSnap, assignSnap] = await Promise.all([
                        getDoc(doc(db, "users", userId, "settings", "profile")),
                        getDocs(query(
                            collection(db, "users", userId, "rds"),
                            where("year", "==", selectedYear)
                        )),
                        getDoc(doc(db, "users", userId, "settings", "rd_assignments"))
                    ]);

                    if (profileSnap.exists()) {
                        const profData = profileSnap.data();
                        if (profData.fullName) {
                            fullName = profData.fullName;
                        }
                    }

                    const assignments = assignSnap.exists() ? assignSnap.data() : {};

                    rdsSnap.forEach((rdDoc) => {
                        const rdData = rdDoc.data();

                        // Filter by Month
                        if (selectedMonth !== -1 && rdData.month !== selectedMonth) {
                            return;
                        }

                        // Resolve Operation Name

                        // 1. Try Specific Sub-Operation explicitly from RD
                        let targetOpName = rdData.subOperation?.obra;

                        // 2. If missing, try assignments map fallback for this month
                        const assignKey = `${rdData.year}-${rdData.month}`;
                        const assignedOp = assignments[assignKey];

                        // Use RD operation or Fallback Assignment
                        const rawOp = rdData.operation || assignedOp;

                        // 3. If target still missing but we have a raw parent/op string:
                        if (!targetOpName && rawOp) {
                            // Try to map parent name to first child
                            targetOpName = parentToFirstChild[rawOp];

                            // 4. If still no map match, use raw string (matching parent name directly?)
                            if (!targetOpName) {
                                targetOpName = rawOp;
                            }
                        }

                        const minutes = Number(rdData.totalMinutes) || 0;

                        if (targetOpName && minutes > 0) {
                            if (!hoursMap[userId][targetOpName]) {
                                hoursMap[userId][targetOpName] = 0;
                            }
                            hoursMap[userId][targetOpName] += minutes;
                        }
                    });

                    fetchedUsers.push({
                        id: userId,
                        fullName: fullName,
                        firstName: fullName.split(" ")[0]
                    });

                } catch (err) {
                    console.error(`Error fetching detailed data for ${userId}`, err);
                    fetchedUsers.push({
                        id: userId,
                        fullName: fullName,
                        firstName: fullName.split(" ")[0]
                    });
                }
            }));

            fetchedUsers.sort((a, b) => a.firstName.localeCompare(b.firstName));

            setUsers(fetchedUsers);
            setUserHours(hoursMap);

        } catch (error) {
            console.error("Error loading matrix data:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatHours = (minutes: number) => {
        if (!minutes) return "-";
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const mStr = m.toString().padStart(2, '0');
        return `${h}:${mStr}`;
    };

    const getHours = (userId: string, opName: string): number => {
        return userHours[userId]?.[opName] || 0;
    };

    const userTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        users.forEach(user => {
            let sum = 0;
            const uHours = userHours[user.id] || {};
            // Sum only hours for operations displayed in table
            reportData.forEach(op => {
                sum += uHours[op.obra] || 0;
            });
            totals[user.id] = sum;
        });
        return totals;
    }, [users, userHours, reportData]);

    const handleExportExcel = () => {
        // Headers
        const headers = ["CTE", "Contábil", "Nome do CC (Obra)", ...users.map(u => u.firstName)];

        // Data Rows
        const rows = reportData.map(item => {
            const rowData: (string | number)[] = [item.cte, item.contabil, item.obra];
            users.forEach(user => {
                const minutes = getHours(user.id, item.obra);
                rowData.push(minutes > 0 ? formatHours(minutes) : "-");
            });
            return rowData;
        });

        // Totals Row
        const totalRow: (string | number)[] = ["Total", "", "Total de Horas:"];
        users.forEach(user => {
            const t = userTotals[user.id];
            totalRow.push(t > 0 ? formatHours(t) : "-");
        });
        rows.push(totalRow);

        // Create Worksheet
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Adjust column widths (approximate)
        const wscols = [
            { wch: 10 }, // CTE
            { wch: 15 }, // Contabil
            { wch: 40 }, // Obra
            ...users.map(() => ({ wch: 12 })) // Users
        ];
        ws['!cols'] = wscols;

        // Create Workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");

        // Generate Filename
        const monthName = selectedMonth === -1 ? "Todos" : MONTHS[selectedMonth];
        const fileName = `RD_Compilado_${monthName}_${selectedYear}.xlsx`;

        // Save
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="flex flex-col h-full gap-6 animate-fadeIn p-4 md:p-6">

            {/* Header with Selectors */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <span className="material-symbols-rounded text-blue-600">summarize</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Relatório Compilado</h2>
                        <p className="text-sm text-gray-500">Matriz de horas por operação</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                    <div className="flex gap-2 w-full md:w-auto">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="flex-1 md:w-48 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        >
                            <option value={-1}>Todos os Meses</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        >
                            {[2024, 2025, 2026, 2027, 2028].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleExportExcel}
                        className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                        title="Exportar tabela para Excel"
                    >
                        <span className="material-symbols-rounded text-lg">description</span>
                        <span>Excel</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="material-symbols-rounded animate-spin text-gray-300 text-4xl">
                            progress_activity
                        </span>
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
                        <span className="material-symbols-rounded text-5xl text-gray-200">folder_off</span>
                        <p>Nenhuma operação encontrada.</p>
                    </div>
                ) : (
                    <div className="overflow-auto custom-scrollbar flex-1 p-0 relative">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/90 text-gray-500 font-medium text-xs uppercase tracking-wider backdrop-blur-sm sticky top-0 z-30 shadow-sm">
                                <tr>
                                    <th className="p-3 w-20 text-center border-b border-gray-200 sticky left-0 bg-gray-50 z-30 border-r border-gray-200">Cte</th>
                                    <th className="p-3 w-32 border-b border-gray-200 sticky left-20 bg-gray-50 z-30 border-r border-gray-200">Contábil</th>
                                    <th className="p-3 w-64 border-b border-gray-200 sticky left-52 bg-gray-50 z-30 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nome do CC (Obra)</th>

                                    {users.map(user => (
                                        <th key={user.id} className="p-3 border-b border-gray-200 min-w-[100px] text-center border-r border-dashed border-gray-200 last:border-r-0" title={user.fullName}>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[10px] leading-tight font-bold text-gray-700 whitespace-nowrap">
                                                    {user.firstName}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
                                {reportData.map((item, idx) => (
                                    <tr
                                        key={`${item.operationName}-${item.cte}-${idx}`}
                                        className="hover:bg-blue-50/40 transition-colors bg-white group"
                                    >
                                        <td className="p-3 text-center font-mono text-gray-500 font-medium border-r border-gray-100 sticky left-0 bg-white z-10 group-hover:bg-blue-50/40 transition-colors">
                                            {item.cte}
                                        </td>
                                        <td className="p-3 font-mono text-gray-500 border-r border-gray-100 sticky left-20 bg-white z-10 group-hover:bg-blue-50/40 transition-colors">
                                            {item.contabil}
                                        </td>
                                        <td className="p-3 font-medium border-r border-gray-100 sticky left-52 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-blue-50/40 transition-colors whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px]" title={item.obra}>
                                            {item.obra}
                                        </td>

                                        {users.map(user => {
                                            const minutes = getHours(user.id, item.obra);
                                            const hasHours = minutes > 0;

                                            // Optional: Heatmap style
                                            // const intensity = Math.min(minutes / 480, 1); // Max 8h base
                                            // style={{ backgroundColor: `rgba(34, 197, 94, ${intensity * 0.3})` }}

                                            return (
                                                <td
                                                    key={`${user.id}-${item.cte}`}
                                                    className={`p-2 text-center border-r border-dashed border-gray-100 last:border-r-0 ${hasHours ? "bg-green-50/30 font-semibold text-gray-800" : "text-gray-300"}`}
                                                >
                                                    {formatHours(minutes)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100/90 text-gray-700 font-bold text-xs uppercase tracking-wider backdrop-blur-sm sticky bottom-0 z-30 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td className="p-3 text-center border-t border-gray-200 sticky left-0 bg-gray-100 z-30 border-r border-gray-200">Total</td>
                                    <td className="p-3 border-t border-gray-200 sticky left-20 bg-gray-100 z-30 border-r border-gray-200"></td>
                                    <td className="p-3 border-t border-gray-200 sticky left-52 bg-gray-100 z-30 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-right pr-4">
                                        Total de Horas:
                                    </td>
                                    {users.map(user => (
                                        <td key={`total-${user.id}`} className="p-3 border-t border-gray-200 text-center border-r border-dashed border-gray-200 last:border-r-0 text-blue-800 bg-blue-50/50">
                                            {userTotals[user.id] > 0 ? formatHours(userTotals[user.id]) : "-"}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            <div className="text-center text-xs text-gray-400">
                Total de registros: {reportData.length} | Colaboradores: {users.length}
            </div>
        </div>
    );
}
