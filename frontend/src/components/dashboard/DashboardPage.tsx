import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import EmployeeDashboard from "./EmployeeDashboard";
import ManagerDashboard from "./ManagerDashboard";

export default function DashboardPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const token = localStorage.getItem("auth_token");
    
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    setUserRole(role);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userRole) {
    return <Navigate to="/login" />;
  }

  if (userRole === "manager") {
    return <ManagerDashboard />;
  }

  return <EmployeeDashboard />;
}