import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface CostReportProps {
    className?: string;
}

interface CostItem {
    name: string;
    value: number;
    subItems?: Record<string, number>;
}

// Colors for the chart
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export default function CostReport({ className = "" }: CostReportProps) {
    const [operations, setOperations] = useState<string[]>([]);
    const [selectedOperation, setSelectedOperation] = useState("");
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Data States
    const [aggregatedCosts, setAggregatedCosts] = useState<Record<string, CostItem>>({});
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);

    // Initial Load of Operations
    useEffect(() => {
        const loadOperations = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "operations"));
                const ops = querySnapshot.docs.map(doc => doc.id).sort();
                setOperations(ops);
                // Ideally default to "Todas" or empty to show global view first
                // setSelectedOperation(""); 
            } catch (error) {
                console.error("Error loading operations:", error);
            } finally {
                setLoading(false);
            }
        };

        loadOperations();
    }, []);

    // Load Cost Data when Date changes
    useEffect(() => {
        const loadCostData = async () => {
            setLoadingData(true);
            const [yearStr, monthStr] = selectedDate.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr) - 1; // JS Month 0-11, Input is 1-12

            console.log(`[CostReport] Loading data for ${month + 1}/${year}`);

            try {
                // 1. Get all active users
                // Reverting to fetch ALL users to ensure historical data (like terminated employees) is included.
                const allUsersQuery = await getDocs(collection(db, "users"));

                const costMap: Record<string, CostItem> = {};

                // Helper to add cost
                const addCost = (opName: string, subOpName: string, value: number) => {
                    const opKey = opName || "OUTROS";
                    const subKey = subOpName || "Geral";

                    if (!costMap[opKey]) {
                        costMap[opKey] = { name: opKey, value: 0, subItems: {} };
                    }
                    costMap[opKey].value += value;

                    if (!costMap[opKey].subItems![subKey]) {
                        costMap[opKey].subItems![subKey] = 0;
                    }
                    costMap[opKey].subItems![subKey] += value;
                };

                // 2. Fetch RDs for each user in parallel
                await Promise.all(allUsersQuery.docs.map(async (userDoc) => {
                    const rdsRef = doc(db, "users", userDoc.id, "rds", `${year}-${month}`);
                    const rdSnap = await getDoc(rdsRef);

                    if (rdSnap.exists()) {
                        const data = rdSnap.data();

                        // Process Main Invoice Value
                        if (data.invoiceData && data.invoiceData.value && !data.invoiceRejected) {
                            const valStr = data.invoiceData.value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
                            const val = parseFloat(valStr) || 0;

                            if (val > 0) {
                                // Use RD's main operation/subOperation
                                const op = data.operation;
                                const sub = data.subOperation?.obra || "Mão de Obra";
                                addCost(op, sub, val);
                            }
                        }

                        // Process Refunds
                        if (data.refunds && Array.isArray(data.refunds)) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            data.refunds.forEach((refund: any) => {
                                const rVal = parseFloat(refund.value) || 0;
                                if (rVal > 0) {
                                    // Refund has its own operation/subOperation usually, or falls back to RD's
                                    const rOp = refund.operation || data.operation;
                                    const rSub = refund.subOperation?.obra || refund.expenseType || "Reembolso";
                                    addCost(rOp, rSub, rVal);
                                }
                            });
                        }
                    }
                }));

                setAggregatedCosts(costMap);

            } catch (error) {
                console.error("Error loading cost data:", error);
            } finally {
                setLoadingData(false);
            }
        };

        loadCostData();
    }, [selectedDate]);

    // Derived Data for Visualization
    const { chartData, listData, totalPeriodCost } = useMemo(() => {
        const items = Object.values(aggregatedCosts);
        const total = items.reduce((acc, item) => acc + item.value, 0);

        // Chart Data (Top 5 Global)
        const sortedForChart = [...items].sort((a, b) => b.value - a.value).slice(0, 5);

        // List Data
        let listItems: { name: string, value: number, percentage: number }[] = [];

        if (selectedOperation && aggregatedCosts[selectedOperation]) {
            // Detailed View: Sub-operations of selected
            const subItems = aggregatedCosts[selectedOperation].subItems || {};
            const opTotal = aggregatedCosts[selectedOperation].value;

            listItems = Object.entries(subItems).map(([subName, val]) => ({
                name: subName,
                value: val,
                percentage: (val / opTotal) * 100
            })).sort((a, b) => b.value - a.value);

        } else {
            // Global View: All Operations
            listItems = items.map(item => ({
                name: item.name,
                value: item.value,
                percentage: (item.value / total) * 100
            })).sort((a, b) => b.value - a.value);
        }

        return { chartData: sortedForChart, listData: listItems, totalPeriodCost: total };
    }, [aggregatedCosts, selectedOperation]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className={`w-full h-full flex flex-col gap-6 ${className}`}>
            {/* Header / Filters Bar */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col xl:flex-row items-center justify-between gap-6 transition-all">

                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-2xl shadow-inner border border-blue-100/50">
                        <span className="material-symbols-rounded text-2xl">request_quote</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Relatório de Custos</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>Total no Período:</span>
                            <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                                {loadingData ? "..." : formatCurrency(totalPeriodCost)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    {/* Operation Selector */}
                    <div className="relative w-full sm:w-64 group">
                        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors pointer-events-none">
                            business_center
                        </span>
                        <select
                            value={selectedOperation}
                            onChange={(e) => setSelectedOperation(e.target.value)}
                            disabled={loading}
                            className="w-full pl-10 pr-10 py-3 bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none text-gray-700 font-medium cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                            <option value="">Todas as Operações</option>
                            {operations.map(op => (
                                <option key={op} value={op}>{op}</option>
                            ))}
                        </select>
                        <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xl group-hover:translate-y-0 transition-transform">
                            expand_more
                        </span>
                    </div>

                    {/* Date Selector */}
                    <div className="relative w-full sm:w-48 group">
                        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors pointer-events-none">
                            calendar_month
                        </span>
                        <input
                            type="month"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium cursor-pointer shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

                {/* Left: Bar Chart (Top Operations) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col relative overflow-hidden">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <span className="material-symbols-rounded text-blue-500">leaderboard</span>
                        Ranking Global
                        <span className="text-xs font-normal text-gray-400 ml-auto bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">Top 5 Operações</span>
                    </h3>

                    <div className="flex-1 w-full min-h-[300px]">
                        {loadingData ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-rounded animate-spin text-blue-200 text-5xl">progress_activity</span>
                            </div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={100}
                                        tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f9fafb' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number | undefined) => [formatCurrency(value || 0), 'Custo Total']}
                                    />
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                                        {chartData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                                <span className="material-symbols-rounded text-4xl">bar_chart_off</span>
                                <span className="text-sm">Sem dados para este período</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Detailed List */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-0 flex flex-col relative overflow-hidden flex-1">
                    <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-rounded text-emerald-500">list_alt</span>
                            {selectedOperation ? `Detalhamento: ${selectedOperation}` : "Visão Geral"}
                        </h3>
                    </div>

                    <div className="overflow-y-auto flex-1 custom-scrollbar p-2">
                        {loadingData ? (
                            <div className="p-10 text-center">
                                <span className="material-symbols-rounded animate-spin text-gray-300 text-3xl">rotate_right</span>
                            </div>
                        ) : listData.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead className="text-xs text-gray-400 uppercase font-medium bg-gray-50/50">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-xl">Nome</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                        <th className="px-4 py-3 text-right rounded-r-xl">%</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {listData.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-4 py-3 font-medium text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${selectedOperation ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                                                    {item.name}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-600 group-hover:text-gray-900">
                                                {formatCurrency(item.value)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-400 text-xs">
                                                {item.percentage.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
                                <span className="material-symbols-rounded text-4xl">folder_off</span>
                                <span className="text-sm">Nenhum custo registrado</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
