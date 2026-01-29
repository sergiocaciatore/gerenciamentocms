import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAuthToken } from "../../firebase";
import Toast from "../../components/Toast";
import Modal from "../../components/Modal";
import type { Message, AIConfig, GeneratedFile } from "../../types/Assistant";

const SUGGESTION_CHIPS = [
    "Resumir este documento",
    "Criar e-mail de cobrança",
    "Comparar orçamentos",
    "Status da obra RJ-001"
];

// Simple Material Calculator Logic
const calculateMaterials = (type: string, amount: number) => {
    switch (type) {
        case 'concrete':
            // 1m3 concrete = ~7 bags cement, 0.5m3 sand, 0.8m3 gravel
            return `Para ${amount}m³ de Concreto:\n- Cimento: ${(amount * 7).toFixed(1)} sacos\n- Areia: ${(amount * 0.5).toFixed(2)}m³\n- Brita: ${(amount * 0.8).toFixed(2)}m³`;
        case 'wall':
            // 1m2 wall = ~25 bricks, 0.02m3 mortar
            return `Para ${amount}m² de Parede:\n- Tijolos: ${(amount * 25).toFixed(0)} unid\n- Argamassa: ${(amount * 0.02).toFixed(3)}m³`;
        case 'paint':
            // 1m2 paint = ~0.1L
            return `Para ${amount}m² de Pintura (2 demãos):\n- Tinta: ${(amount * 0.25).toFixed(1)} Litros`;
        default:
            return '';
    }
};

export default function Assistant() {
    // Core State
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [documents, setDocuments] = useState<GeneratedFile[]>([]);

    // UI State (Phase 1 & 3)
    const [isSplitView, setIsSplitView] = useState(false); // Split View Mode
    const [splitTab, setSplitTab] = useState<"doc" | "draft" | "calc">("draft"); // Split View Tab
    const [isFocusMode, setIsFocusMode] = useState(false); // Focus Mode (Hide all sidebars)

    // RAG State (Phase 3)
    const [ragContext, setRagContext] = useState<"general" | "works" | "manuals">("general");

    // Draft State
    const [draftContent, setDraftContent] = useState("");

    // Calculator State
    const [calcType, setCalcType] = useState("concrete");
    const [calcAmount, setCalcAmount] = useState(1);
    const [calcResult, setCalcResult] = useState("");

    // Config State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [aiConfig, setAiConfig] = useState<AIConfig>({
        introduction: "",
        tone: "Estrategista",
        creativity: 0.5
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: Event) => {
            // Focus Input on '/'
            const key = (e as unknown as KeyboardEvent).key;
            if (key === "/" && document.activeElement !== inputRef.current) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load Config
    useEffect(() => {
        const savedConfig = localStorage.getItem("ai_config_default");
        if (savedConfig) {
            setAiConfig(JSON.parse(savedConfig));
        }
    }, []);

    const saveConfig = () => {
        localStorage.setItem("ai_config_default", JSON.stringify(aiConfig));
        setIsSettingsOpen(false);
        setToast({ message: "Preferências da IA salvas!", type: "success" });
    };

    // ... File Upload & Download handlers (kept same) ...
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                const fileId = data.file_id;
                const fileContextMessage = `[Arquivo Anexado]: ${file.name} (ID: ${fileId}). Use a ferramenta 'get_file_content' se precisar ler o conteúdo.`;
                setMessages((prev) => [...prev, { role: "user", content: fileContextMessage }]);
                setToast({ message: "Arquivo enviado com sucesso!", type: "success" });
                setInput(`Analise o arquivo anexado ${file.name}`);
            } else {
                setToast({ message: "Erro ao enviar arquivo.", type: "error" });
            }
        } catch (error) {
            console.error("Upload error:", error);
            setToast({ message: "Erro ao processar upload.", type: "error" });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDownload = async (doc: GeneratedFile) => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/download/${doc.file_id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = doc.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setDocuments(prev => prev.filter(d => d.file_id !== doc.file_id));
                setToast({ message: "Documento baixado e destruído!", type: "success" });
            } else {
                setToast({ message: "Erro: Documento expirado ou não encontrado.", type: "error" });
                if (response.status === 404) {
                    setDocuments(prev => prev.filter(d => d.file_id !== doc.file_id));
                }
            }
        } catch (error) {
            console.error("Download error:", error);
            setToast({ message: "Erro no download.", type: "error" });
        }
    };

    const handleSubmit = async (e: React.FormEvent, overrideInput?: string) => {
        e.preventDefault();
        const textToSend = overrideInput || input;

        if (!textToSend.trim() || isLoading) return;

        const userMessage = textToSend.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const token = await getAuthToken();
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: history,
                    config: aiConfig,
                    context: ragContext // Pass RAG context
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.response) {
                    setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
                }
                if (data.files && Array.isArray(data.files) && data.files.length > 0) {
                    setDocuments(prev => [...prev, ...data.files]);
                    setToast({ message: "Novos documentos gerados!", type: "success" });
                }
                if (data.error) {
                    setToast({ message: `Erro da IA: ${data.error}`, type: "error" });
                }
            } else {
                setToast({ message: "Erro de conexão com a IA.", type: "error" });
            }
        } catch (error) {
            console.error("Error calling AI:", error);
            setToast({ message: "Erro ao enviar mensagem.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    // Calculator Handler
    useEffect(() => {
        setCalcResult(calculateMaterials(calcType, calcAmount));
    }, [calcType, calcAmount]);

    // Layout Classes
    // specific margins not needed with flex layout, but keeping FocusMode logic for width
    const mainContainerClass = isFocusMode ? "max-w-5xl mx-auto" : "w-full";

    return (
        <div className="h-full w-full flex overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${mainContainerClass}`}>

                {/* Visual Settings / Focus Toggle Bar */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        {/* RAG Context Selector */}
                        <div className="flex items-center bg-white/40 rounded-lg p-1 border border-white/50 shadow-sm mr-2">
                            <button
                                onClick={() => setRagContext("general")}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${ragContext === "general" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                Geral
                            </button>
                            <button
                                onClick={() => setRagContext("works")}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${ragContext === "works" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                Obras
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button
                                onClick={() => setRagContext("manuals")}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${ragContext === "manuals" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                Normas
                            </button>
                        </div>

                        <button
                            onClick={() => setIsFocusMode(!isFocusMode)}
                            className={`p-2 rounded-lg transition-colors ${isFocusMode ? 'bg-blue-100 text-blue-600' : 'bg-white/40 hover:bg-white/60 text-gray-600'}`}
                            title="Modo Foco"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setIsSplitView(!isSplitView)}
                            className={`p-2 rounded-lg transition-colors hidden lg:block ${isSplitView ? 'bg-blue-100 text-blue-600' : 'bg-white/40 hover:bg-white/60 text-gray-600'}`}
                            title="Dividir Tela"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className={`flex-1 flex gap-4 min-h-0 ${isSplitView ? 'grid grid-cols-2' : ''}`}>
                    {/* Chat Container */}
                    <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl flex flex-col overflow-hidden relative h-full w-full">
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 opacity-70">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                    </svg>
                                    <p className="text-sm">Olá! Como posso ajudar na gestão das obras hoje?</p>
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                        max-w-[85%] rounded-2xl px-5 py-3 shadow-sm text-sm leading-relaxed
                                        ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}
                                    `}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                ul: ({ ...props }) => <ul className="list-disc pl-4 my-2" {...props} />,
                                                ol: ({ ...props }) => <ol className="list-decimal pl-4 my-2" {...props} />,
                                                li: ({ ...props }) => <li className="my-1" {...props} />,
                                                p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                a: ({ ...props }) => <a className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
                                                strong: ({ ...props }) => <strong className="font-bold" {...props} />,
                                                code: ({ ...props }) => <code className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono" {...props} />
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white text-gray-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm border border-gray-100 flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white/50 backdrop-blur-md border-t border-white/50">
                            {/* Quick Chips */}
                            {!input.trim() && (
                                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                                    {SUGGESTION_CHIPS.map(chip => (
                                        <button
                                            key={chip}
                                            onClick={(e) => handleSubmit(e, chip)}
                                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 whitespace-nowrap hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors shadow-sm"
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={(e) => handleSubmit(e)} className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Digite ou pressione '/' para focar..."
                                    disabled={isLoading}
                                    className="flex-1 rounded-xl border-gray-200 bg-white/80 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm outline-none disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 transform hover:scale-105 active:scale-95"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Split Content Area */}
                    {isSplitView && (
                        <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl flex flex-col overflow-hidden relative">
                            {/* Tabs */}
                            <div className="flex bg-white/30 backdrop-blur-md border-b border-white/50 p-2 gap-2">
                                <button
                                    onClick={() => setSplitTab("draft")}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${splitTab === "draft" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                    Rascunho
                                </button>
                                <button
                                    onClick={() => setSplitTab("calc")}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${splitTab === "calc" ? "bg-white shadow-sm text-purple-600" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                    Calculadora
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-4 overflow-y-auto">
                                {splitTab === "draft" && (
                                    <textarea
                                        value={draftContent}
                                        onChange={(e) => setDraftContent(e.target.value)}
                                        placeholder="Use este espaço para rascunhar respostas, anotações ou copiar partes do chat..."
                                        className="w-full h-full bg-transparent border-none outline-none resize-none text-gray-700 font-mono text-sm leading-relaxed"
                                    />
                                )}

                                {splitTab === "calc" && (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Tipo de Cálculo</label>
                                            <select
                                                value={calcType}
                                                onChange={(e) => setCalcType(e.target.value)}
                                                className="w-full rounded-xl border-gray-200 bg-white/80 px-4 py-3 text-sm"
                                            >
                                                <option value="concrete">Concreto (m³)</option>
                                                <option value="wall">Parede (m²)</option>
                                                <option value="paint">Pintura (m²)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Quantidade</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={calcAmount}
                                                onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                                                className="w-full rounded-xl border-gray-200 bg-white/80 px-4 py-3 text-sm"
                                            />
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <h4 className="text-sm font-bold text-blue-800 mb-2">Resultado Estimado</h4>
                                            <pre className="text-sm text-blue-700 whitespace-pre-wrap font-sans">{calcResult}</pre>
                                            <p className="text-[10px] text-blue-400 mt-2">*Estimativa base padrão. Consulte engenheiro.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar: Actions & Documents */}
            {!isFocusMode && (
                <div className="w-80 flex flex-col gap-4 pl-4 h-full overflow-y-auto shrink-0 border-l border-white/20">
                    {/* Actions Section */}
                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ações</h3>

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.43.872.95 1.113 1.545.085.211.24.373.435.451 1.884.757 3.242 2.457 3.242 4.52s-1.358 3.763-3.242 4.52a.75.75 0 00-.435.451c-.24.595-.618 1.115-1.113 1.545" />
                                    </svg>
                                </div>
                                Configurações IA
                            </div>
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isUploading}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
                            disabled={isUploading}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-green-100 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                                    </svg>
                                </div>
                                {isUploading ? "Enviando..." : "Anexar Documento"}
                            </div>
                        </button>
                    </div>

                    {/* Documents Section */}
                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl flex-1">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Documentos</h3>
                        {documents.length === 0 ? (
                            <div className="text-sm text-gray-400 italic text-center py-4">
                                Nenhum documento gerado
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                                {documents.map((doc) => (
                                    <button
                                        key={doc.file_id}
                                        onClick={() => handleDownload(doc)}
                                        className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group shrink-0"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                            </div>
                                            <span className="truncate">{doc.filename}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 group-hover:text-gray-600">
                                            ⬇
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Configurações */}
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Personalizar Assistente">
                <div className="space-y-6">
                    <p className="text-sm text-gray-500">
                        Ajuste o comportamento da IA para se adaptar ao seu estilo e necessidades.
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Se apresente para mim 🙂</label>
                        <textarea
                            value={aiConfig.introduction}
                            onChange={(e) => setAiConfig({ ...aiConfig, introduction: e.target.value })}
                            placeholder="Olá, sou o Sérgio, gerente de projetos focado em prazos..."
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 px-4 bg-white h-24 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Isso ajuda a IA a ter mais intimidade com você.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tom de Preferência</label>
                        <select
                            value={aiConfig.tone}
                            onChange={(e) => setAiConfig({ ...aiConfig, tone: e.target.value })}
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 px-4 bg-white"
                        >
                            <option value="Estrategista">Estrategista (Padrão)</option>
                            <option value="Técnico">Técnico</option>
                            <option value="Ideias">Ideias Criativas</option>
                            <option value="Gestor">Gestor</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            {aiConfig.tone === 'Técnico' && "Foco em contas, cálculos e planejamento detalhado."}
                            {aiConfig.tone === 'Estrategista' && "Foco em prever problemas, riscos e visão de longo prazo."}
                            {aiConfig.tone === 'Ideias' && "Foco em brainstorming e soluções fora da caixa."}
                            {aiConfig.tone === 'Gestor' && "Foco em organização, equipe e visão macro."}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Criatividade (Temperatura)</label>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">Preciso</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={aiConfig.creativity}
                                onChange={(e) => setAiConfig({ ...aiConfig, creativity: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-gray-500">Criativo</span>
                        </div>
                        <p className="text-center text-xs font-bold text-blue-600 mt-1">{aiConfig.creativity * 100}%</p>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={saveConfig}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
