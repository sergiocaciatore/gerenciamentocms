import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import AmazonSidebar from "./Sidebar";
import { Bars3Icon } from "@heroicons/react/24/outline";

export default function AmazonLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [prevPath, setPrevPath] = useState(location.pathname);

  // Close mobile menu when route changes
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
         setLoading(false);
      } else {
        navigate("/amazon");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-gray-100 relative">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-[#232F3E] p-4 text-white shadow-md z-40">
        <div className="flex items-center gap-3">
           <img src="/AMAZON.png" alt="Amazon" className="h-6 object-contain bg-white p-1 rounded-sm" />
           <span className="font-bold text-lg">Portal Amazon</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-md hover:bg-white/10 transition-colors">
           <Bars3Icon className="w-6 h-6" />
        </button>
      </div>

      {/* Main Container for Sidebar & Content */}
      <div className="flex flex-1 overflow-hidden relative">
          
          {/* Mobile Overlay Backdrop */}
          {mobileMenuOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity" 
              onClick={() => setMobileMenuOpen(false)} 
            />
          )}

          {/* Sidebar */}
          <div className={`
              absolute top-0 left-0 bottom-0 md:relative z-50 h-full 
              transform transition-transform duration-300 ease-in-out shrink-0
              ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}>
              <AmazonSidebar onClose={() => setMobileMenuOpen(false)} />
          </div>

          {/* Content */}
          <main className="flex-1 flex flex-col h-full min-w-0 p-2 md:p-4 transition-all duration-300 bg-gray-100">
             <div className="flex-1 overflow-auto rounded-2xl md:rounded-3xl bg-white shadow-xl p-4 md:p-6 w-full">
                <Outlet />
             </div>
          </main>
      </div>
    </div>
  );
}
