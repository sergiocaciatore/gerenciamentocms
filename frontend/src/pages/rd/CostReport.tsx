import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

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
    // Date Range State
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1); // Jan 1st of current year
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Top N State
    const [topN, setTopN] = useState(5);

    // Data States
    const [aggregatedCosts, setAggregatedCosts] = useState<Record<string, CostItem>>({});
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [generatingPDF, setGeneratingPDF] = useState(false);

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

    // Load Cost Data when Date Range changes
    useEffect(() => {
        const loadCostData = async () => {
            setLoadingData(true);

            // Generate list of [year, month] pairs from startDate to endDate
            const [startYear, startMonth] = startDate.split('-').map(Number);
            const [endYear, endMonth] = endDate.split('-').map(Number);

            const monthsToFetch: { year: number, month: number }[] = [];

            const start = new Date(startYear, startMonth - 1, 1);
            const end = new Date(endYear, endMonth - 1, 1);

            const current = new Date(start);
            while (current <= end) {
                monthsToFetch.push({ year: current.getFullYear(), month: current.getMonth() }); // month is 0-indexed for Firestore logic
                current.setMonth(current.getMonth() + 1);
            }

            console.log(`[CostReport] Loading data for range:`, monthsToFetch);

            try {
                // 1. Get all active users
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

                // 2. Fetch RDs for each user and each month in the range
                await Promise.all(allUsersQuery.docs.map(async (userDoc) => {
                    for (const { year, month } of monthsToFetch) {
                        const rdsRef = doc(db, "users", userDoc.id, "rds", `${year}-${month}`);
                        const rdSnap = await getDoc(rdsRef);

                        if (rdSnap.exists()) {
                            const data = rdSnap.data();

                            // Process Main Invoice Value
                            if (data.invoiceData && data.invoiceData.value && !data.invoiceRejected) {
                                const valStr = data.invoiceData.value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
                                const val = parseFloat(valStr) || 0;

                                if (val > 0) {
                                    // Use RD's main operation, fallback to assignments if missing
                                    let op = data.operation;

                                    if (!op) {
                                        try {
                                            const assignRef = doc(db, "users", userDoc.id, "settings", "rd_assignments");
                                            const assignSnap = await getDoc(assignRef);
                                            if (assignSnap.exists()) {
                                                op = assignSnap.data()[`${year}-${month}`];
                                            }
                                        } catch (e) {
                                            console.error("Error fetching assignment fallback:", e);
                                        }
                                    }

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
                                        const rOp = refund.operation || data.operation;
                                        const rSub = refund.subOperation?.obra || refund.expenseType || "Reembolso";
                                        addCost(rOp, rSub, rVal);
                                    }
                                });
                            }
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

        if (startDate && endDate) {
            loadCostData();
        }
    }, [startDate, endDate]);

    // Derived Data for Visualization
    const { chartData, listData, totalPeriodCost } = useMemo(() => {
        const items = Object.values(aggregatedCosts);

        let total = 0;
        let chartItems: { name: string, value: number }[] = [];
        let listItems: { name: string, value: number, percentage: number, subItems?: Record<string, number> }[] = [];

        if (selectedOperation && aggregatedCosts[selectedOperation]) {
            // Detailed View: Sub-operations of selected
            const opData = aggregatedCosts[selectedOperation];
            const subItems = opData.subItems || {};
            const opTotal = opData.value;
            total = opTotal; // Total for the context is the operation total

            const breakdown = Object.entries(subItems).map(([subName, val]) => ({
                name: subName,
                value: val,
                percentage: (val / opTotal) * 100
            })).sort((a, b) => b.value - a.value);

            chartItems = breakdown.slice(0, topN); // Top N based on user input
            listItems = breakdown;

        } else {
            // Global View: All Operations
            total = items.reduce((acc, item) => acc + item.value, 0);

            // Top N Global for Chart
            chartItems = [...items].sort((a, b) => b.value - a.value).slice(0, topN);

            // All Operations for List
            listItems = items.map(item => ({
                name: item.name,
                value: item.value,
                percentage: total > 0 ? (item.value / total) * 100 : 0,
                subItems: item.subItems
            })).sort((a, b) => b.value - a.value);
        }

        return { chartData: chartItems, listData: listItems, totalPeriodCost: total };
    }, [aggregatedCosts, selectedOperation, topN]);



    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const exportToPDF = async () => {
        const input = document.getElementById('cost-report-container');
        if (!input) return;

        setGeneratingPDF(true); // Start loading

        try {
            // Using html-to-image for better Tailwind v4/oklab support
            const imgData = await toPng(input, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                style: { transform: 'scale(1)' } // Prevent scaling issues
            });

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Create an image to get natural dimensions
            const img = new Image();
            img.src = imgData;
            await new Promise((resolve) => { img.onload = resolve; });

            const imgWidth = img.width;
            const imgHeight = img.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`Relatorio_Custos_${startDate}_${endDate}.pdf`);
        } catch (error) {
            console.error("Error exporting PDF:", error);
            alert("Erro ao gerar PDF. Tente novamente.");
        } finally {
            setGeneratingPDF(false); // Stop loading
        }
    };

    return (
        <div id="cost-report-container" className={`w-full h-full flex flex-col gap-6 ${className}`}>
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

                    {/* Export PDF Button */}
                    {/* Export PDF Button */}
                    <button
                        onClick={exportToPDF}
                        disabled={generatingPDF}
                        className="p-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                        title={generatingPDF ? "Gerando..." : "Exportar PDF"}
                    >
                        {generatingPDF ? (
                            <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
                        ) : (
                            <span className="material-symbols-rounded text-xl">picture_as_pdf</span>
                        )}
                        <span className="font-medium text-sm">PDF</span>
                    </button>

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

                    {/* Date Range Selectors */}
                    <div className="flex items-center gap-2">
                        <div className="relative w-auto group">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none bg-white px-1">De</span>
                            <input
                                type="month"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-8 pr-2 py-2.5 bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium cursor-pointer shadow-sm text-sm"
                            />
                        </div>
                        <span className="text-gray-400">-</span>
                        <div className="relative w-auto group">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none bg-white px-1">Até</span>
                            <input
                                type="month"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-8 pr-2 py-2.5 bg-gray-50 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium cursor-pointer shadow-sm text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

                {/* Left: Bar Chart (Top Operations) */}
                {/* Left: Bar Chart (Top Operations) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-rounded text-blue-500">leaderboard</span>
                            {selectedOperation ? `Ranking: ${selectedOperation}` : "Ranking Global"}
                        </h3>
                        {/* Top N Input */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">Top:</span>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={topN}
                                onChange={(e) => setTopN(Math.max(1, parseInt(e.target.value) || 5))}
                                className="w-16 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-center outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
                            />
                        </div>
                    </div>

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
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
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
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${selectedOperation ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                                                        <span className="text-gray-900">{item.name}</span>
                                                    </div>
                                                    {/* Sub-items breakdown (Only in Global View or if subItems exists) */}
                                                    {!selectedOperation && item.subItems && (
                                                        <div className="pl-4 text-xs text-gray-500 space-y-0.5">
                                                            {Object.entries(item.subItems)
                                                                .sort(([, a], [, b]) => b - a)
                                                                .map(([subKey, subVal]) => (
                                                                    <div key={subKey} className="flex items-center gap-1">
                                                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                        <span>{subKey}:</span>
                                                                        <span className="font-mono text-gray-400">{formatCurrency(subVal)}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
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
            </div >
        </div >
    );
}
