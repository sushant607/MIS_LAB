import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./components/dashboard/DashboardPage";
import MyTicketsPage from "./components/tickets/MyTicketsPage";
import AllTicketsPage from "./components/tickets/AllTicketsPage";
import NewTicketPage from "./components/tickets/NewTicketPage";
import TicketDetailsPage from "./components/tickets/TicketDetailsPage";
import ChatbotPage from "./components/tickets/ChatbotPage";
import NotificationsPage from "./components/notifications/NotificationsPage";
import NotFound from "./pages/NotFound";
import TeamWorkloadPage from "./components/dashboard/TeamWorkloadPage";

const queryClient = new QueryClient();

// Enhanced Authentication Hook
const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("auth_token");
      const userId = localStorage.getItem("user_id");
      const userName = localStorage.getItem("user_name");
      const userRole = localStorage.getItem("user_role");
      
      // Comprehensive auth check
      if (token && userId && userName && userRole) {
        setIsAuthenticated(true);
      } else {
        // Clear any partial authentication data
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_id");
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_department");
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage changes (multi-tab logout detection)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token") {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { isAuthenticated, isLoading };
};

// Loading Screen Component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Loading...</p>
      <p className="text-sm text-gray-500">Checking authentication</p>
    </div>
  </div>
);

// Enhanced Protected Route Component (blocks unauthenticated users)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  // FIXED: Force unauthenticated users to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Auth Route Component (prevents authenticated users from seeing login/signup)
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  // FIXED: Redirect authenticated users to dashboard (prevents back navigation to login)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Enhanced Role-based Route Component
const RoleBasedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const userRole = localStorage.getItem("user_role");
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(userRole || "")) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Smart Root Redirect Component
const RootRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Smart root redirect based on authentication status */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Auth routes - blocked for authenticated users */}
          <Route 
            path="/login" 
            element={
              <AuthRoute>
                <LoginPage />
              </AuthRoute>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <AuthRoute>
                <SignupPage />
              </AuthRoute>
            } 
          />
          
          {/* Protected dashboard routes - blocked for unauthenticated users */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="tickets" element={<MyTicketsPage />} />
            <Route path="tickets/new" element={<NewTicketPage />} />
            <Route path="tickets/:id" element={<TicketDetailsPage />} />
            <Route 
              path="all-tickets" 
              element={
                <RoleBasedRoute allowedRoles={["manager", "admin"]}>
                  <AllTicketsPage />
                </RoleBasedRoute>
              } 
            />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route 
              path="team-workload" 
              element={
                <RoleBasedRoute allowedRoles={["manager", "admin"]}>
                  <TeamWorkloadPage />
                </RoleBasedRoute>
              } 
            />
            <Route path="chatbot" element={<ChatbotPage />} />
          </Route>
          
          {/* Catch-all route aliases with authentication protection */}
          <Route 
            path="/tickets" 
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/tickets" replace />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tickets/new" 
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/tickets/new" replace />
              </ProtectedRoute>
            } 
          />
          {/* <Route 
            path="/all-tickets" 
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/all-tickets" replace />
              </ProtectedRoute>
            } 
          /> */}
          <Route 
            path="/chatbot" 
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/chatbot" replace />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/team-workload" 
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard/team-workload" replace />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch-all for any unmatched routes */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
