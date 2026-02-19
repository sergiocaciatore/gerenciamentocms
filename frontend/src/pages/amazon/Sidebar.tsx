import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import {
  HomeIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowLeftOnRectangleIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function AmazonSidebar({ onClose }: { onClose?: () => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Mock user data for now, or get from context/props if needed
  const userData = auth.currentUser;

  const menuItems = [
    { name: "Home", path: "/amazon/dashboard", icon: HomeIcon },
    { name: "Cadastro", path: "/amazon/register", icon: PlusCircleIcon },
    { name: "Engenharia", path: "/amazon/engineering", icon: ClipboardDocumentCheckIcon },
    { name: "Suprimentos", path: "/amazon/supply", icon: TruckIcon },
    { name: "Financeiro/Contratos", path: "/amazon/financial", icon: CurrencyDollarIcon },
    { name: "Documentos/Atas", path: "/amazon/documents", icon: DocumentTextIcon },
    { name: "Relatórios", path: "/amazon/reports", icon: ChartBarIcon },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/amazon");
  };

  return (
    <nav
      className={`relative flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-2rem)] h-full m-0 md:m-4 rounded-none md:rounded-3xl transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-20" : "w-64"
      } bg-[#232F3E] shadow-2xl border-r md:border border-white/10`}
    >
      {/* Header / Collapse Button */}
      <div className="flex items-center justify-between p-4 h-20 border-b border-white/10">
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-2">
             <div className="bg-white p-1 rounded-sm">
                <img src="/AMAZON.png" alt="Amazon" className="h-6 object-contain" />
             </div>
             <span className="font-bold text-lg text-white">Portal</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden md:block p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-colors ${isCollapsed ? "mx-auto" : ""}`}
        >
            {isCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                </svg>
            )}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
          >
             <XMarkIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 mx-2 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-[#FF9900] text-black font-medium shadow-sm"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={`${isActive ? "text-black" : "text-gray-400 group-hover:text-white"}`}>
                <item.icon className="w-6 h-6" />
              </span>
              {!isCollapsed && (
                <span className="ml-3 font-medium whitespace-nowrap overflow-hidden">{item.name}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10">
         <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
            {!isCollapsed && (
                 <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-orange-400 to-yellow-500 flex items-center justify-center text-white font-bold shadow-md">
                        {userData?.displayName?.charAt(0) || userData?.email?.charAt(0) || "U"}
                    </div>
                    <div className="flex flex-col truncate">
                        <span className="text-sm font-semibold text-white truncate">{userData?.displayName || userData?.email?.split('@')[0]}</span>
                    </div>
                 </div>
            )}
            <button
                onClick={handleLogout}
                className={`p-2 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors ${isCollapsed ? "" : "ml-2"}`}
                title="Sair"
            >
                <ArrowLeftOnRectangleIcon className="w-6 h-6" />
            </button>
         </div>
      </div>
    </nav>
  );
}
