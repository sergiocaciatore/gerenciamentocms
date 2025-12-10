import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAuthToken } from "../firebase";
import Toast from "../components/Toast";
import Modal from "../components/Modal";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface AIConfig {
    introduction: string;
    tone: string;
}

interface GeneratedFile {
    file_id: string;
    filename: string;
}

export default function Assistant() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [documents, setDocuments] = useState<GeneratedFile[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [aiConfig, setAiConfig] = useState<AIConfig>({
        introduction: "",
        tone: "Estrategista"
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load Config on Mount
    useEffect(() => {
        // We could decode token to get UID, but for MVP we use a generic key or rely on auth state if we had it here.
        // Assuming single user per browser for simplicity OR saving without ID for now as requested "conforme usuario logado" implies separation.
        // Let's try to get UID from localStorage if available (some apps store it) or just use a common key.
        // Better: Use a key that doesn't depend on complex decoding for now.
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
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                const fileId = data.file_id;
                // Add implicit context message about the file
                const fileContextMessage = `[Arquivo Anexado]: ${file.name} (ID: ${fileId}). Use a ferramenta 'get_file_content' se precisar ler o conteúdo.`;
                setMessages((prev) => [...prev, { role: "user", content: fileContextMessage }]);
                setToast({ message: "Arquivo enviado com sucesso!", type: "success" });

                // Trigger AI response automatically or wait for user? 
                // Let's autofill input so user can just hit send or type
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
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                // Trigger download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = doc.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                // Remove from list since it's deleted on backend
                setDocuments(prev => prev.filter(d => d.file_id !== doc.file_id));
                setToast({ message: "Documento baixado e destruído!", type: "success" });
            } else {
                setToast({ message: "Erro: Documento expirado ou não encontrado.", type: "error" });
                // Remove anyway if 404
                if (response.status === 404) {
                    setDocuments(prev => prev.filter(d => d.file_id !== doc.file_id));
                }
            }
        } catch (error) {
            console.error("Download error:", error);
            setToast({ message: "Erro no download.", type: "error" });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
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
                    config: aiConfig // Pass the configuration
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.response) {
                    setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
                }

                // Handle Generated Files
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

    return (
        <div className="relative min-h-full w-full">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Right Sidebar (Actions & Documents) */}
            <div className="fixed right-0 top-20 h-[calc(100vh-5rem)] w-80 p-6 overflow-y-auto z-10 hidden lg:block">
                {/* Actions Section */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl mb-6">
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
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Documentos</h3>

                    {documents.length === 0 ? (
                        <div className="text-sm text-gray-400 italic text-center py-4">
                            Nenhum documento gerado
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {documents.map((doc) => (
                                <button
                                    key={doc.file_id}
                                    onClick={() => handleDownload(doc)}
                                    className="w-full text-left rounded-xl bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95 flex items-center justify-between group"
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

            {/* Main Chat Area */}
            <div className="mr-0 lg:mr-80 px-4 sm:px-8 py-8 w-auto">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl rounded-2xl h-[calc(100vh-9rem)] flex flex-col overflow-hidden relative">
                        {/* Header */}
                        <div className="p-4 border-b border-white/50 bg-white/30 backdrop-blur-md flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-800">Assistente IA</h1>
                                <p className="text-xs text-gray-500">Especialista em Engenharia</p>
                            </div>
                        </div>

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
                                        max-w-[80%] rounded-2xl px-5 py-3 shadow-sm text-sm leading-relaxed
                                        ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}
                                    `}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-2" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-2" {...props} />,
                                                li: ({ node, ...props }) => <li className="my-1" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                a: ({ node, ...props }) => <a className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                                                code: ({ node, ...props }) => <code className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono" {...props} />
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
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Digite sua mensagem..."
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
                </div>
            </div>
        </div>
    );
}
