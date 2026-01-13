import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";
import type { DayData } from "./TimesheetRow";
import type { SubOperation } from "../../constants/operations";
import type { RefundItem } from "./Refunds";

export interface RDData {
    id: string; // "YYYY-M"
    year: number;
    month: number;
    totalMinutes: number;
    daysWorked: number;
    data: Record<string, DayData>;
    status: string;
    invoiceUrl?: string | null;
    invoiceData?: { issuer: string; value: string; } | null;
    invoiceRejected?: boolean;
    operation?: string;
    subOperation?: SubOperation;
    createdAt?: { seconds: number; nanoseconds: number } | string | null;
    updatedAt?: { seconds: number; nanoseconds: number } | string | null;
    refunds?: RefundItem[];
}

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface MyRDsProps {
    onSelect: (rd: RDData) => void;
}

const formatDate = (timestamp: { seconds: number } | string | null | undefined) => {
    if (!timestamp) return "";
    const date = typeof timestamp === 'object' && 'seconds' in timestamp
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp as string);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function MyRDs({ onSelect }: MyRDsProps) {
    const [rds, setRds] = useState<RDData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRDs = async () => {
            if (!auth.currentUser) return;
            try {
                // Note: If orderBy causes an index error with where, we might need to create an index
                // or just sort client-side for now since volume is low.
                // Let's try flexible sorting client-side to avoid index requirement block.
                const qSnapshot = await getDocs(query(
                    collection(db, "users", auth.currentUser.uid, "rds"),
                    where("status", "==", "submitted")
                ));

                const loadedRDs: RDData[] = [];
                qSnapshot.forEach((doc) => {
                    loadedRDs.push({ id: doc.id, ...doc.data() } as RDData);
                });

                // Sort by year desc, month desc
                loadedRDs.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                });

                setRds(loadedRDs);
            } catch (error) {
                console.error("Error fetching RDs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRDs();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando suas RDs...</div>;
    }

    if (rds.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-rounded text-5xl text-gray-300">inventory_2</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma RD Enviada</h3>
                <p className="text-gray-500 max-w-sm">
                    Suas Relatórios Diários finalizados aparecerão aqui.
                    Acesse "RD Disponíveis" para preencher.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto p-1">
            {rds.map((rd) => (
                <button
                    key={rd.id}
                    onClick={() => onSelect(rd)}
                    className="flex flex-col bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group"
                >
                    <div className="flex justify-between items-start mb-2 w-full">
                        <h4 className="text-lg font-bold text-gray-800">
                            RD {MONTHS[rd.month]} {rd.year}
                        </h4>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg border ${rd.invoiceRejected
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-green-100 text-green-700 border-green-200"
                            }`}>
                            {rd.invoiceRejected ? "VERIFICAR NOTA" : "ENVIADA"}
                        </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                        <span className="material-symbols-rounded text-[14px]">event_available</span>
                        enviado em {formatDate(rd.updatedAt || rd.createdAt)}
                    </div>

                    <div className="flex gap-4 mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-800 text-lg">{rd.daysWorked}</span>
                            <span>Dias</span>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-gray-800 text-lg">
                                {Math.floor(rd.totalMinutes / 60)}h {rd.totalMinutes % 60}m
                            </span>
                            <span>Horas</span>
                        </div>
                    </div>

                    {/* Invoice Info */}
                    {(rd.invoiceUrl || rd.invoiceData) && !rd.invoiceRejected && (
                        <>
                            <div className="h-px w-full bg-gray-100 mb-4"></div>
                            <div className="flex flex-col gap-2 text-xs">
                                {rd.invoiceData && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Valor:</span>
                                            <span className="font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                                {rd.invoiceData.value}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Emissor</span>
                                            <span className="font-medium text-gray-700 truncate" title={rd.invoiceData.issuer}>
                                                {rd.invoiceData.issuer}
                                            </span>
                                        </div>
                                    </>
                                )}

                                {rd.invoiceUrl && (
                                    <a
                                        href={rd.invoiceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1 flex items-center justify-center gap-1.5 w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-xl transition-colors"
                                    >
                                        <span className="material-symbols-rounded text-sm">open_in_new</span>
                                        Ver Nota Fiscal
                                    </a>
                                )}
                            </div>
                        </>
                    )}
                </button>
            ))}
        </div>
    );
}
