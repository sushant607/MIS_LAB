import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Filter, Edit, Eye, User, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  id: string;
  title: string;
  description: string;
  assignee: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  team?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AllTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    // Mock data for all tickets (manager view)
    const mockTickets: TicketData[] = [
      {
        id: "T001",
        title: "Password Reset Request",
        description: "Unable to access company email account",
        assignee: "John Doe",
        category: "Account Access",
        status: "resolved",
        priority: "medium",
        team: "Support Team A",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16"
      },
      {
        id: "T002",
        title: "Software Installation Issue",
        description: "Need Adobe Creative Suite installed",
        assignee: "Jane Smith",
        category: "Software",
        status: "in-progress",
        priority: "high",
        team: "Software Team",
        createdAt: "2024-01-18",
        updatedAt: "2024-01-20"
      },
      {
        id: "T003",
        title: "VPN Connection Problems",
        description: "Cannot connect to company VPN from home",
        assignee: "Bob Wilson",
        category: "Network",
        status: "open",
        priority: "urgent",
        team: "Network Team",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-20"
      },
      {
        id: "T004",
        title: "Email Server Outage",
        description: "Email server experiencing downtime",
        assignee: "Sarah Johnson",
        category: "Infrastructure",
        status: "in-progress",
        priority: "urgent",
        team: "Infrastructure Team",
        createdAt: "2024-01-21",
        updatedAt: "2024-01-21"
      },
      {
        id: "T005",
        title: "Printer Not Working",
        description: "Office printer needs maintenance",
        assignee: "Mike Chen",
        category: "Hardware",
        status: "open",
        priority: "low",
        team: "Hardware Team",
        createdAt: "2024-01-22",
        updatedAt: "2024-01-22"
      },
      {
        id: "T006",
        title: "Database Performance Issues",
        description: "Customer database running slowly",
        assignee: "Lisa Park",
        category: "Database",
        status: "in-progress",
        priority: "high",
        team: "Database Team",
        createdAt: "2024-01-23",
        updatedAt: "2024-01-23"
      }
    ];
    setTickets(mockTickets);
    setFilteredTickets(mockTickets);
  }, []);

  useEffect(() => {
    let filtered = tickets;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(ticket =>
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    // Team filter
    if (teamFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.team === teamFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, statusFilter, priorityFilter, teamFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full";
      case "in-progress": return "bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full";
      case "resolved": return "bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full";
      case "closed": return "bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full";
      default: return "bg-muted px-3 py-1 rounded-full";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-muted text-muted-foreground";
      case "medium": return "bg-primary text-primary-foreground";
      case "high": return "bg-warning text-warning-foreground";
      case "urgent": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted";
    }
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    setTickets(prev => prev.map(ticket =>
      ticket.id === ticketId
        ? { ...ticket, status: newStatus as any, updatedAt: new Date().toISOString().split('T')[0] }
        : ticket
    ));
  };

  const teams = [...new Set(tickets.map(ticket => ticket.team).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Tickets</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all team support requests
          </p>
        </div>
        <Button 
          onClick={() => navigate("/dashboard/tickets/new")}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold">{tickets.length}</p>
              </div>
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-status-open">
                  {tickets.filter(t => t.status === "open").length}
                </p>
              </div>
              <div className="w-8 h-8 bg-status-open/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-status-open" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-status-progress">
                  {tickets.filter(t => t.status === "in-progress").length}
                </p>
              </div>
              <div className="w-8 h-8 bg-status-progress/10 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-status-progress" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold text-destructive">
                  {tickets.filter(t => t.priority === "urgent").length}
                </p>
              </div>
              <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
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
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team} value={team || ""}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card className="bg-gradient-card border-0 shadow-md">
        <CardHeader>
          <CardTitle>Tickets ({filteredTickets.length})</CardTitle>
          <CardDescription>
            Manage ticket statuses and assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{ticket.id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ticket.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {ticket.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{ticket.assignee}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ticket.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getPriorityColor(ticket.priority)} text-xs`}>
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={ticket.status}
                        onValueChange={(value) => handleStatusChange(ticket.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <Badge className={`${getStatusColor(ticket.status)} text-xs border-0`}>
                            {ticket.status.replace("-", " ").toUpperCase()}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{ticket.team}</TableCell>
                    <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}