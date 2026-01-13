import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase";
import { OPERATIONS, OPERATION_DETAILS } from "../../constants/operations";
import type { SubOperation } from "../../constants/operations";

interface OperationData {
    name: string; // The ID of the doc
    subOperations: SubOperation[];
}

export default function OperationsList() {
    const [expandedOp, setExpandedOp] = useState<string | null>("CMS");
    const [searchTerm, setSearchTerm] = useState("");
    const [operations, setOperations] = useState<OperationData[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [isNewOpModalOpen, setIsNewOpModalOpen] = useState(false);
    const [newOpName, setNewOpName] = useState("");

    const [isNewSubModalOpen, setIsNewSubModalOpen] = useState(false);
    const [selectedOpForSub, setSelectedOpForSub] = useState<string | null>(null);
    const [newSubOp, setNewSubOp] = useState<SubOperation>({ cte: 0, contabil: "", obra: "" });

    // Initial Load & Migration
    useEffect(() => {
        loadOperations();
    }, []);

    const loadOperations = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "operations"));
            const fetchedOps: OperationData[] = [];

            if (querySnapshot.empty) {
                // Migration: Populate from constants if empty
                console.log("Migrating static operations to Firestore...");
                for (const opName of OPERATIONS) {
                    const subs = OPERATION_DETAILS[opName] || [];
                    await setDoc(doc(db, "operations", opName), { subOperations: subs });
                    fetchedOps.push({ name: opName, subOperations: subs });
                }
            } else {
                querySnapshot.forEach((doc) => {
                    fetchedOps.push({
                        name: doc.id,
                        subOperations: doc.data().subOperations || []
                    });
                });
            }
            setOperations(fetchedOps);
        } catch (error) {
            console.error("Error loading operations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOperation = useCallback(async () => {
        if (!newOpName.trim()) return;
        try {
            const opName = newOpName.trim().toUpperCase();
            await setDoc(doc(db, "operations", opName), { subOperations: [] });
            setOperations(prev => [...prev, { name: opName, subOperations: [] }]);
            setIsNewOpModalOpen(false);
            setNewOpName("");
        } catch (error) {
            console.error("Error creating operation:", error);
            alert("Erro ao criar operação. Tente novamente.");
        }
    }, [newOpName]);

    const handleCreateSubOperation = useCallback(async () => {
        if (!selectedOpForSub || !newSubOp.cte || !newSubOp.contabil || !newSubOp.obra) {
            alert("Preencha todos os campos obrigatórios.");
            return;
        }

        try {
            await updateDoc(doc(db, "operations", selectedOpForSub), {
                subOperations: arrayUnion(newSubOp)
            });

            setOperations(prev => prev.map(op => {
                if (op.name === selectedOpForSub) {
                    return { ...op, subOperations: [...op.subOperations, newSubOp] };
                }
                return op;
            }));

            setIsNewSubModalOpen(false);
            setNewSubOp({ cte: 0, contabil: "", obra: "" });
        } catch (error) {
            console.error("Error creating sub-operation:", error);
            alert("Erro ao criar sub-operação.");
        }
    }, [selectedOpForSub, newSubOp]);

    const filteredOperations = operations.filter(op =>
        op.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Shortcuts for Modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // New Sub-Operation Modal (Priority)
            if (isNewSubModalOpen) {
                if (e.key === "Escape") {
                    setIsNewSubModalOpen(false);
                } else if (e.key === "Enter" && newSubOp.cte && newSubOp.contabil && newSubOp.obra) {
                    handleCreateSubOperation();
                }
                return; // Stop propagation to lower modals if any
            }

            // New Operation Modal
            if (isNewOpModalOpen) {
                if (e.key === "Escape") {
                    setIsNewOpModalOpen(false);
                } else if (e.key === "Enter" && newOpName.trim()) {
                    handleCreateOperation();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isNewOpModalOpen, isNewSubModalOpen, newOpName, newSubOp, handleCreateOperation, handleCreateSubOperation]);

    return (
        <div className="flex flex-col h-full gap-6 animate-fadeIn p-4 md:p-6">
            {/* Search Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="relative w-full sm:max-w-md">
                    <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar operação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-700"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 font-medium hidden sm:block">
                        {filteredOperations.length} registros
                    </div>
                    <button
                        onClick={() => setIsNewOpModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                        <span className="material-symbols-rounded text-xl">add</span>
                        NOVO
                    </button>
                </div>
            </div>

            {/* List Layout - Full Width */}
            <div className="flex flex-col gap-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Carregando operações...</div>
                ) : (
                    filteredOperations.map((op) => {
                        const isExpanded = expandedOp === op.name;

                        return (
                            <div
                                key={op.name}
                                className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-blue-500/10 shadow-md' : 'hover:shadow-md hover:border-blue-200'}`}
                            >
                                <div
                                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedOp(isExpanded ? null : op.name)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-colors ${isExpanded ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                                            <span className="material-symbols-rounded">business_center</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-lg">{op.name}</h3>
                                    </div>
                                    <span className={`material-symbols-rounded text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                                        expand_more
                                    </span>
                                </div>

                                {/* Sub-operations Table with Smooth Animation */}
                                <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                    <div className="overflow-hidden">
                                        <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-6">
                                            <div className="flex justify-end mb-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedOpForSub(op.name);
                                                        setIsNewSubModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all text-sm font-medium shadow-sm"
                                                >
                                                    <span className="material-symbols-rounded text-lg">add</span>
                                                    Nova Operação
                                                </button>
                                            </div>

                                            {op.subOperations && op.subOperations.length > 0 ? (
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
                                                    <table className="w-full text-left text-sm min-w-[600px]">
                                                        <thead className="bg-gray-100 text-gray-600 font-medium">
                                                            <tr>
                                                                <th className="p-3 w-24 text-center">Cte.</th>
                                                                <th className="p-3 w-32">Contábil</th>
                                                                <th className="p-3">Obra</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {op.subOperations.map((sub, idx) => (
                                                                <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                                                    <td className="p-3 text-center font-mono text-gray-500">{sub.cte}</td>
                                                                    <td className="p-3 font-mono text-gray-700">{sub.contabil}</td>
                                                                    <td className="p-3 font-medium text-gray-800">{sub.obra}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-400 italic text-sm p-4 justify-center bg-white rounded-xl border border-dashed border-gray-300">
                                                    <span className="material-symbols-rounded text-base">info</span>
                                                    Nenhuma sub-operação cadastrada.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal: Nova Operação */}
            {isNewOpModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scaleIn">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Nova Operação</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Operação</label>
                                <input
                                    type="text"
                                    value={newOpName}
                                    onChange={(e) => setNewOpName(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all uppercase"
                                    placeholder="Ex: AMAZON"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsNewOpModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateOperation}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!newOpName.trim()}
                            >
                                Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Nova Sub-operação */}
            {isNewSubModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scaleIn">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Nova Sub-operação</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cte (Número)</label>
                                <input
                                    type="number"
                                    value={newSubOp.cte || ""}
                                    onChange={(e) => setNewSubOp({ ...newSubOp, cte: Number(e.target.value) })}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: 1234"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contábil</label>
                                <input
                                    type="text"
                                    value={newSubOp.contabil}
                                    onChange={(e) => setNewSubOp({ ...newSubOp, contabil: e.target.value })}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: 111.222"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Obra (Descrição)</label>
                                <input
                                    type="text"
                                    value={newSubOp.obra}
                                    onChange={(e) => setNewSubOp({ ...newSubOp, obra: e.target.value })}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: Manutenção SP"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsNewSubModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateSubOperation}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!newSubOp.cte || !newSubOp.contabil || !newSubOp.obra}
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
