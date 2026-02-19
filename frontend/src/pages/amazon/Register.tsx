import { useState } from "react";
import {
  UserGroupIcon,
  MapIcon,
  UserIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import ProjectForm from "./forms/ProjectForm";
import SupplierForm from "./forms/SupplierForm";
import ResidentForm from "./forms/ResidentForm";
import CollaboratorForm from "./forms/CollaboratorForm";

export default function Register() {
  const [activeTab, setActiveTab] = useState<"project" | "supplier" | "resident" | "collaborator" | null>(null);

  const tabs = [
    {
      id: "project",
      label: "Obra",
      icon: MapIcon,
    },
    {
      id: "supplier",
      label: "Fornecedor",
      icon: UserGroupIcon,
    },
    {
      id: "resident",
      label: "Residente",
      icon: UserIcon,
    },
    {
      id: "collaborator",
      label: "Colaborador",
      icon: BriefcaseIcon,
    },
  ] as const;

  return (
    <div className="p-8">
        <div className="flex flex-col gap-6">
            {/* Header / Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                            activeTab === tab.id
                                ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                                : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-[#FF9900]" : "text-gray-400"}`} />
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 min-h-[600px]">
                {activeTab === "project" && <ProjectForm />}
                {activeTab === "supplier" && <SupplierForm />}
                {activeTab === "resident" && <ResidentForm />}
                {activeTab === "collaborator" && <CollaboratorForm />}

                {!activeTab && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p className="text-lg">Selecione uma opção acima para iniciar o cadastro.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}

