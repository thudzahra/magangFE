
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "../pages/Signup";
import Login from "../pages/Login";
import AdminPage from "../admin/AdminPage";
import ProtectedRoute from "../admin/ProtectedRoute";
import FormPengajuan from "../pages/FormPengajuan";

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
      </Routes>
    </BrowserRouter>
  );
}
