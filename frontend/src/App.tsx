import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

// Layouts and critical structural components
import Layout from "./components/Layout";
import AmazonLayout from "./pages/amazon/Layout";

// Lazy Loaded Pages
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/mercadolivre/Login"));
const AmazonLogin = lazy(() => import("./pages/amazon/Login"));
const AmazonDashboard = lazy(() => import("./pages/amazon/Dashboard"));
const Register = lazy(() => import("./pages/amazon/Register"));
const RDLogin = lazy(() => import("./pages/meli/RDLogin"));
const RDDashboard = lazy(() => import("./pages/meli/RDDashboard"));
const PrivacyPolicy = lazy(() => import("./pages/meli/PrivacyPolicy"));
const Dashboard = lazy(() => import("./pages/meli/Dashboard"));
const SupplierLogin = lazy(() => import("./pages/meli/SupplierLogin"));
const Assistant = lazy(() => import("./pages/meli/Assistant"));
const Registration = lazy(() => import("./pages/meli/Registration"));
const Engineering = lazy(() => import("./pages/meli/Engineering"));
const ProjectAvoidance = lazy(() => import("./pages/meli/ProjectAvoidance"));
const ControlTower = lazy(() => import("./pages/meli/ControlTower"));
const Planning = lazy(() => import("./pages/meli/Planning"));
const BackLog = lazy(() => import("./pages/meli/BackLog"));
const Residentes = lazy(() => import("./pages/meli/Residentes"));
const LPU = lazy(() => import("./pages/meli/LPU"));
const DiarioDeObra = lazy(() => import("./pages/meli/DiarioDeObra"));
const Report = lazy(() => import("./pages/meli/Report"));
const WorksPP = lazy(() => import("./pages/meli/WorksPP"));
const Settings = lazy(() => import("./pages/meli/Settings"));

// Loading fallback for Suspense
const GlobalLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<GlobalLoader />}>
      <Routes>
        {/* Amazon Routes */}
        <Route path="/amazon" element={<AmazonLogin />} />
        <Route path="/amazon" element={<AmazonLayout />}>
           <Route path="dashboard" element={<AmazonDashboard />} />
           <Route path="register" element={<Register />} />
           <Route path="register/project" element={<div className="p-4">Nova Obra (Em Construção)</div>} />
           <Route path="register/supplier" element={<div className="p-4">Novo Fornecedor (Em Construção)</div>} />
           <Route path="register/venture" element={<div className="p-4">Novo Empreendimento (Em Construção)</div>} />
           <Route path="engineering" element={<div className="p-4">Engenharia (Em Construção)</div>} />
           <Route path="supply" element={<div className="p-4">Suprimentos (Em Construção)</div>} />
           <Route path="financial" element={<div className="p-4">Financeiro/Contratos (Em Construção)</div>} />
           <Route path="documents" element={<div className="p-4">Documentos/Atas (Em Construção)</div>} />
           <Route path="reports" element={<div className="p-4">Relatórios (Em Construção)</div>} />
        </Route>

        {/* Mercado Livre Routes */}
        <Route path="/mercadolivre/login" element={<Login />} />
        <Route path="/mercadolivre/:userId" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="registration" element={<Registration />} />
          <Route path="engineering" element={<Engineering />} />
          <Route path="project-avoidance" element={<ProjectAvoidance />} />
          <Route path="control-tower" element={<ControlTower />} />
          <Route path="planning" element={<Planning />} />
          <Route path="backlog" element={<BackLog />} />
          <Route path="residentes" element={<Residentes />} />
          <Route path="lpu" element={<LPU />} />
          <Route path="diario" element={<DiarioDeObra />} />
          <Route path="report" element={<Report />} />
          <Route path="obras-pp" element={<WorksPP />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* RD Routes */}
        <Route path="/rd" element={<RDLogin />} />
        <Route path="/rd/:userId" element={<RDDashboard />} />
        <Route path="/politica-privacidade" element={<PrivacyPolicy />} />
        <Route path="/" element={<Landing />} />
        <Route path="/fornecedor/login/:token" element={<SupplierLogin />} />
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
