import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Edit, Save, X, Calendar, User, Building2, Flag, Clock, Plus, Send, Paperclip, Trash2, MessageSquare, Upload, FileText, Info, Image, FileArchive, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface Comment {
  _id: string;
  author: { _id: string; name: string };
  message: string;
  createdAt: string;
}

interface Attachment {
  _id: string;
  filename: string;
  url: string;
}

interface TicketData {
  _id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  department: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    role?: string;
    department?: string;
  };
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    role?: string;
    department?: string;
  };
  comments: Comment[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  tags: [string];
}

interface FormData {
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
}

// ENHANCED: File type configuration
const SUPPORTED_FILE_TYPES = {
  images: {
    icon: <Image className="w-4 h-4" />,
    label: "Images",
    extensions: ["JPG", "JPEG", "PNG", "GIF", "WEBP", "BMP", "SVG"],
    accept: ".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"
  },
  documents: {
    icon: <FileText className="w-4 h-4" />,
    label: "Documents", 
    extensions: ["PDF", "DOC", "DOCX", "TXT", "RTF", "MD"],
    accept: ".pdf,.doc,.docx,.txt,.rtf,.md"
  },
  spreadsheets: {
    icon: <FileSpreadsheet className="w-4 h-4" />,
    label: "Spreadsheets",
    extensions: ["XLS", "XLSX", "CSV"],
    accept: ".xls,.xlsx,.csv"
  },
  archives: {
    icon: <FileArchive className="w-4 h-4" />,
    label: "Archives",
    extensions: ["ZIP", "RAR", "7Z", "TAR", "GZ"],
    accept: ".zip,.rar,.7z,.tar,.gz"
  },
  code: {
    icon: <FileText className="w-4 h-4" />,
    label: "Code Files",
    extensions: ["JS", "JSX", "TS", "TSX", "HTML", "CSS", "JSON", "XML"],
    accept: ".js,.jsx,.ts,.tsx,.html,.css,.json,.xml"
  }
};

// Helper function for error handling
const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
};

// Get file icon based on extension
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toUpperCase() || '';
  
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP', 'SVG'].includes(ext)) {
    return <Image className="w-4 h-4 text-blue-500" />;
  }
  if (['PDF', 'DOC', 'DOCX', 'TXT', 'RTF', 'MD'].includes(ext)) {
    return <FileText className="w-4 h-4 text-red-500" />;
  }
  if (['XLS', 'XLSX', 'CSV'].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
  }
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) {
    return <FileArchive className="w-4 h-4 text-purple-500" />;
  }
  return <FileText className="w-4 h-4 text-gray-500" />;
};

// Validate file type
const isValidFileType = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const allExtensions = Object.values(SUPPORTED_FILE_TYPES)
    .flatMap(type => type.extensions.map(e => e.toLowerCase()));
  return allExtensions.includes(ext);
};

// Get combined accept string for all file types
const getAllAcceptTypes = (): string => {
  return Object.values(SUPPORTED_FILE_TYPES)
    .map(type => type.accept)
    .join(',');
};

// API calls using direct fetch
const makeApiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`http://localhost:5000/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  if (!response.ok) {
    throw new Error(data.msg || data.message || `Request failed with status ${response.status}`);
  }

  return data;
};

export default function TicketDetailsPage() {
  // Extract ticketId with proper typing and fallback
  const params = useParams();
  const ticketId = params.ticketId || params.id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    status: "open",
    priority: "low",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");

  // Comment and attachment states
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFileTypeInfo, setShowFileTypeInfo] = useState(false); // NEW: Toggle for file type info

  // Get user info from localStorage
  const userRole = localStorage.getItem("user_role");
  const userId = localStorage.getItem("user_id");
  const userDepartment = localStorage.getItem("user_department");
  const userName = localStorage.getItem("user_name");

  // +++ Add below existing useState declarations +++
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'] as const;
const [statusDraft, setStatusDraft] = useState<(typeof STATUS_OPTIONS)[number]>('open');
const [saving, setSaving] = useState(false);

  // Check if edit mode is requested from URL
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && ticket) {
      setIsEditing(true);
    }
  }, [searchParams, ticket]);

  // Fetch ticket data
useEffect(() => {
  const fetchTicket = async () => {
    if (!ticketId) {
      setError("No ticket ID provided");
      setIsFetching(false);
      return;
    }

    // Validate ticketId format (should be MongoDB ObjectId)
    if (ticketId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(ticketId)) {
      setError("Invalid ticket ID format");
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setError("");

    try {
      const response = await makeApiCall(`/tickets/${ticketId}`);
      const ticketData = response.ticket || response;

      if (!ticketData || !ticketData._id) {
        throw new Error('Invalid ticket data received');
      }

      setTicket(ticketData);

      // +++ NEW: initialize status dropdown draft from fetched ticket +++
      setStatusDraft(
        ['open','in_progress','resolved','closed'].includes(ticketData.status)
          ? ticketData.status
          : 'open'
      );
      // +++ END NEW +++

      // Initialize form data (unchanged)
      setFormData({
        title: ticketData.title || "",
        description: ticketData.description || "",
        status: ticketData.status || "open",
        priority: ticketData.priority || "low",
      });
    } catch (err: unknown) {
      console.error("Error fetching ticket:", err);
      setError(getErrorMessage(err));
    } finally {
      setIsFetching(false);
    }
  };

  fetchTicket();
}, [ticketId]);

  // Keep all your existing handler functions (getStatusColor, getPriorityColor, etc.)
  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500 hover:bg-blue-600 text-white";
      case "in_progress": return "bg-amber-500 hover:bg-amber-600 text-white";
      case "resolved": return "bg-green-500 hover:bg-green-600 text-white";
      case "closed": return "bg-gray-500 hover:bg-gray-600 text-white";
      default: return "bg-muted";
    }
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <Flag className="w-3 h-3 text-red-500" />;
      case "high": return <Flag className="w-3 h-3 text-orange-500" />;
      default: return <Flag className="w-3 h-3 text-muted-foreground" />;
    }
  };

  // Permission checks
  const canEdit = (): boolean => {
    if (!ticket) return false;
    
    const isCreator = ticket.createdBy && ticket.createdBy._id?.toString() === userId;
    const isAssignee = ticket.assignedTo && ticket.assignedTo._id?.toString() === userId;
    const sameDept = ticket.department === userDepartment;

    if (userRole === "employee") {
      return isCreator || isAssignee;
    }

    if (userRole === "manager" || userRole === "admin") {
      return sameDept || isCreator || isAssignee;
    }

    return false;
  };

  const canAddComments = (): boolean => {
    if (!ticket) return false;
    
    const isCreator = ticket.createdBy && ticket.createdBy._id?.toString() === userId;
    const isAssignee = ticket.assignedTo && ticket.assignedTo._id?.toString() === userId;
    const sameDept = ticket.department === userDepartment;

    if (ticket.status === "closed") return false;

    if (userRole === "employee") {
      return isCreator || isAssignee || sameDept;
    }

    if (userRole === "manager" || userRole === "admin") {
      return sameDept || isCreator || isAssignee;
    }

    return false;
  };

  // Keep all your existing handler functions
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
  };

  const handleCancel = () => {
    if (!ticket) return;
    
    setIsEditing(false);
    setError("");
    
    setFormData({
      title: ticket.title || "",
      description: ticket.description || "",
      status: ticket.status || "open",
      priority: ticket.priority || "low",
    });

    navigate(`/dashboard/tickets/${ticketId}`, { replace: true });
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!ticket || !ticketId) return;
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError("");

    try {
      const updates: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
      };

      if (userRole === "manager" || userRole === "admin") {
        updates.status = formData.status;
      }

      await makeApiCall(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      const response = await makeApiCall(`/tickets/${ticketId}`);
      const updatedTicket = response.ticket || response;
      setTicket(updatedTicket);
      
      setIsEditing(false);
      navigate(`/dashboard/tickets/${ticketId}`, { replace: true });
      
      toast({
        title: "Success",
        description: `Ticket has been updated successfully.`,
        duration: 2000
      });
    } catch (err: unknown) {
      console.error("Error updating ticket:", err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !ticketId) return;
    
    setIsAddingComment(true);
    try {
      const response = await makeApiCall(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message: newComment.trim() }),
      });
      
      setTicket(response.ticket);
      setNewComment("");

      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
        duration: 2000
      });
    } catch (err: unknown) {
      console.error("Error adding comment:", err);
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsAddingComment(false);
    }
  };

  // ENHANCED: File upload with validation
  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0 || !ticketId) return;

    // Validate file types before upload
    const invalidFiles = Array.from(selectedFiles).filter(file => !isValidFileType(file));
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `Files not supported: ${invalidFiles.map(f => f.name).join(', ')}`,
        variant: "destructive",
        duration: 2000
      });
      return;
    }
    
    setIsUploadingFiles(true);
    try {
      const uploadedAttachments = [];
      
      for (const file of Array.from(selectedFiles)) {
        // console.log('Uploading file:', file.name);
        
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('auth_token');
        
        const uploadResponse = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`Upload failed for ${file.name}: ${errorText}`);
        }

        const uploadData = await uploadResponse.json();
        
        uploadedAttachments.push({
          filename: uploadData.filename || file.name,
          url: uploadData.url
        });
      }

      const response = await makeApiCall(`/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ attachments: uploadedAttachments }),
      });

      setTicket(response.ticket);
      setSelectedFiles(null);
      
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      toast({
        title: "Files uploaded",
        description: `${uploadedAttachments.length} file(s) uploaded successfully.`,
        duration: 2000
      });
    } catch (err: unknown) {
      console.error("Error uploading files:", err);
      toast({
        title: "Upload failed",
        description: getErrorMessage(err),
        variant: "destructive",
        duration: 2000
      });
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await makeApiCall(`/tickets/${ticketId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      
      const response = await makeApiCall(`/tickets/${ticketId}`);
      const updatedTicket = response.ticket || response;
      setTicket(updatedTicket);
      
      toast({
        title: "Comment deleted",
        description: "Comment has been deleted successfully.",
      });
    } catch (err: unknown) {
      console.error("Error deleting comment:", err);
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive",
        duration: 2000
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await makeApiCall(`/tickets/${ticketId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      
      const response = await makeApiCall(`/tickets/${ticketId}`);
      const updatedTicket = response.ticket || response;
      setTicket(updatedTicket);
      
      toast({
        title: "Attachment deleted",
        description: "Attachment has been deleted successfully.",
      });
    } catch (err: unknown) {
      console.error("Error deleting attachment:", err);
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive",
        duration: 2000
      });
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
      setSelectedFiles(files);
    }
  };

  // ENHANCED: File selection handler with validation
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const invalidFiles = Array.from(files).filter(file => !isValidFileType(file));
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Some files not supported",
        description: `Unsupported files: ${invalidFiles.map(f => f.name).join(', ')}`,
        variant: "destructive",
        duration: 2000
      });
      
      // Filter out invalid files
      const validFiles = Array.from(files).filter(file => isValidFileType(file));
      
      if (validFiles.length > 0) {
        const dt = new DataTransfer();
        validFiles.forEach(file => dt.items.add(file));
        setSelectedFiles(dt.files);
      } else {
        setSelectedFiles(null);
        e.target.value = '';
      }
    } else {
      setSelectedFiles(files);
    }
  };

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loading...</h1>
            <p className="text-muted-foreground mt-2">
              Fetching ticket details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Error</h1>
            <p className="text-muted-foreground mt-2">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ticket Not Found</h1>
            <p className="text-muted-foreground mt-2">
              The requested ticket could not be found.
            </p>
          </div>
        </div>
      </div>
    );
  }
  // +++ Add handler to persist status change via PUT /api/tickets/:id +++
const onSubmitStatus = async () => {
  const id = ticket?._id || window.location.pathname.split('/').filter(Boolean).pop();
  if (!id) return;

  const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

  try {
    setSaving(true);

    const resp = await fetch(`http://localhost:5000/api/tickets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      credentials: 'include',
      body: JSON.stringify({ status: statusDraft }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error('Update failed', resp.status, resp.statusText, text);
      throw new Error(text || `HTTP ${resp.status}`);
    }

    const json = text ? JSON.parse(text) : {};
    const updated = json.ticket || json;

    setTicket(prev => (prev ? { ...prev, status: updated.status } : updated));
    setFormData((p: any) => ({ ...(p || {}), status: updated.status }));
  } catch (e: any) {
    console.error('Update status failed:', e?.message);
  } finally {
    setSaving(false);
  }
};

 return (
  <div className="min-h-screen bg-gray-50/30">
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
    {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 -mx-6 mb-8">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{ticket.title}</h1>
                  <Badge variant="outline" className="text-sm">
                    {ticket._id.slice(-8).toUpperCase()}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-2">
                  Ticket details and status information
                </p>
              </div>
            </div>

            {/* Right header actions */}
            <div className="flex items-center gap-3">
              {canEdit() && !isEditing && !['closed'].includes(ticket.status) && (
                <Button onClick={handleEdit} className="bg-gradient-primary hover:shadow-glow">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Ticket
                </Button>
              )}

              {/* ADDED: Status dropdown + Complete button */}
              {canEdit() && (userRole === 'manager' || !['closed'].includes(ticket.status)) && (
                <div className="flex items-center gap-2">
                  <label htmlFor="statusSelect" className="text-sm font-medium text-gray-700 block">Status</label>
                  <select
                    id="statusSelect"
                    className="border rounded-md px-2 py-1 text-sm bg-background"
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value as any)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    {(userRole === 'manager' || userRole === 'admin') && (
                      <option value="closed">Closed</option>
                    )}
                  </select>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={onSubmitStatus}
                    disabled={saving || (ticket && statusDraft === ticket.status)}
                    title="Update ticket status"
                  >
                    {saving ? 'Updating' : 'Update Status'}
                  </Button>
                </div>)}
                </div>
            </div>
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Main Content - keeping your existing structure */}
      <div className="xl:col-span-3 space-y-8">
        <Card className="shadow-sm border-gray-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ticket Information</CardTitle>
              {isEditing && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCancel} variant="outline" disabled={isLoading}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isLoading}>
                    <Save className="w-4 h-4 mr-1" />
                    {isLoading ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Title */}
            <div className="space-y-3">
              <Label htmlFor="title">Title</Label>
              {isEditing ? (
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="text-lg font-medium">{ticket.title}</p>
              )}
            </div>
            
            <Separator />

            {/* Description */}
            <div className="space-y-3">
              <Label htmlFor="description">Description</Label>
              {isEditing ? (
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={6}
                  disabled={isLoading}
                />
              ) : (
                <div className="bg-gray-50 border rounded-lg p-6">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                </div>
              )}
            </div>

            {/* Department and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="department">Department</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{ticket.department.charAt(0).toUpperCase() + ticket.department.slice(1)}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="priority">Priority</Label>
                {isEditing ? (
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => handleInputChange('priority', value)}
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
                ) : (
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(ticket.priority)}
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="tags">Tags</Label>
              <div className="bg-gray-50 border rounded-lg p-6">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {ticket.tags && ticket.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {ticket.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs px-2 py-1">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No tags</span>
                  )}</p>
              </div>
            </div>

                <Separator />
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label htmlFor="status">Status</Label>
                      {isEditing ? (
                        <Select
                          value={formData.status}
                          onValueChange={(value) => handleInputChange('status', value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`${getStatusColor(ticket.status)} px-3 py-1 ml-3`}>
                          {ticket.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <Label htmlFor="assignee">Assigned To</Label>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{ticket.assignedTo?.name === userName ? "Me" : "Unassigned"}</span>
                      </div>
                    </div>
                  </div>
                </div>
          </CardContent>
        </Card>
        {/* <Card className="shadow-sm border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-3">
              <Badge className={`${getStatusColor(ticket.status)} px-4 py-2 text-sm`}>
                {ticket.status.replace("_", " ").toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(ticket.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card> */}
      </div >

      {/* Sidebar */}
      <div className="xl:col-span-1 space-y-6">
        <Card className="shadow-sm border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created
                </span>
                <span className="font-medium">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated
                </span>
                <span className="font-medium">
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Reporter
                </span>
                <span className="font-medium text-xs">
                  {ticket.createdBy?.name || "Unknown"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card className="shadow-sm border-gray-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {ticket.comments?.length || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing comments */}
            {ticket.comments && ticket.comments.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {ticket.comments.map((comment) => (
                  <div key={comment._id} className="border border-muted rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {comment.author?.name || "Unknown User"}
                        </p>
                        <p className="text-sm mt-1">{comment.message}</p>
                        <span className="text-xs text-muted-foreground mt-2 block">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {(comment.author?._id === userId || userRole === 'admin') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteComment(comment._id)}
                          className="text-red-500 hover:text-red-700 ml-2 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-700 mb-3 block text-center py-4">No comments yet</p>
            )}
            
            {/* Add new comment */}
            {canAddComments() && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    disabled={isAddingComment}
                    className="resize-none transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isAddingComment}
                    className="w-full transition-all duration-200 hover:shadow-md"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isAddingComment ? "Adding..." : "Add Comment"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ENHANCED: Attachments Section with File Type Information */}
        <Card className="shadow-sm border-gray-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {ticket.attachments?.length || 0}
                </Badge>
                {canEdit() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFileTypeInfo(!showFileTypeInfo)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ENHANCED: File Type Information */}
            {showFileTypeInfo && canEdit() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <Info className="w-4 h-4" />
                  <span className="font-medium text-sm">Supported File Types</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {Object.values(SUPPORTED_FILE_TYPES).map((type, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      {type.icon}
                      <span className="font-medium">{type.label}:</span>
                      <span className="text-muted-foreground">
                        {type.extensions.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  Maximum file size: 10MB per file
                </div>
              </div>
            )}

            {/* Existing attachments */}
            {ticket.attachments && ticket.attachments.length > 0 ? (
              <div className="space-y-3">
                {ticket.attachments.map((attachment) => (
                  <div key={attachment._id} className="flex items-center justify-between border border-muted rounded-lg p-2 hover:bg-muted/50 transition-colors duration-200">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm flex-1 truncate flex items-center gap-2 hover:text-blue-800 transition-colors duration-200"
                    >
                      {getFileIcon(attachment.filename)}
                      {attachment.filename}
                    </a>
                    {canEdit() && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAttachment(attachment._id)}
                        className="text-red-500 hover:text-red-700 ml-2 hover:bg-red-50 transition-all duration-200"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-700 mb-3 block text-center py-4">No attachments</p>
            )}
            
            {/* ENHANCED: Upload new files with file type restrictions */}
            {canEdit() && !['closed'].includes(ticket.status) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {/* Enhanced file upload area with drag & drop and file type info */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 ${
                      isDragOver ? 'border-blue-400 bg-blue-50' : 'border-muted'
                    } ${selectedFiles && selectedFiles.length > 0 ? 'border-green-400 bg-green-50/50' : ''}`}
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
                    onChange={handleFileSelect}
                    disabled={isUploadingFiles}
                    className="hidden"
                    accept={getAllAcceptTypes()}
                  />
                  
                  {selectedFiles && selectedFiles.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Selected files ({selectedFiles.length}):
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {Array.from(selectedFiles).map((file, index) => (
                          <div key={index} className="text-xs bg-muted/50 rounded px-2 py-1 truncate flex items-center gap-2">
                            {getFileIcon(file.name)}
                            <span className="flex-1">{file.name}</span>
                            <span className="text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    size="sm" 
                    onClick={handleFileUpload}
                    disabled={!selectedFiles || selectedFiles.length === 0 || isUploadingFiles}
                    className="w-full transition-all duration-200 hover:shadow-md"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploadingFiles ? "Uploading..." : "Upload Files"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  </div>  
);
}