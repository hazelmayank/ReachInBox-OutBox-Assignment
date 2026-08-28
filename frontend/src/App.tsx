import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ComposePage } from "./pages/ComposePage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner label="Checking your session…" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
    <Route path="/compose" element={<Protected><ComposePage /></Protected>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}
