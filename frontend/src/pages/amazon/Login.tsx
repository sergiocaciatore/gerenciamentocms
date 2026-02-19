import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function AmazonLogin() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [cnpj, setCnpj] = useState("");
    const [razaoSocial, setRazaoSocial] = useState("");
    const [error, setError] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);

    const handleBlurCNPJ = async () => {
        const cleanCNPJ = cnpj.replace(/\D/g, "");
        if (cleanCNPJ.length === 14) {
            setIsLoading(true);
            try {
                const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
                if (response.ok) {
                    const data = await response.json();
                    setRazaoSocial(data.razao_social);
                    setError("");
                } else {
                    setRazaoSocial("");
                    setError("CNPJ não encontrado.");
                }
            } catch (error) {
                console.error("Error fetching CNPJ:", error);
                setRazaoSocial("");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        // Create a copy of the input email for validation
        const trimmedEmail = email.trim();

        // Strict domain validation (Optional: customize for Amazon if needed)
        // if (!trimmedEmail.endsWith("@cmseng.com.br")) {
        //     setError("Acesso restrito: utilize um e-mail @cmseng.com.br");
        //     setIsLoading(false);
        //     return;
        // }

        const cleanCNPJ = cnpj.replace(/\D/g, "");
        let finalRazaoSocial = razaoSocial;

        // Strict password & CNPJ validation for sign up
        if (isSignUp) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordRegex.test(password)) {
                setError("A senha deve ter: min 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 especial (@$!%*?&).");
                setIsLoading(false);
                return;
            }
            if (cleanCNPJ.length > 0 && cleanCNPJ.length !== 14) {
                setError("CNPJ inválido (deixe em branco se for pessoa física).");
                setIsLoading(false);
                return;
            }

            // Try to fetch Razão Social if CNPJ is provided and name is still empty
            if (!finalRazaoSocial && cleanCNPJ.length === 14) {
                try {
                    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
                    if (response.ok) {
                        const data = await response.json();
                        finalRazaoSocial = data.razao_social;
                        setRazaoSocial(data.razao_social);
                    } else {
                        setError("CNPJ não encontrado na Receita Federal.");
                        setIsLoading(false);
                        return;
                    }
                } catch (err) {
                    console.error("Error fetching CNPJ in auth:", err);
                    setError("Erro ao validar CNPJ.");
                    setIsLoading(false);
                    return;
                }
            }
        }

        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
                // Save user data to Firestore
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: trimmedEmail,
                    cnpj: cleanCNPJ,
                    razaoSocial: finalRazaoSocial,
                    createdAt: new Date().toISOString(),
                    role: "user", // Default role
                    contractType: "CLT", // Default contract type
                    operation: "AMAZON" // Tagging user as Amazon operation
                });
                navigate(`/amazon/dashboard`); // Assuming dashboard route
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);

                // Check if user is archived
                const userDocRef = doc(db, "users", userCredential.user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists() && userDocSnap.data().archived) {
                    await signOut(auth);
                    setError("Conta arquivada. Entre em contato com o suporte.");
                    setIsLoading(false);
                    return;
                }

                navigate(`/amazon/dashboard`); // Assuming dashboard route
            }
        } catch (err: unknown) {
            console.error("Auth failed:", err);
            const firebaseError = err as { code?: string };
            // Translate common firebase errors
            if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
                setError("Email ou senha incorretos.");
            } else if (firebaseError.code === 'auth/email-already-in-use') {
                setError("Este e-mail já está em uso.");
            } else if (firebaseError.code === 'auth/weak-password') {
                setError("A senha deve ter pelo menos 6 caracteres.");
            } else if (firebaseError.code === 'auth/too-many-requests') {
                setError("Muitas tentativas falhas. Tente novamente mais tarde.");
            } else {
                setError("Falha na autenticação. Tente novamente.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-200">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-300/20 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-gray-300/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative w-full max-w-4xl rounded-2xl bg-white/80 shadow-2xl backdrop-blur-xl ring-1 ring-white/50 flex flex-col md:flex-row">

                {/* Left Side: Logo & Branding */}
                <div className="md:w-1/2 bg-gradient-to-br from-white to-gray-50 p-12 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 relative overflow-hidden">
                    <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] bg-center"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <img
                            src="/AMAZON.png"
                            alt="Logo Amazon"
                            className="w-48 h-auto mb-6 drop-shadow-lg transition-transform hover:scale-105 duration-500 object-contain"
                        />
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="md:w-1/2 p-12 flex flex-col justify-center bg-white/50">
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                            {isSignUp ? "Criar Conta Amazon" : "Acesso Amazon"}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isSignUp
                                ? "Preencha os dados para se registrar."
                                : "Por favor, insira suas credenciais para acessar."}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none placeholder:text-gray-400"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Senha</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none placeholder:text-gray-400"
                                placeholder="••••••••"
                            />
                        </div>

                        {isSignUp && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">CNPJ <span className="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                                    <input
                                        type="text"
                                        value={cnpj}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/\D/g, "");
                                            if (v.length <= 14) setCnpj(v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"));
                                        }}
                                        onBlur={handleBlurCNPJ}
                                        maxLength={18}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none placeholder:text-gray-400"
                                        placeholder="00.000.000/0000-00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nome / Razão Social <span className="text-gray-400 font-normal text-xs">(Opcional)</span></label>
                                    <input
                                        type="text"
                                        value={razaoSocial}
                                        onChange={(e) => setRazaoSocial(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none placeholder:text-gray-400"
                                        placeholder="Nome completo ou Razão Social"
                                    />
                                </div>
                            </>
                        )}

                        {/* Password Criteria Feedback (Only for Sign Up) */}
                        {isSignUp && (
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <div className={`flex items-center gap-1.5 ${password.length >= 8 ? "text-green-600 font-medium" : ""}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {password.length >= 8 ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="10" strokeWidth={2} className="opacity-20" />}
                                    </svg>
                                    Mín. 8 caracteres
                                </div>
                                <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(password) ? "text-green-600 font-medium" : ""}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {/[A-Z]/.test(password) ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="10" strokeWidth={2} className="opacity-20" />}
                                    </svg>
                                    1 Maiúscula
                                </div>
                                <div className={`flex items-center gap-1.5 ${/[a-z]/.test(password) ? "text-green-600 font-medium" : ""}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {/[a-z]/.test(password) ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="10" strokeWidth={2} className="opacity-20" />}
                                    </svg>
                                    1 Minúscula
                                </div>
                                <div className={`flex items-center gap-1.5 ${/\d/.test(password) ? "text-green-600 font-medium" : ""}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {/\d/.test(password) ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="10" strokeWidth={2} className="opacity-20" />}
                                    </svg>
                                    1 Número
                                </div>
                                <div className={`flex items-center gap-1.5 ${/[@$!%*?&]/.test(password) ? "text-green-600 font-medium" : ""}`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {/[@$!%*?&]/.test(password) ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="10" strokeWidth={2} className="opacity-20" />}
                                    </svg>
                                    1 Especial (@$!%*?&)
                                </div>
                            </div>
                        )}

                        <div className="pt-4 space-y-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3.5 px-6 rounded-xl bg-[#232F3E] text-white font-medium shadow-lg shadow-gray-900/20 hover:bg-[#131921] hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Processando...</span>
                                    </>
                                ) : (
                                    isSignUp ? "Criar Conta" : "Acessar Sistema"
                                )}
                            </button>

                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(!isSignUp);
                                        setError("");
                                    }}
                                    className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                                >
                                    {isSignUp
                                        ? "Já tem uma conta? Faça login"
                                        : "Não tem conta? Crie agora"}
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                        <p className="text-xs text-center text-gray-400">
                            &copy; {new Date().getFullYear()} Amazon CMS System.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
