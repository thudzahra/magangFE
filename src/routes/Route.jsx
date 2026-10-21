import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "../pages/Signup";
import Login from "../pages/Login";
import AdminPage from "../admin/AdminPage";
import ProtectedRoute from "../admin/ProtectedRoute";

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
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminPage />
              </ProtectedRoute>
            }
        />
      </Routes>
    </BrowserRouter>
  );
}