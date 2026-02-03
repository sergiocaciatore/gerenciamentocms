import { Outlet, useNavigate, useParams } from "react-router-dom";
import Sidebar from "./Sidebar";
import GoLiveWidget from "./GoLiveWidget";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { AnimationProvider, useAnimation } from "../context/AnimationContext";

function LayoutContent() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const { isAnimationEnabled } = useAnimation(); // Consume context

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                navigate("/login");
            } else if (userId && user.uid !== userId) {
                // Se o ID da URL não bater com o usuário logado, redireciona para a URL correta
                navigate(`/${user.uid}/dashboard`, { replace: true });
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [navigate, userId]);

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className={`flex h-screen w-screen overflow-hidden ${isAnimationEnabled ? 'meli-animated-bg' : 'bg-gray-100'}`}>
            <Sidebar />
            <main className="flex-1 flex flex-col h-full p-4 transition-all duration-300">
                <div className="flex-1 overflow-auto rounded-3xl bg-white/10 shadow-xl backdrop-blur-md ring-1 ring-white/20 p-6">
                    <Outlet />
                </div>
            </main>
            <GoLiveWidget />
        </div>
    );
}

export default function Layout() {
    return (
        <AnimationProvider>
            <LayoutContent />
        </AnimationProvider>
    );
}
