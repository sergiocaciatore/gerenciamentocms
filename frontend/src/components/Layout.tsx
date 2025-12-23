import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import GoLiveWidget from "./GoLiveWidget";

export default function Layout() {
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
