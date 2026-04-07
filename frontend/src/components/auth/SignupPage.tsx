import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  UserPlus,
  Mail,
  Lock,
  User,
  Building,
  Eye,
  EyeOff,
  Headphones,
  Rocket,
  Users,
  ArrowRight,
  Zap,
  Monitor,
  Database,
  Network
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, RegisterRequest } from "@/services/api";

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  department: string;
  role: string;
  skills: string[];
}
// Skills dropdown list
const SKILLS = [
  "troubleshooting",
  "networking",
  "operating systems",
  "hardware support",
  "software installation",
  "database basics",
  "ticketing systems",
  "customer support",
  "communication"
];

// Add skills to formData state
skills: []

const DEPARTMENTS = [
  'support team A',
  'software team',
  'network team',
  'infrastructure team',
  'hardware team',
  'database team'
];

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' }
];

// Team collaboration illustration
const TeamIllustration = () => (
  <div className="relative w-80 h-80 flex items-center justify-center">
    {/* Main team circle */}
    <div className="relative">
      <div className="w-48 h-48 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-2xl flex items-center justify-center animate-pulse">
        <Users className="w-20 h-20 text-white/80" />
      </div>

      {/* Orbiting elements representing team members */}
      <div className="absolute -top-6 -left-6 w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
        <Monitor className="w-8 h-8 text-white" />
      </div>

      <div className="absolute -top-6 -right-6 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce delay-300">
        <Database className="w-8 h-8 text-white" />
      </div>

      <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center shadow-lg animate-bounce delay-500">
        <Network className="w-8 h-8 text-white" />
      </div>

      <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg animate-bounce delay-700">
        <Rocket className="w-8 h-8 text-white" />
      </div>

      {/* Connecting pulse */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-3 h-3 bg-pink-400 rounded-full animate-ping"></div>
      </div>
    </div>
  </div>
);

export default function SignupPage() {
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    role: "employee",
    skills: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.department) {
      setError("Department is required");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
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
      const registerData: RegisterRequest = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        department: formData.department,
        skills: formData.skills

      };

      const response = await apiService.register(registerData);

      // Store authentication data
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("user_role", response.user.role);
      localStorage.setItem("user_email", response.user.email);
      localStorage.setItem("user_name", response.user.name);
      localStorage.setItem("user_department", response.user.department);
      localStorage.setItem("user_id", response.user.id);

      if (response) {
        toast({
          title: "Account created successfully",
          description: `Welcome to IT Helpdesk, ${response.user.name}!`,
          duration: 2000
        });

        navigate('/dashboard');
      }
    } catch (err: unknown) {
      console.error("Registration error:", err);
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-100 relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-24 h-24 bg-purple-200/10 rounded-full animate-pulse"></div>
        <div className="absolute top-40 left-20 w-16 h-16 bg-pink-200/10 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-40 right-20 w-32 h-32 bg-rose-200/10 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 left-10 w-12 h-12 bg-indigo-200/10 rounded-full animate-pulse delay-500"></div>
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
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl">
                    <Headphones className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <UserPlus className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Join Our Team
                  </h1>
                  <p className="text-gray-600">Start Your IT Support Journey</p>
                </div>
              </div>

              {/* Custom Team Illustration */}
              <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
                <TeamIllustration />
              </div>
            </div>

            {/* Benefits - NORMAL SIZED */}
            <div className="grid grid-cols-1 gap-4 w-full max-w-md">
              <div className="flex items-center space-x-3 p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/40 transition-all">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Career Growth</p>
                  <p className="text-sm text-gray-600">Advance your IT skills</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/40 transition-all">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Amazing Team</p>
                  <p className="text-sm text-gray-600">Work with the best</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/40 transition-all">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Modern Tools</p>
                  <p className="text-sm text-gray-600">Latest technology stack</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Signup form */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Mobile header */}
            <div className="lg:hidden text-center space-y-2">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Join IT Helpdesk
                </h1>
              </div>
            </div>

            {/* Signup card - NORMAL SIZED */}
            <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="space-y-1 pb-6 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-gray-800">Create Account</CardTitle>
                <CardDescription className="text-gray-600">
                  Join our IT support team today
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
                    <Label htmlFor="name" className="text-gray-700">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        className="pl-10 h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

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
                        className="pl-10 h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-gray-700">Department</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 w-4 h-4 text-gray-400 z-10" />
                        <Select
                          value={formData.department}
                          onValueChange={(value) => handleSelectChange('department', value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="pl-10 h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept.charAt(0).toUpperCase() + dept.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {/* Skills field */}
                    <div className="space-y-2">
                      <Label htmlFor="skills">Skills</Label>
                      <Select
                        onValueChange={(value) => {
                          if (!formData.skills.includes(value)) {
                            setFormData((prev) => ({
                              ...prev,
                              skills: [...prev.skills, value],
                            }));
                          }
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a skill" />
                        </SelectTrigger>
                        <SelectContent>
                          {SKILLS.map((skill) => (
                            <SelectItem key={skill} value={skill}>
                              {skill.charAt(0).toUpperCase() + skill.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Show selected skills as removable badges */}
                      <div className={formData.skills.length>0 ? "flex flex-wrap gap-2 mt-2" : "space-y-2"}>
                        {formData.skills.map((skill) => (
                          <div
                            key={skill}
                            className="flex items-center bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  skills: prev.skills.filter((s) => s !== skill),
                                }))
                              }
                              className="ml-2 text-purple-500 hover:text-purple-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>


                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-gray-700">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => handleSelectChange('role', value)}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        placeholder="Create a password"
                        className="pl-10 pr-12 h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
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

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-gray-700">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        placeholder="Confirm your password"
                        className="pl-10 pr-12 h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="text-purple-600 hover:text-purple-700 font-medium hover:underline transition-colors"
                    >
                      Sign in here
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


