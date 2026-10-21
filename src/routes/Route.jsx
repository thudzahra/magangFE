import { BrowserRouter, Routes, Route } from "react-router-dom";

import Signup from "../pages/Signup";
import Login from "../pages/Login";

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
      </Routes>
    </BrowserRouter>
  );
}