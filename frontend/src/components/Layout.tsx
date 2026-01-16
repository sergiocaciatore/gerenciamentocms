import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import GoLiveWidget from "./GoLiveWidget";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function Layout() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                navigate("/login");
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-transparent">
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
