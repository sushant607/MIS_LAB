import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  Shield, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Headphones, 
  Zap, 
  Users, 
  ArrowRight,
  CheckCircle,
  Settings,
  Monitor,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, LoginRequest } from "@/services/api";

interface LoginFormData {
  email: string;
  password: string;
}

// Simple, elegant floating animation component
const ITIllustration = () => (
  <div className="relative w-80 h-80 flex items-center justify-center">
    {/* Main computer screen */}
    <div className="relative">
      <div className="w-48 h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-2xl flex items-center justify-center animate-pulse">
        <Monitor className="w-16 h-16 text-white/80" />
      </div>
      
      {/* Floating tech icons with smooth animations */}
      <div className="absolute -top-4 -left-4 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
        <CheckCircle className="w-6 h-6 text-white" />
      </div>
      
      <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-bounce delay-300">
        <Settings className="w-6 h-6 text-white animate-spin-slow" />
      </div>
      
      <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center shadow-lg animate-bounce delay-500">
        <Database className="w-6 h-6 text-white" />
      </div>
      
      <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg animate-bounce delay-700">
        <Shield className="w-6 h-6 text-white" />
      </div>
      
      {/* Connecting lines with pulse effect */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
      </div>
    </div>
  </div>
);

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('errors' in error && Array.isArray(error.errors) && error.errors[0]?.msg) {
        return error.errors[0].msg;
      }
    }
    return "An unexpected error occurred. Please try again.";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.password.trim()) {
      setError("Password is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError("");

    try {
      const loginData: LoginRequest = {
        email: formData.email,
        password: formData.password,
      };

      const response = await apiService.login(loginData);

      // Store authentication data
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("user_role", response.user.role);
      localStorage.setItem("user_email", response.user.email);
      localStorage.setItem("user_name", response.user.name);
      localStorage.setItem("user_department", response.user.department);
      localStorage.setItem("user_id", response.user.id);
      
      if(response){
        toast({
          title: "Login successful",
          description: `Welcome back, ${response.user.name}!`,
          duration: 2000
        });

        navigate('/dashboard');
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-24 h-24 bg-blue-200/10 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-purple-200/10 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-40 left-20 w-32 h-32 bg-indigo-200/10 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-10 w-12 h-12 bg-pink-200/10 rounded-full animate-pulse delay-500"></div>
      </div>
      
      {/* Main container */}
      <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Left side - Branding & Illustration */}
          <div className="hidden lg:flex flex-col items-center justify-center space-y-6 p-8">
            {/* Brand header */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                    <Headphones className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    IT Helpdesk
                  </h1>
                  <p className="text-gray-600">Professional Support Platform</p>
                </div>
              </div>

              {/* Custom IT Illustration */}
              <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
                <ITIllustration />
              </div>
            </div>

            {/* Feature highlights - NORMAL SIZED */}
            <div className="grid grid-cols-1 gap-4 w-full max-w-md">
              <div className="flex items-center space-x-3 p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/40 transition-all">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Secure & Reliable</p>
                  <p className="text-sm text-gray-600">Enterprise-grade security</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/40 transition-all">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Lightning Fast</p>
                  <p className="text-sm text-gray-600">Quick issue resolution</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/40 transition-all">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Team Collaboration</p>
                  <p className="text-sm text-gray-600">Work together seamlessly</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Login form */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Mobile header */}
            <div className="lg:hidden text-center space-y-2">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  IT Helpdesk
                </h1>
              </div>
            </div>

            {/* Login card - NORMAL SIZED */}
            <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="space-y-1 pb-6 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-gray-800">Welcome Back</CardTitle>
                <CardDescription className="text-gray-600">
                  Sign in to access your IT support dashboard
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {error && (
                  <Alert className="mb-4 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Enter your email"
                        className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Enter your password"
                        className="pl-10 pr-12 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Need an account?{" "}
                    <Link
                      to="/signup"
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                    >
                      Sign up here
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
