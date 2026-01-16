import { useState } from "react";
import RDSidebar from "./RDSidebar";
import Timesheet from "./rd/Timesheet";
import MyRDs from "./rd/MyRDs";
import Refunds from "./rd/Refunds";
import type { RDData } from "./rd/MyRDs";
import RDSettings from "./rd/RDSettings";
import AdminPanel from "./rd/AdminPanel";
import OperationsList from "./rd/OperationsList";
import HistoryList from "./rd/HistoryList";
import CompiledReport from "./rd/CompiledReport";

export default function RDDashboard() {
    const [activePage, setActivePage] = useState("available");
    const [selectedRD, setSelectedRD] = useState<RDData | null>(null);

    return (
        <div className="min-h-screen bg-gray-100 flex relative overflow-hidden">
            {/* Sidebar */}
            <RDSidebar
                activePage={activePage}
                setActivePage={(page) => {
                    setActivePage(page);
                    setSelectedRD(null); // Reset selection when changing tabs
                }}
            />

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 h-screen overflow-hidden flex flex-col p-4 md:p-6 lg:p-8">
                {/* Mobile Header Spacer */}
                <div className="h-16 md:hidden flex-shrink-0" />

                <div className="max-w-7xl mx-auto w-full h-full flex flex-col overflow-y-auto custom-scrollbar">
                    {activePage === "available" ? (
                        <Timesheet />
                    ) : activePage === "refunds" ? (
                        <Refunds />
                    ) : activePage === "my-rds" ? (
                        selectedRD ? (
                            <Timesheet
                                viewMode
                                initialData={selectedRD}
                                onBack={() => setSelectedRD(null)}
                            />
                        ) : (
                            <MyRDs onSelect={setSelectedRD} />
                        )
                    ) : activePage === "settings" ? (
                        <RDSettings />
                    ) : activePage === "admin" ? (
                        <AdminPanel />
                    ) : activePage === "operations" ? (
                        <OperationsList />
                    ) : activePage === "history" ? (
                        <HistoryList />
                    ) : activePage === "compiled-report" ? (
                        <CompiledReport />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Em desenvolvimento...
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
