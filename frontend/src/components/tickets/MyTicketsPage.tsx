import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Bell, 
  Calendar, 
  Clock, 
  X, 
  User, 
  Users, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Tag,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  assignedTo?: {
    _id: string;
    name: string;
    email?: string;
  };
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

interface ReminderData {
  _id: string;
  reminderDate: string;
  message: string;
  isActive: boolean;
  setBy: {
    _id: string;
    name: string;
  };
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [remindingTickets, setRemindingTickets] = useState<Set<string>>(new Set());
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicketForReminder, setSelectedTicketForReminder] = useState<string>('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [ticketReminders, setTicketReminders] = useState<{[key: string]: ReminderData[]}>({});
  const [viewMode, setViewMode] = useState<'personal' | 'department'>('personal');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id");
  // Scroll to top button visibility
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Get current user data from JWT token
  useEffect(() => {
    const getCurrentUser = () => {
      try {
        const userName = localStorage.getItem("user_name");
        const userRole = localStorage.getItem("user_role");
        const userDepartment = localStorage.getItem("user_department");
        const userEmail = localStorage.getItem("user_email");

        if (userName && userRole) {
          setCurrentUser({
            id: userId || '',
            name: userName || 'Unknown User',
            email: userEmail || '',
            role: userRole || 'employee',
            department: userDepartment || ''
          });
        }
      } catch (error) {
        console.error("Failed to get user from localStorage:", error);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    const fetchAssigned = async () => {
      try {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        const url = "http://localhost:5000/api/tickets?scope=me";
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const txt = await res.text();
        let data: unknown;
        try {
          data = JSON.parse(txt);
        } catch {
          data = txt;
        }

        if (!res.ok) {
          const msg =
            typeof data === "string" ? data : (data as any)?.msg || `Request failed with ${res.status}`;
          throw new Error(msg);
        }

        let list: any[] | null = null;
        if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === "object" && Array.isArray((data as any).tickets)) {
          list = (data as any).tickets;
        }

        if (!list) {
          console.error("Unexpected payload for tickets:", data);
          setTickets([]);
          setFilteredTickets([]);
          return;
        }

        const mapped: TicketData[] = list.map((t: any) => ({
          id: t._id,
          title: t.title,
          description: t.description ?? "",
          category: t.department ?? "General",
          status: t.status === "in_progress" ? "in-progress" : t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          createdByName: t?.createdBy?.name || undefined,
          assignedTo: t.assignedTo ? {
            _id: t.assignedTo._id,
            name: t.assignedTo.name,
            email: t.assignedTo.email
          } : undefined,
        }));

        // console.log("Mapped tickets with assignedTo:", mapped);
        setTickets(mapped);
        setFilteredTickets(mapped);
      } catch (e) {
        console.error("Failed to load assigned tickets:", e);
        setTickets([]);
        setFilteredTickets([]);
      }
    };

    fetchAssigned();
  }, []);

  useEffect(() => {
    let filtered = tickets;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(q) ||
          ticket.description.toLowerCase().includes(q) ||
          ticket.category.toLowerCase().includes(q) ||
          (ticket.createdByName?.toLowerCase().includes(q) ?? false)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoadingTickets(true);
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        
        // Dynamic URL based on view mode
        const scope = viewMode === 'personal' ? 'me' : 'department';
        const url = `http://localhost:5000/api/tickets?scope=${scope}`;
        
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const txt = await res.text();
        let data: any;
        try {
          data = JSON.parse(txt);
        } catch {
          data = txt;
        }

        if (res.ok) {
          // Handle both response formats: direct array or { tickets: [...] }
          let ticketList: any[] = [];
          if (Array.isArray(data)) {
            ticketList = data;
          } else if (data && typeof data === 'object' && Array.isArray(data.tickets)) {
            ticketList = data.tickets;
          } else {
            ticketList = [];
          }

          const mapped: TicketData[] = ticketList.map((t: any) => ({
            id: t._id,
            title: t.title,
            description: t.description ?? "",
            category: t.department ?? "General",
            status: t.status === "in_progress" ? "in-progress" : t.status,
            priority: t.priority,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            createdByName: t?.createdBy?.name || undefined,
            assignedTo: t.assignedTo ? {
              _id: t.assignedTo._id,
              name: t.assignedTo.name,
              email: t.assignedTo.email
            } : undefined,
          }));

          setTickets(mapped);
          setFilteredTickets(mapped);
        } else {
          const msg = typeof data === 'string' ? data : (data as any)?.msg || 'Failed to load tickets';
          toast.error(msg);
        }

      } catch (error) {
        console.error('Failed to load tickets:', error);
        toast.error('Failed to load tickets');
      } finally {
        setLoadingTickets(false);
      }
    };

    fetchTickets();
  }, [viewMode]);

  const isManager = currentUser?.role === 'manager';

  const handleRemindAssignee = async (ticketId: string, ticketTitle: string) => {
    if (!isManager) {
      toast.error('Only managers can send reminders');
      return;
    }

    try {
      setRemindingTickets(prev => new Set(prev.add(ticketId)));
      
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/notifications/remind/${ticketId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || 'Failed to send reminder');
      }

      toast.success(`Reminder sent to ${data.assigneeName}`, {
        description: `For ticket: "${data.ticketTitle}"`,
      });
      
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send reminder', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setRemindingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
    }
  };

  const handleSetReminder = async (ticketId: string) => {
    setSelectedTicketForReminder(ticketId);
    setShowReminderModal(true);
    setReminderDate('');
    setReminderMessage('');
  };

  const submitReminder = async () => {
    if (!reminderDate || !selectedTicketForReminder) {
      toast.error('Please select a date and time for the reminder');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${selectedTicketForReminder}/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          reminderDate,
          message: reminderMessage || 'Ticket reminder'
        })
      });

      if (response.ok) {
        toast.success('Reminder set successfully!', {
          description: 'You will be notified at the specified time',
        });
        setShowReminderModal(false);
        fetchTicketReminders(selectedTicketForReminder);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to set reminder');
      }
    } catch (error) {
      toast.error('Failed to set reminder');
      console.error('Error setting reminder:', error);
    }
  };

  const fetchTicketReminders = async (ticketId: string) => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reminders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const reminders = await response.json();
        setTicketReminders(prev => ({
          ...prev,
          [ticketId]: reminders
        }));
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  // Enhanced UI helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4" />;
      case "in-progress":
        return <Clock className="w-4 h-4" />;
      case "resolved":
        return <CheckCircle2 className="w-4 h-4" />;
      case "closed":
        return <XCircle className="w-4 h-4" />;
      default:
        return <PauseCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500 hover:bg-blue-600 text-white";
      case "in-progress":
        return "bg-amber-500 hover:bg-amber-600 text-white";
      case "resolved":
        return "bg-green-500 hover:bg-green-600 text-white";
      case "closed":
        return "bg-gray-500 hover:bg-gray-600 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Zap className="w-4 h-4 text-red-500" />;
      case "high":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "medium":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "low":
        return <PauseCircle className="w-4 h-4 text-green-500" />;
      default:
        return <PauseCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "border-l-green-400";
      case "medium":
        return "border-l-yellow-400";
      case "high":
        return "border-l-orange-400";
      case "urgent":
        return "border-l-red-500";
      default:
        return "border-l-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const categories = ["Account Access", "Software", "Network", "Hardware", "Email"];

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Enhanced Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 leading-none overflow-visible">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight overflow-visible py-1">
              {viewMode === 'personal' ? 'My Tickets' : 'Department Tickets'}
            </h1>
            {isManager && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 px-3 py-1">
                <User className="w-3 h-3 mr-1" />
                Manager
              </Badge>
            )}
            {currentUser?.role === 'employee' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1">
                <User className="w-3 h-3 mr-1" />
                Employee
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'personal' ? 'default' : 'outline'}
              onClick={() => setViewMode('personal')}
              className="transition-all duration-200"
            >
              <User className="w-4 h-4 mr-2" />
              My Tickets
            </Button>
            <Button
              variant={viewMode === 'department' ? 'default' : 'outline'}
              onClick={() => setViewMode('department')}
              className="transition-all duration-200"
            >
              <Users className="w-4 h-4 mr-2" />
              Department View
            </Button>
          </div>
          
          <p className="text-muted-foreground text-lg">
            {viewMode === 'personal' 
              ? 'Track and manage your support requests efficiently'
              : 'View and collaborate on department tickets'
            }
          </p>
        </div>
        <Button 
          onClick={() => navigate("/tickets/new")} 
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Ticket
        </Button>
      </div>

      {/* Enhanced Filters */}
      <Card className="shadow-md border-0 bg-gradient-to-r from-slate-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5 text-blue-600" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by title, description, or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Tickets</p>
                  <p className="text-2xl font-bold text-blue-900">{Array.isArray(tickets) ? tickets.length : 0}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">In Progress</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {Array.isArray(tickets) ? tickets.filter(t => t.status === 'in-progress').length : 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Urgent</p>
                  <p className="text-2xl font-bold text-red-900">
                    {Array.isArray(tickets) ? tickets.filter(t => t.priority === 'urgent').length : 0}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Resolved</p>
                  <p className="text-2xl font-bold text-green-900">
                    {Array.isArray(tickets) ? tickets.filter(t => t.status === 'resolved').length : 0}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Enhanced Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-gray-100 p-6 mb-4">
                <Search className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No tickets found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Try adjusting your filters or create a new ticket to get started
              </p>
              <Button 
                onClick={() => navigate("/tickets/new")} 
                className="mt-6"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className={`border-l-4 ${getPriorityColor(ticket.priority)} shadow-md hover:shadow-lg transition-all duration-200 bg-white`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(ticket.priority)}
                        <CardTitle className="text-xl text-gray-900 leading-tight">
                          {ticket.title}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {ticket.createdByName || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(ticket.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(ticket.status)} px-3 py-1 rounded-full flex items-center gap-1`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace("-", " ").toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 leading-relaxed">{ticket.description}</p>
                
                {/* Enhanced Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Category:</span>
                      <br />
                      <span className="font-medium">{ticket.category}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(ticket.priority)}
                    <span className="text-sm">
                      <span className="text-muted-foreground">Priority:</span>
                      <br />
                      <span className="font-medium capitalize">{ticket.priority}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Updated:</span>
                      <br />
                      <span className="font-medium">{formatDate(ticket.updatedAt)}</span>
                    </span>
                  </div>
                  {ticket.assignedTo && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">
                        <span className="text-muted-foreground">Assigned to:</span>
                        <br />
                        <span className="font-medium">{ticket.assignedTo?._id === userId  ? 'Me' : ticket.assignedTo.name}</span>
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Enhanced Action Buttons */}
                <div className="flex gap-3 justify-end pt-2">
                  {/* Employee Set Reminder Button */}
                  {(currentUser?.role === 'employee' && !['closed'].includes(ticket.status) && 
                    (ticket.createdByName === currentUser.name || 
                    ticket.assignedTo?.name === currentUser.name ||
                    ticket.createdByName === currentUser.name)) && (
                    <Button
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSetReminder(ticket.id)}
                      disabled={remindingTickets.has(ticket.id)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 transition-colors"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      {remindingTickets.has(ticket.id) ? 'Setting...' : 'Set Reminder'}
                    </Button>
                  )}

                  {/* Manager Remind Button */}
                  {isManager && ticket.assignedTo && !['closed'].includes(ticket.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemindAssignee(ticket.id, ticket.title)}
                      disabled={remindingTickets.has(ticket.id)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-300 transition-colors"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      {remindingTickets.has(ticket.id) ? 'Sending...' : 'Send Reminder'}
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/dashboard/tickets/${ticket.id}`)}
                    className="hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {(!['closed'].includes(ticket.status) && (isManager || ticket.createdByName === currentUser?.name || ticket.assignedTo?.name === currentUser?.name)) 
                      ? 'Edit Details' 
                      : 'View Details'
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Enhanced Footer */}
      {filteredTickets.length > 0 && (
        <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing <span className="font-semibold text-blue-600">{filteredTickets.length}</span> of{" "}
                <span className="font-semibold text-blue-600">{tickets.length}</span> tickets
              </span>
              <div className="flex items-center gap-4">
                {isManager && (
                  <span className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Manager actions available
                  </span>
                )}
                {currentUser?.role === 'employee' && (
                  <span className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Personal reminders available
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Set Personal Reminder</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReminderModal(false)}
                className="hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder Date & Time
                </label>
                <Input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full h-11"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder Message (Optional)
                </label>
                <Input
                  placeholder="Enter reminder message..."
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  className="w-full h-11"
                />
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowReminderModal(false)}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={submitReminder}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Set Reminder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center h-11 w-11 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
