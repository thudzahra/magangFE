import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "../pages/Signup";
import Login from "../pages/Login";
import FormPengajuan from "../pages/FormPengajuan";

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
      </Routes>
    </BrowserRouter>
  );
}