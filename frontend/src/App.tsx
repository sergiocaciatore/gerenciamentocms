import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RootRedirect from "./components/RootRedirect";
import Login from "./pages/meli/Login";
import RDLogin from "./pages/meli/RDLogin";
import RDDashboard from "./pages/meli/RDDashboard";
import PrivacyPolicy from "./pages/meli/PrivacyPolicy";
import Dashboard from "./pages/meli/Dashboard";
import SupplierLogin from "./pages/meli/SupplierLogin";

import Layout from "./components/Layout";
import Assistant from "./pages/meli/Assistant";
import Registration from "./pages/meli/Registration";
import Engineering from "./pages/meli/Engineering";
import ProjectAvoidance from "./pages/meli/ProjectAvoidance";
import ControlTower from "./pages/meli/ControlTower";
import Planning from "./pages/meli/Planning";
import BackLog from "./pages/meli/BackLog";
import Residentes from "./pages/meli/Residentes";
import LPU from "./pages/meli/LPU";
import DiarioDeObra from "./pages/meli/DiarioDeObra";
import Report from "./pages/meli/Report";
import WorksPP from "./pages/meli/WorksPP";
import Settings from "./pages/meli/Settings";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/rd" element={<RDLogin />} />
        <Route path="/rd/:userId" element={<RDDashboard />} />
        <Route path="/politica-privacidade" element={<PrivacyPolicy />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="/:userId" element={<Layout />}>
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
        <Route path="/fornecedor/login/:token" element={<SupplierLogin />} />
      </Routes>
    </Router>
  );
}

export default App;
