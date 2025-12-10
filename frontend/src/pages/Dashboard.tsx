import { useState, useEffect } from "react";
import { getAuthToken } from "../firebase";
import Toast from "../components/Toast";

export default function Dashboard() {
    const [works, setWorks] = useState<any[]>([]);
    const [ocs, setOcs] = useState<any[]>([]);
    const [plannings, setPlannings] = useState<any[]>([]);
    const [occurrences, setOccurrences] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [selectedWorkId, setSelectedWorkId] = useState("all");
    const [activeTab, setActiveTab] = useState<'gerencial' | 'estrategico'>('gerencial');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = await getAuthToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            const [worksRes, ocsRes, planningsRes, occurrencesRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_BASE_URL}/works`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/ocs`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/plannings`, { headers }),
                fetch(`${import.meta.env.VITE_API_BASE_URL}/occurrences`, { headers })
            ]);

            if (worksRes.ok) setWorks(await worksRes.json());
            if (ocsRes.ok) setOcs(await ocsRes.json());
            if (planningsRes.ok) setPlannings(await planningsRes.json());
            if (occurrencesRes.ok) setOccurrences(await occurrencesRes.json());

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            setToast({ message: "Erro ao carregar dados.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    // Filter Data Logic
    const filteredWorks = selectedWorkId === "all"
        ? works
        : works.filter(w => w.id === selectedWorkId);

    // Calculate Financials for Chart and Categories
    const categoryTotals: Record<string, number> = {};

    const financialData = filteredWorks.map(work => {
        const bcValue = parseFloat(work.business_case?.replace(/[R$\s.]/g, '').replace(',', '.') || '0');

        const workOcs = ocs.filter(oc => oc.work_id === work.id);
        const realizedValue = workOcs.reduce((sum, oc) => {
            // Aggregate Category totals
            const desc = oc.description || "Outros";
            const val = oc.value || 0;
            categoryTotals[desc] = (categoryTotals[desc] || 0) + val;
            return sum + val;
        }, 0);

        // Get OCs details for tooltip
        const topOcs = workOcs
            .sort((a, b) => (b.value || 0) - (a.value || 0))
            .slice(0, 5) // Top 5 OCs
            .map(oc => ({ description: oc.description, value: oc.value || 0 }));

        return {
            id: work.id,
            regional: work.regional,
            bc: bcValue,
            realized: realizedValue,
            saving: bcValue - realizedValue,
            topOcs
        };
    }).sort((a, b) => b.bc - a.bc);

    // Calculate Totals based on Filter
    const totalBC = financialData.reduce((acc, item) => acc + item.bc, 0);
    const totalRealized = financialData.reduce((acc, item) => acc + item.realized, 0);
    const totalSaving = totalBC - totalRealized;

    // Process Categories for Visualization
    const sortedCategories = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // If more than 5 categories, group others (optional, but good for UI)
    // For now, let's list all or top 6
    const topCategories = sortedCategories; // .slice(0, 6);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const percentageConsumed = totalBC > 0 ? (totalRealized / totalBC) * 100 : 0;

    return (
        <div className="relative min-h-full w-full bg-gray-50/50">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Main Container */}
            <div className="p-6 max-w-[1920px] mx-auto space-y-6">

                {/* Tab Navigation */}
                <div className="flex justify-center mb-4">
                    <div className="bg-white/40 p-1.5 rounded-xl flex gap-1 shadow-sm border border-white/50 backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('gerencial')}
                            className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'gerencial'
                                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                }`}
                        >
                            Visão Gerencial
                        </button>
                        <button
                            onClick={() => setActiveTab('estrategico')}
                            className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'estrategico'
                                ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                                }`}
                        >
                            Visão Estratégica
                        </button>
                    </div>
                </div>

                {/* ================= GERENCIAL TAB ================= */}
                {activeTab === 'gerencial' && (
                    <div className="relative overflow-visible rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl p-6">
                        <div className="flex justify-between items-center mb-6 px-1">
                            <h2 className="text-lg font-bold text-gray-800">Financeiro Executivo</h2>
                            {/* Work Filter Dropdown */}
                            <div className="relative z-20">
                                <select
                                    value={selectedWorkId}
                                    onChange={(e) => setSelectedWorkId(e.target.value)}
                                    className="appearance-none bg-white/60 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm hover:bg-white transition-colors"
                                >
                                    <option value="all">Todas as Obras</option>
                                    {works.map(work => (
                                        <option key={work.id} value={work.id}>{work.regional} ({work.id})</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Top KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            {/* Business Case Total */}
                            <div className="bg-white/60 rounded-xl p-4 shadow-sm border border-white/60 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <svg className="w-16 h-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Business Case</h3>
                                <p className="text-2xl font-bold text-gray-900 mt-1 truncate" title={formatCurrency(totalBC)}>{formatCurrency(totalBC)}</p>
                                <div className="mt-2 text-xs text-gray-400">Orçamento Aprovado</div>
                            </div>

                            {/* Total Realized */}
                            <div className="bg-white/60 rounded-xl p-4 shadow-sm border border-white/60 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <svg className="w-16 h-16 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Consumido</h3>
                                <p className="text-2xl font-bold text-gray-900 mt-1 truncate" title={formatCurrency(totalRealized)}>{formatCurrency(totalRealized)}</p>
                                <div className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-bold">
                                    <span>{percentageConsumed.toFixed(1)}%</span>
                                    <span className="text-gray-400 font-normal">do total</span>
                                </div>
                            </div>

                            {/* Saving/Overrun */}
                            <div className="bg-white/60 rounded-xl p-4 shadow-sm border border-white/60 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo</h3>
                                <p className={`text-2xl font-bold mt-1 truncate ${totalSaving >= 0 ? 'text-green-600' : 'text-red-600'}`} title={formatCurrency(totalSaving)}>
                                    {formatCurrency(totalSaving)}
                                </p>
                                <div className="mt-2 text-xs text-gray-400">
                                    {totalSaving >= 0 ? "Disponível" : "Excedente"}
                                </div>
                            </div>
                        </div>

                        {/* Financial Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* CHART: Comparativo por Obra */}
                            <div className="bg-white/60 rounded-xl shadow-sm border border-white/60 p-5 flex flex-col h-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-800">Comparativo por Obra</h3>
                                    <div className="flex items-center gap-3 text-[10px] font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
                                            <span className="text-gray-600">BC</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 bg-orange-400 rounded-sm"></div>
                                            <span className="text-gray-600">Real</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-xs">Carregando...</div>
                                    ) : financialData.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-xs shadow-inner rounded-lg bg-gray-50">Sem dados.</div>
                                    ) : (
                                        financialData.map((item) => {
                                            const globalMax = Math.max(...financialData.map(d => Math.max(d.bc, d.realized)));
                                            const widthBC = (item.bc / globalMax) * 100;
                                            const widthRealized = (item.realized / globalMax) * 100;

                                            return (
                                                <div key={item.id} className="group relative">
                                                    <div className="flex justify-between text-xs mb-1 items-center">
                                                        <span className="font-semibold text-gray-700 w-1/3 truncate" title={item.regional}>
                                                            {item.id}
                                                        </span>
                                                        <div className="flex gap-4 text-right justify-end w-2/3 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-blue-600 font-medium whitespace-nowrap text-[10px] sm:text-xs">BC: {formatCurrency(item.bc)}</span>
                                                            <span className={`${item.realized > item.bc ? 'text-red-500 font-bold' : 'text-orange-500'} whitespace-nowrap text-[10px] sm:text-xs`}>
                                                                Real: {formatCurrency(item.realized)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="relative h-2 bg-gray-200/50 rounded-full w-full overflow-hidden">
                                                        <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full opacity-40 z-10" style={{ width: `${widthBC}%` }} />
                                                        <div className={`absolute top-0 left-0 h-full rounded-full z-20 ${item.realized > item.bc ? 'bg-red-500' : 'bg-orange-400'}`} style={{ width: `${widthRealized}%` }} />
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* CATEGORY DISTRIBUTION */}
                            <div className="bg-white/60 rounded-xl shadow-sm border border-white/60 p-5 flex flex-col h-full">
                                <h3 className="text-sm font-bold text-gray-800 mb-4">Gasto por Categoria (Descrição OC)</h3>

                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                                    {loading ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-xs">Carregando...</div>
                                    ) : topCategories.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400 text-xs bg-gray-50 rounded-lg">Sem gastos registrados.</div>
                                    ) : (
                                        topCategories.map((cat, idx) => {
                                            const maxCatVal = Math.max(...topCategories.map(c => c.value));
                                            const width = (cat.value / maxCatVal) * 100;

                                            return (
                                                <div key={idx} className="group">
                                                    <div className="flex justify-between items-center text-xs mb-1">
                                                        <span className="font-medium text-gray-700 truncate w-1/2" title={cat.name}>{cat.name}</span>
                                                        <span className="text-gray-900 font-bold">{formatCurrency(cat.value)}</span>
                                                    </div>
                                                    <div className="relative h-2 bg-gray-100 rounded-full w-full overflow-hidden">
                                                        <div
                                                            className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${width}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ================= ESTRATEGICO TAB ================= */}
                {activeTab === 'estrategico' && (
                    <>
                        {/* EXECUTIVE ANALYTICS SECTION */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                            {/* 1. Regional Analysis */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col">
                                <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                    </span>
                                    Análise Regional
                                </h3>
                                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {(() => {
                                        // Group works by regional
                                        const regionalData: Record<string, { count: number; bc: number; realized: number }> = {};

                                        works.forEach(w => {
                                            const reg = w.regional || "Outros";
                                            if (!regionalData[reg]) regionalData[reg] = { count: 0, bc: 0, realized: 0 };

                                            const bcValue = parseFloat(w.business_case?.replace('R$', '').replace(/\./g, '').replace(',', '.') || '0');
                                            const workOcs = ocs.filter(o => o.work_id === w.id);
                                            const realizedValue = workOcs.reduce((acc, curr) => acc + parseFloat(curr.value || '0'), 0);

                                            regionalData[reg].count += 1;
                                            regionalData[reg].bc += bcValue;
                                            regionalData[reg].realized += realizedValue;
                                        });

                                        const sortedRegions = Object.entries(regionalData).sort(([, a], [, b]) => b.bc - a.bc);

                                        return sortedRegions.map(([region, data]) => {
                                            const percent = data.bc > 0 ? (data.realized / data.bc) * 100 : 0;
                                            return (
                                                <div key={region} className="group p-3 bg-white/60 rounded-xl border border-white/60 hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-bold text-gray-700 text-sm">{region}</span>
                                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{data.count} obras</span>
                                                    </div>
                                                    <div className="flex justify-between items-end mb-1">
                                                        <span className="text-xs text-gray-500">Realizado</span>
                                                        <span className="text-xs font-mono font-medium text-gray-800">{formatCurrency(data.realized)}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1 overflow-hidden">
                                                        <div
                                                            className={`h-1.5 rounded-full transition-all duration-500 ${percent > 100 ? 'bg-red-500' : percent > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                                                            style={{ width: `${Math.min(percent, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-gray-400">Budget: {formatCurrency(data.bc)}</span>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* 2. Process Efficiency */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col">
                                <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                                    <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                                    </span>
                                    Eficiência de Processo
                                </h3>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    <table className="w-full text-left">
                                        <thead className="text-[10px] text-gray-500 uppercase border-b border-gray-200/50">
                                            <tr>
                                                <th className="pb-2 font-medium">Etapa (Gargalos)</th>
                                                <th className="pb-2 font-medium text-right">Atraso Médio</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs divide-y divide-gray-100">
                                            {(() => {
                                                const stageDelays: Record<string, { totalDays: number; count: number }> = {};

                                                plannings.forEach(p => {
                                                    if (!p.data?.schedule) return;
                                                    p.data.schedule.forEach((s: any) => {
                                                        if (s.end_planned && s.end_real) {
                                                            const planned = new Date(s.end_planned);
                                                            const real = new Date(s.end_real);
                                                            const diffTime = real.getTime() - planned.getTime();
                                                            const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

                                                            if (diffDays > 0) {
                                                                if (!stageDelays[s.name]) stageDelays[s.name] = { totalDays: 0, count: 0 };
                                                                stageDelays[s.name].totalDays += diffDays;
                                                                stageDelays[s.name].count += 1;
                                                            }
                                                        }
                                                    });
                                                });

                                                const sortedDelays = Object.entries(stageDelays)
                                                    .map(([name, data]) => ({ name, avg: data.totalDays / data.count, count: data.count }))
                                                    .sort((a, b) => b.avg - a.avg)
                                                    .slice(0, 5);

                                                if (sortedDelays.length === 0) return <tr><td colSpan={2} className="py-4 text-center text-gray-400">Sem atrasos registrados.</td></tr>;

                                                return sortedDelays.map((item, idx) => (
                                                    <tr key={idx} className="group hover:bg-white/50">
                                                        <td className="py-3 pr-2 text-gray-700 font-medium">
                                                            {item.name}
                                                            <span className="block text-[9px] text-gray-400 font-normal">{item.count} ocorrências</span>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold">
                                                                +{Math.round(item.avg)} dias
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 3. Risk Monitor */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col">
                                <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                                    <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    </span>
                                    Monitor de Risco
                                </h3>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {(() => {
                                        const risks = occurrences.filter(o => o.type === 'Fato Relevante');
                                        const worksAtRisk = new Set(risks.map(r => r.work_id)).size;

                                        return (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                                                        <p className="text-[10px] text-red-400 uppercase font-bold">Fatos Relevantes</p>
                                                        <p className="text-2xl font-bold text-red-600">{risks.length}</p>
                                                    </div>
                                                    <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                                                        <p className="text-[10px] text-orange-400 uppercase font-bold">Obras Impactadas</p>
                                                        <p className="text-2xl font-bold text-orange-600">{worksAtRisk}</p>
                                                    </div>
                                                </div>

                                                <h4 className="text-xs font-bold text-gray-500 uppercase mt-4">Últimos Registros</h4>
                                                <div className="space-y-2">
                                                    {risks.slice(0, 4).map((risk, idx) => {
                                                        const work = works.find(w => w.id === risk.work_id);
                                                        return (
                                                            <div key={idx} className="bg-white/60 p-2.5 rounded-lg border border-white/60 shadow-sm flex items-start gap-3">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-gray-800">{work?.regional || risk.work_id}</p>
                                                                    <p className="text-[11px] text-gray-600 leading-tight line-clamp-2">{risk.description}</p>
                                                                    <p className="text-[9px] text-gray-400 mt-1">{new Date(risk.date).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {risks.length === 0 && (
                                                        <div className="text-center py-6 text-gray-400 text-xs">Sem riscos críticos identificados.</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Works Dashboard Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column: GoLive Countdown */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col h-full">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold text-gray-800">Próximos Go-Lives</h2>
                                    <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">Dias Restantes</span>
                                </div>

                                <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar flex-1">
                                    {(() => {
                                        const goLiveWorks = works
                                            .filter(w => w.go_live_date)
                                            .map(w => {
                                                const planning = plannings.find(p => p.work_id === w.id);
                                                const schedule = planning?.data?.schedule || [];

                                                const goLiveStage = schedule.find((s: any) => s.name === "CloseOut - GoLive");
                                                const isFinished = !!goLiveStage?.end_real;

                                                if (isFinished) return null;

                                                const today = new Date();
                                                const targetDate = new Date(w.go_live_date);
                                                const diffTime = targetDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                                return {
                                                    id: w.id,
                                                    regional: w.regional,
                                                    site: w.site,
                                                    date: w.go_live_date,
                                                    days: diffDays,
                                                    planningId: planning?.id
                                                };
                                            })
                                            .filter((w): w is NonNullable<typeof w> => w !== null)
                                            .sort((a, b) => a.days - b.days);

                                        if (goLiveWorks.length === 0) {
                                            return <div className="text-center py-10 text-gray-400 text-sm">Nenhum Go-Live pendente encontrado.</div>;
                                        }

                                        return goLiveWorks.map((item) => (
                                            <div key={item.id} className="group bg-white/60 p-3 rounded-xl border border-white/60 shadow-sm hover:shadow-md transition-all flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm ${item.days < 0 ? 'bg-red-100 text-red-600' :
                                                        item.days <= 7 ? 'bg-orange-100 text-orange-600' :
                                                            item.days <= 30 ? 'bg-yellow-100 text-yellow-600' :
                                                                'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {item.days}d
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-800 text-sm">{item.regional}</h4>
                                                        <p className="text-[10px] text-gray-500">{item.site || `Obra ${item.id}`}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-xs font-bold text-gray-700">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-[10px] text-gray-400">Meta</span>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Right Column: Stage Tracking */}
                            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl p-6 flex flex-col h-full">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold text-gray-800">Acompanhamento de Etapas</h2>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-gray-200/60 flex-1">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-200 text-xs uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                            <tr>
                                                <th className="px-4 py-3">Obra</th>
                                                <th className="px-4 py-3">Previsto (Hoje)</th>
                                                <th className="px-4 py-3">Status Atual</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white/40 text-xs">
                                            {(() => {
                                                const trackingData = works.map(w => {
                                                    const planning = plannings.find(p => p.work_id === w.id);
                                                    if (!planning || !planning.data?.schedule) return null;

                                                    const schedule = planning.data.schedule;

                                                    const today = new Date().toISOString().split('T')[0];
                                                    const plannedStage = schedule.find((s: any) =>
                                                        s.start_planned && s.end_planned &&
                                                        s.start_planned <= today && s.end_planned >= today
                                                    );

                                                    let currentStage = schedule.find((s: any) => s.start_real && !s.end_real);
                                                    let statusType = 'progress';

                                                    if (!currentStage) {
                                                        const completed = [...schedule].reverse().find((s: any) => s.end_real);
                                                        if (completed) {
                                                            currentStage = completed;
                                                            statusType = 'done';
                                                        }
                                                    }

                                                    return {
                                                        id: w.id,
                                                        regional: w.regional,
                                                        planned: plannedStage?.name || "Fora do Cronograma",
                                                        current: currentStage?.name || "Não Iniciado",
                                                        statusType
                                                    };
                                                }).filter((x): x is NonNullable<typeof x> => x !== null);

                                                if (trackingData.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={3} className="py-8 text-center text-gray-400">Sem dados de planejamento.</td>
                                                        </tr>
                                                    );
                                                }

                                                return trackingData.map((row) => (
                                                    <tr key={row.id} className="hover:bg-white/60 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-gray-700">{row.regional}</td>
                                                        <td className="px-4 py-3 text-blue-600 font-medium">
                                                            <div className="flex items-center gap-1.5 align-middle">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                                {row.planned}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${row.statusType === 'progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                row.statusType === 'done' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                    'bg-gray-50 text-gray-600 border-gray-200'
                                                                }`}>
                                                                {row.statusType === 'progress' && <span className="relative flex h-2 w-2 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>}
                                                                {row.current}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
