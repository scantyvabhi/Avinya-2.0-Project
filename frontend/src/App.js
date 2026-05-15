import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Machines from "@/pages/Machines";
import MachineDetail from "@/pages/MachineDetail";
import Simulation from "@/pages/Simulation";
import Alerts from "@/pages/Alerts";
import Maintenance from "@/pages/Maintenance";
import Reports from "@/pages/Reports";
import Energy from "@/pages/Energy";
import TestLab from "@/pages/TestLab";
import TechnicianDashboard from "@/pages/TechnicianDashboard";
import MyTasks from "@/pages/MyTasks";
import NewRequest from "@/pages/NewRequest";
import "@/App.css";

const Protected = ({ children }) => {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("pm_token") : null;
  if (!token && !user) return <Navigate to="/login" replace />;
  return children;
};

// Redirects /app -> the correct landing page based on role
const RoleDefault = () => {
  const { user } = useAuth();
  if (user?.role === "technician") return <Navigate to="my-dashboard" replace />;
  return <Navigate to="dashboard" replace />;
};

// Block owner-only pages from technicians
const OwnerOnly = ({ children }) => {
  const { user } = useAuth();
  if (user?.role === "technician") return <Navigate to="/app/my-dashboard" replace />;
  return children;
};

// Block technician-only pages from owners
const TechnicianOnly = ({ children }) => {
  const { user } = useAuth();
  if (user?.role && user.role !== "technician") return <Navigate to="/app/dashboard" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
                fontFamily: "IBM Plex Sans, sans-serif",
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/app"
              element={
                <Protected>
                  <AppLayout />
                </Protected>
              }
            >
              <Route index element={<RoleDefault />} />

              {/* Owner pages */}
              <Route path="dashboard"  element={<OwnerOnly><Dashboard /></OwnerOnly>} />
              <Route path="energy"     element={<OwnerOnly><Energy /></OwnerOnly>} />
              <Route path="reports"    element={<OwnerOnly><Reports /></OwnerOnly>} />
              <Route path="test-lab"   element={<OwnerOnly><TestLab /></OwnerOnly>} />

              {/* Technician pages */}
              <Route path="my-dashboard" element={<TechnicianOnly><TechnicianDashboard /></TechnicianOnly>} />
              <Route path="my-tasks"     element={<TechnicianOnly><MyTasks /></TechnicianOnly>} />

              {/* Shared pages */}
              <Route path="machines"        element={<Machines />} />
              <Route path="machines/:id"    element={<MachineDetail />} />
              <Route path="simulation"      element={<Simulation />} />
              <Route path="alerts"          element={<Alerts />} />
              <Route path="maintenance"     element={<Maintenance />} />
              <Route path="new-request"     element={<NewRequest />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
