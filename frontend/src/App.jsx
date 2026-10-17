import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RoleSelection from "./pages/RoleSelection";
import ElderlyLogin from "./pages/ElderlyLogin";
import FamilyLogin from "./pages/FamilyLogin";
import CHWLogin from "./pages/CHWLogin";
import ClinicLogin from "./pages/ClinicLogin";
import AdminLogin from "./pages/AdminLogin";
import ElderlyDashboard from "./pages/ElderlyDashboard";
import FamilyDashboard from "./pages/FamilyDashboard";
import CHWDashboard from "./pages/CHWDashboard";
import ClinicDashboard from "./pages/ClinicDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PasswordReset from "./pages/PasswordReset";

function RequireDashboardRole({ role, children }) {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
  } catch {
    user = null;
  }
  return String(user?.role || "").toLowerCase() === role
    ? children
    : <Navigate to={`/login/${role}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<RoleSelection />}
        />

        <Route
          path="/login/elderly"
          element={<ElderlyLogin />}
        />

        <Route
          path="/login/family"
          element={<FamilyLogin />}
        />

        <Route
          path="/login/chw"
          element={<CHWLogin />}
        />

        <Route
          path="/login/clinic"
          element={<ClinicLogin />}
        />

        <Route
          path="/login/admin"
          element={<AdminLogin />}
        />

        <Route path="/forgot-password" element={<PasswordReset />} />

        <Route
          path="/dashboard/elderly"
          element={<RequireDashboardRole role="elderly"><ElderlyDashboard /></RequireDashboardRole>}
        />

        <Route
  path="/dashboard/family"
  element={<RequireDashboardRole role="family"><FamilyDashboard /></RequireDashboardRole>}
/>


<Route
  path="/dashboard/chw"
  element={<RequireDashboardRole role="chw"><CHWDashboard /></RequireDashboardRole>}
/>

<Route
  path="/dashboard/admin"
  element={<RequireDashboardRole role="admin"><AdminDashboard /></RequireDashboardRole>}
/>

 <Route
          path="/dashboard/clinic"
          element={<RequireDashboardRole role="clinic"><ClinicDashboard /></RequireDashboardRole>}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
