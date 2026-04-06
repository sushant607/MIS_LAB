import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { 
  Home, 
  Ticket, 
  MessageSquare, 
  LogOut, 
  Menu,
  Bell,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface UserInfo {
  email: string;
  role: string;
  name?: string;
}

export default function DashboardLayout() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const role = localStorage.getItem("user_role");
    const email = localStorage.getItem("user_email");
    const name = localStorage.getItem("user_name");

    if (!token || !role || !email) {
      navigate("/login");
      return;
    }

    setUser({ email, role, name });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
      duration: 2000
    });
    
    navigate("/login");
  };

  if (!user) {
    return null; // Loading or redirecting
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-16 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-muted p-2 rounded-md">
                <Menu className="w-4 h-4" />
              </SidebarTrigger>
              <h1 className="text-lg font-semibold">IT Helpdesk</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {/* <Button 
                variant="ghost" 
                size="sm" 
                className="relative"
                onClick={() => navigate("/dashboard/notifications")}
              >
                <Bell className="w-4 h-4" />
                <Badge className="absolute -top-1 -right-1 w-2 h-2 p-0 bg-destructive" />
              </Button> */}
              
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                    {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : user.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
                
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}