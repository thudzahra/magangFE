
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "../pages/Signup";
import Login from "../pages/Login";
import ProtectedRoute from "../admin/ProtectedRoute";
import FormPengajuan from "../pages/FormPengajuan";
import AdminPage from "../pages/AdminPage";

export default function RouteApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/form-pengajuan"
          element={<FormPengajuan />}
        />
        <Route 
          path="/dashboard-admin" 
          element={<AdminPage />} 
        />
      </Routes>
    </BrowserRouter>
  );
}
