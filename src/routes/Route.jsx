import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "../pages/Signup";
import Login from "../pages/Login";
import FormPengajuan from "../pages/FormPengajuan";
import AdminPage from "../pages/AdminPage";

export default function RouteApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
            path="/" 
            element={<Signup />} 
        />
        <Route 
            path="/signup" 
            element={<Signup />} 
        />
        <Route 
            path="/login" 
            element={<Login />} 
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