import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

import Layout from "./components/Layout";
import Assistant from "./pages/Assistant";
import Registration from "./pages/Registration";
import Engineering from "./pages/Engineering";
import ControlTower from "./pages/ControlTower";
import Planning from "./pages/Planning";
import BackLog from "./pages/BackLog";
import Residentes from "./pages/Residentes";
import LPU from "./pages/LPU";
import DiarioDeObra from "./pages/DiarioDeObra";
import Report from "./pages/Report";
import Settings from "./pages/Settings";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/engineering" element={<Engineering />} />
          <Route path="/control-tower" element={<ControlTower />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/backlog" element={<BackLog />} />
          <Route path="/residentes" element={<Residentes />} />
          <Route path="/lpu" element={<LPU />} />
          <Route path="/diario" element={<DiarioDeObra />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
