import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { db, auth } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

interface RDSidebarProps {
    activePage: string;
    setActivePage: (page: string) => void;
}

export default function RDSidebar({ activePage, setActivePage }: RDSidebarProps) {
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserRole(docSnap.data().role);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                }
            } else {
                setUserRole(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate("/rd");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const menuItems = [
        { id: "available", label: "RD Disponíveis", icon: "assignment_add" },
        { id: "refunds", label: "Reembolso", icon: "attach_money" },
        { id: "my-rds", label: "Minhas RDs", icon: "inventory_2" },
        { id: "settings", label: "Configurações", icon: "settings" },
        ...(userRole === 'admin' ? [
            { id: "admin", label: "Administrativo", icon: "admin_panel_settings" },
            { id: "operations", label: "Operações", icon: "business_center" },
            { id: "history", label: "Históricos", icon: "history" },
            { id: "compiled-report", label: "Relatório Compilado", icon: "summarize" },
            { id: "cost-report", label: "Relatório de Custos", icon: "request_quote" },
            { id: "email-config", label: "Configuração de emails", icon: "mark_email_unread" }
        ] : [])
    ];

    return (
        <>
            {/* Mobile Menu Toggle - Floating Action Button style */}
            <div className="md:hidden fixed top-4 left-4 z-50">
                <button
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                    className="p-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 text-gray-700 active:scale-95 transition-all"
                >
                    <span className="material-symbols-rounded text-2xl">
                        {isMobileOpen ? "close" : "menu"}
                    </span>
                </button>
            </div>

            {/* Backdrop for Mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-50
                    h-screen md:h-auto
                    transition-all duration-300 ease-in-out cubic-bezier(0.4, 0, 0.2, 1)
                    ${isCollapsed ? "w-24" : "w-72"}
                    ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                    flex flex-col
                    p-4
                `}
            >
                {/* Glass Card */}
                <div className="h-full w-full rounded-3xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] flex flex-col overflow-hidden transition-all duration-300">

                    {/* Header / Collapse Toggle */}
                    <div className={`p-6 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
                        {!isCollapsed && (
                            <div className="flex items-center gap-3 transition-opacity duration-300">
                                <div className="p-2">
                                    <img src="/cms.svg" alt="CMS" className="w-8 h-8 object-contain" />
                                </div>
                                <span className="font-bold text-gray-800 tracking-tight">Portal RD</span>
                            </div>
                        )}

                        {/* Desktop Collapse Button */}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="hidden md:flex p-2 hover:bg-black/5 rounded-xl transition-colors text-gray-500 hover:text-gray-800"
                            title={isCollapsed ? "Expandir" : "Recolher"}
                        >
                            <span className="material-symbols-rounded">
                                {isCollapsed ? "dock_to_right" : "dock_to_left"}
                            </span>
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                        {menuItems.map((item) => {
                            const isActive = activePage === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActivePage(item.id);
                                        setIsMobileOpen(false);
                                    }}
                                    className={`
                                        w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-200 group
                                        ${isActive
                                            ? "bg-blue-600/10 text-blue-700 shadow-sm"
                                            : "hover:bg-white/50 text-gray-600 hover:text-gray-900"}
                                        ${isCollapsed ? "justify-center" : ""}
                                    `}
                                    title={isCollapsed ? item.label : ""}
                                >
                                    <span className={`material-symbols-rounded text-2xl transition-transform ${isActive ? "scale-110 fill-current" : "group-hover:scale-110"}`}>
                                        {item.icon}
                                    </span>

                                    {!isCollapsed && (
                                        <span className="font-medium whitespace-nowrap origin-left animate-in fade-in slide-in-from-left-2 duration-200">
                                            {item.label}
                                        </span>
                                    )}

                                    {/* Active Indicator Dot */}
                                    {!isCollapsed && isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer / Logout */}
                    <div className="p-4 mt-auto border-t border-gray-100/50">
                        <button
                            onClick={handleLogout}
                            className={`
                                w-full flex items-center gap-4 p-3.5 rounded-2xl 
                                hover:bg-red-50 text-gray-500 hover:text-red-600 
                                transition-all duration-200 group
                                ${isCollapsed ? "justify-center" : ""}
                            `}
                            title="Sair do Sistema"
                        >
                            <span className="material-symbols-rounded text-2xl group-hover:-translate-x-1 transition-transform">
                                logout
                            </span>
                            {!isCollapsed && (
                                <span className="font-medium">Sair</span>
                            )}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
