import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Ticket, 
  Loader2, 
  Upload, 
  Trash2, 
  FileText, 
  Send, 
  MessageSquare, 
  Paperclip, 
  Building2,
  X,
  User,
  Users,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  author: string;
  message: string;
}

interface TicketFormData {
  title: string;
  description: string;
  department: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  comments: Comment[];
  attachments: File[];
}

interface UploadedAttachment {
  filename: string;
  url: string;
}

interface RecommendedUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  assignedTicketCount: number;
}

export default function NewTicketPage() {
  const [formData, setFormData] = useState<TicketFormData>({
    title: "",
    description: "",
    department: localStorage.getItem("user_department") || "",
    priority: "medium",
    assignee: undefined,
    comments: [],
    attachments: [],
  });
  
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);

  const navigate = useNavigate();
  const { toast } = useToast();
  
  const token = localStorage.getItem("auth_token") || "";
  const userRole = localStorage.getItem("user_role") || "employee";
  const userId = localStorage.getItem("user_id") || "";
  const userName = localStorage.getItem("user_name") || "Unknown User";
  const userDept = localStorage.getItem("user_department") || "";

  const departments = [
    "support team A",
    "software team",
    "network team", 
    "infrastructure team",
    "hardware team",
    "database team",
  ];

  // Fetch recommended assignees when department changes
  useEffect(() => {
    if (formData.department) {
      fetchRecommendedAssignees();
    }
  }, [formData.department]);

  const fetchRecommendedAssignees = async () => {
    if (!formData.department) return;
    
    setLoadingRecommendations(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/tickets/recommend-assignees?department=${encodeURIComponent(formData.department)}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setRecommendedUsers(data.recommendations || []);
      } else {
        console.error("Failed to fetch recommendations:", response.statusText);
        setRecommendedUsers([]);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendedUsers([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  // Enhanced file handling with drag & drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles],
      }));
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const newFiles = Array.from(files);
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles],
      }));
    }
  };

  // Remove individual attachment
  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      setFormData((prev) => ({
        ...prev,
        comments: [
          ...prev.comments,
          { 
            message: newComment.trim(), 
            author: userId // Using userId for backend
          }
        ],
      }));
      setNewComment("");
    }
  };

  // Remove comment
  const removeComment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      comments: prev.comments.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }
    if (!formData.department) {
      setError("Please select a department");
      return false;
    }
    return true;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "text-green-600 bg-green-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "urgent": return "text-red-600 bg-red-100";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError("");

    try {
      const uploadedAttachments: UploadedAttachment[] = [];
      
      if (formData.attachments.length > 0) {
        setIsUploadingFiles(true);
        
        for (const file of formData.attachments) {
          const uploadForm = new FormData();
          uploadForm.append("file", file);

          const uploadRes = await fetch("http://localhost:5000/api/upload", {
            method: "POST",
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
            body: uploadForm,
          });

          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            throw new Error(`File upload failed for ${file.name}: ${errorText}`);
          }

          const uploadData = await uploadRes.json();
          uploadedAttachments.push({
            url: uploadData.url,
            filename: uploadData.filename || file.name,
          });
        }
        
        setIsUploadingFiles(false);
      }

      // Create ticket with proper assignee handling
      const ticketBody = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        createdForUserId: userId,
        department: formData.department,
        // Fixed assignee handling
        ...(userRole === "manager" || userRole === "admin" 
          ? formData.assignee 
            ? { assignedTo: formData.assignee }  
            : {} 
          : {}),
        comments: formData.comments,
        attachments: uploadedAttachments,
      };

      const res = await fetch("http://localhost:5000/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(ticketBody),
      });

      const txt = await res.text();
      let data: any;
      try {
        data = JSON.parse(txt);
      } catch {
        data = txt;
      }

      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : data?.msg || "Failed to create ticket"
        );
      }

      const ticketId = data?.ticket?._id || data?._id || data?.ticket_id || "created";
      
      toast({
        title: "Ticket created successfully!",
        description: `Ticket has been created and assigned ID: ${ticketId.slice(-8).toUpperCase()}`,
        duration: 2000
      });

      // if (userRole === "manager" || userRole === "admin") {
      //   navigate("/dashboard/all-tickets");
      // } else {
      //   navigate("/dashboard/tickets");
      // }.

      navigate("/dashboard/tickets");
      
    } catch (err: any) {
      console.error("Error creating ticket:", err);
      setError(err.message || "Failed to create ticket. Please try again.");
    } finally {
      setIsLoading(false);
      setIsUploadingFiles(false);
    }
  };

  useEffect(() => {
  const fetchEmployees = async () => {
    if (userRole === "manager") {
      try {
        const res = await fetch(`http://localhost:5000/api/employees?department=${userDept}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        // assuming backend returns [{id, name}, ...]
        // console.log(data);
        setEmployees(data);
      } catch (err) {
        console.error("Failed to load employees", err);
      }
    }
  };
  fetchEmployees();
}, [userRole, userDept, token]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 max-w-7xl mx-auto">
      {/* Left side - Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Ticket</h1>
            <p className="text-muted-foreground mt-1">
              Submit a new IT support request with detailed information
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-gradient-card border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Ticket Details
            </CardTitle>
            <CardDescription>
              Provide detailed information about your IT support request
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Brief description of the issue"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Detailed description of the issue, steps to reproduce, expected behavior, etc."
                  rows={5}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Department & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) => handleInputChange("department", value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept.charAt(0).toUpperCase() + dept.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => handleInputChange("priority", value as any)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
                  

                  {userRole === "manager" && (
  <div className="space-y-2">
    <Label htmlFor="assignee">Assign To</Label>
    <Select
      value={formData.assignee}
      onValueChange={(value) => handleInputChange("assignee", value)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select employee" />
      </SelectTrigger>
      <SelectContent>
        {employees.map((emp) => (
          <SelectItem key={emp._id} value={emp._id}>
            {emp.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}

              <Separator />

              {/* Comments Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  <Label className="text-base font-semibold">Initial Comments</Label>
                  <Badge variant="secondary" className="text-xs">
                    {formData.comments.length}
                  </Badge>
                </div>
                
                {/* Add Comment */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add an initial comment or additional details..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isLoading}
                    className="self-end"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                {/* Display Comments - No author name shown */}
                {formData.comments.length > 0 && (
                  <div className="space-y-2">
                    {formData.comments.map((comment, idx) => (
                      <div key={idx} className="flex items-start justify-between bg-muted/30 p-3 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm">{comment.message}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeComment(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Enhanced Attachments Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  <Label className="text-base font-semibold">Attachments</Label>
                  <Badge variant="secondary" className="text-xs">
                    {formData.attachments.length}
                  </Badge>
                </div>

                {/* Enhanced File Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 ${
                    isDragOver ? 'border-blue-400 bg-blue-50' : 'border-muted'
                  } ${formData.attachments.length > 0 ? 'border-green-400 bg-green-50/50' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <div className="text-center space-y-2">
                    <Upload className={`w-8 h-8 mx-auto transition-colors duration-200 ${
                      isDragOver ? 'text-blue-500' : 'text-muted-foreground'
                    }`} />
                    <div className="text-sm">
                      <p className="font-medium">
                        {isDragOver ? 'Drop files here' : 'Click to select files or drag & drop'}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Supported: Images, Documents, Spreadsheets, Archives, Code files
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Max 10MB per file • Multiple files supported
                      </p>
                    </div>
                  </div>
                </div>

                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.csv,.json,.js,.tsx,.ts,.html,.css"
                />

                {/* Display Selected Attachments */}
                {formData.attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected files:</p>
                    {formData.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(idx)}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-gradient-primary hover:shadow-glow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isUploadingFiles ? "Uploading Files..." : "Creating Ticket..."}
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4 mr-2" />
                      Create Ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Enhanced Preview & Help */}
      <div className="space-y-6">
        {/* Ticket Preview */}
        <Card className="bg-gradient-card border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Ticket Preview</CardTitle>
            <CardDescription>
              Preview of your ticket before submission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.title && (
              <div>
                <Label className="text-xs text-muted-foreground">TITLE</Label>
                <p className="font-medium">{formData.title}</p>
              </div>
            )}
            
            {formData.department && (
              <div>
                <Label className="text-xs text-muted-foreground">DEPARTMENT</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm">{formData.department.charAt(0).toUpperCase() + formData.department.slice(1)}</span>
                </div>
              </div>
            )}
            
            <div>
              <Label className="text-xs text-muted-foreground">PRIORITY</Label>
              <Badge className={getPriorityColor(formData.priority)}>
                {formData.priority.toUpperCase()}
              </Badge>
            </div>
            
            {formData.comments.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">COMMENTS</Label>
                <p className="text-sm">{formData.comments.length} initial comment(s)</p>
              </div>
            )}
            
            {formData.attachments.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">ATTACHMENTS</Label>
                <p className="text-sm">{formData.attachments.length} file(s) selected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* NEW: Recommended Assignees */}
        {formData.department && (
          <Card className="bg-gradient-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Recommended Assignees
              </CardTitle>
              <CardDescription>
                Top available team members for {formData.department}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecommendations ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : recommendedUsers.length > 0 ? (
                <div className="space-y-3">
                  {recommendedUsers.map((user, index) => (
                    <div 
                      key={user._id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Star className="w-4 h-4 text-yellow-500" />}
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {user.assignedTicketCount} tickets
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    Sorted by current workload (least busy first)
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No team members found for {formData.department}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Card */}
        <Card className="bg-gradient-card border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Our IT support team is here to help you resolve any technical issues quickly and efficiently.
            </p>
            <div className="space-y-2 text-sm">
              <p><strong>Response Times:</strong></p>
              <ul className="space-y-1 text-muted-foreground ml-4">
                <li>• Urgent: Within 1 hour</li>
                <li>• High: Within 4 hours</li>
                <li>• Medium: Within 24 hours</li>
                <li>• Low: Within 72 hours</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
