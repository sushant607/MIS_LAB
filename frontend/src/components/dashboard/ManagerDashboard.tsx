import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Ticket, TrendingUp, AlertCircle, Tag, Hash, BarChart3, Clock, CheckCircle, XCircle, User, Edit, Eye, Building2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  _id: string;
  title: string;
  description: string;
  department: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  tags?: string[];
  assignedTo?: { _id: string; name: string; email: string } | string | null;
  createdBy?: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

interface TagAnalytics {
  tag: string;
  totalTickets: number;
  departmentTickets: number;
  myTickets: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
}

interface AnalyticsResponse {
  success: boolean;
  summary: {
    totalTags: number;
    totalTickets: number;
    departmentTickets: number;
    myTickets: number;
    timeframe: number;
    generatedAt: string;
  };
  tags: TagAnalytics[];
}

interface WorkloadSummary {
  totalEmployees: number;
  activeEmployees: number; 
  availableEmployees: number;
  totalActiveTickets: number;
  avgWorkload: string;
  workloadDistribution: {
    light: number;
    medium: number;
    heavy: number;
  };
}

interface TopBusyEmployee {
  name: string;
  ticketCount: number;
}

interface WorkloadResponse {
  success: boolean;
  summary: WorkloadSummary;
  topBusy: TopBusyEmployee[];
  department: string;
}

export default function ManagerDashboard() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [workloadSummary, setWorkloadSummary] = useState<WorkloadResponse | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("auth_token") || "";
  const userDepartment = localStorage.getItem("user_department") || "";
  const userId = localStorage.getItem("user_id") || "";

  useEffect(() => {
    fetchTickets();
    fetchAnalytics();
    fetchWorkloadSummary();
  }, []);

  // Fetch manager-specific tickets (department + created by manager)
  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const response = await fetch("http://localhost:5000/api/tickets", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const allTickets = data.tickets || data || [];
        
        // Filter tickets for manager's department and own tickets
        const managerTickets = allTickets.filter((ticket: TicketData) => 
          ticket.department === userDepartment || 
          ticket.createdBy?._id === userId
        );
        
        setTickets(managerTickets);
      } else {
        console.error("Failed to fetch tickets:", response.statusText);
        setTickets([]);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Fetch manager-specific tag analytics
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/tickets/analytics/tags?timeframe=30",
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error("Failed to fetch analytics:", response.statusText);
        if (tickets.length > 0) {
          createFallbackTagAnalytics();
        }
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      if (tickets.length > 0) {
        createFallbackTagAnalytics();
      }
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // COMPACT: Fetch only summary workload data
  const fetchWorkloadSummary = async () => {
    if (!userDepartment) return;
    
    setLoadingTeam(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/tickets/team-workload-summary",
        {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setWorkloadSummary(data);
        // console.log('Workload summary:', data);
      } else {
        console.error("Failed to fetch workload summary:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching workload summary:", error);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Create tag analytics from filtered tickets if API fails
  const createFallbackTagAnalytics = () => {
    const tagGroups: Record<string, TagAnalytics> = {};
    
    tickets.forEach(ticket => {
      const ticketTags = ticket.tags && ticket.tags.length > 0 ? ticket.tags : ['Untagged'];
      const isMyTicket = ticket.createdBy?._id === userId;
      
      ticketTags.forEach(tag => {
        if (!tagGroups[tag]) {
          tagGroups[tag] = {
            tag,
            totalTickets: 0,
            departmentTickets: 0,
            myTickets: 0,
            statusBreakdown: {},
            priorityBreakdown: {}
          };
        }
        
        tagGroups[tag].totalTickets++;
        if (isMyTicket) {
          tagGroups[tag].myTickets++;
        } else {
          tagGroups[tag].departmentTickets++;
        }
        tagGroups[tag].statusBreakdown[ticket.status] = (tagGroups[tag].statusBreakdown[ticket.status] || 0) + 1;
        tagGroups[tag].priorityBreakdown[ticket.priority] = (tagGroups[tag].priorityBreakdown[ticket.priority] || 0) + 1;
      });
    });

    setAnalytics({
      success: true,
      summary: {
        totalTags: Object.keys(tagGroups).length,
        totalTickets: tickets.length,
        departmentTickets: tickets.filter(t => t.createdBy?._id !== userId).length,
        myTickets: tickets.filter(t => t.createdBy?._id === userId).length,
        timeframe: 30,
        generatedAt: new Date().toISOString()
      },
      tags: Object.values(tagGroups).sort((a, b) => b.totalTickets - a.totalTickets)
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Clock className="w-4 h-4" />;
      case "in_progress": return <TrendingUp className="w-4 h-4" />;
      case "resolved": return <CheckCircle className="w-4 h-4" />;
      case "closed": return <XCircle className="w-4 h-4" />;
      default: return <Ticket className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open':
        return 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full';
      case 'in_progress':
        return 'bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-full';
      case 'resolved':
        return 'bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full';
      case 'closed':
        return 'bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-full';
      default:
        return 'bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-full';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "urgent": return "bg-red-100 text-red-800";
      default: return "bg-muted";
    }
  };

  const getTagColor = (tag: string, index: number) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-purple-100 text-purple-800",
      "bg-green-100 text-green-800", 
      "bg-yellow-100 text-yellow-800",
      "bg-pink-100 text-pink-800",
      "bg-indigo-100 text-indigo-800",
      "bg-red-100 text-red-800",
      "bg-teal-100 text-teal-800",
      "bg-orange-100 text-orange-800",
      "bg-cyan-100 text-cyan-800",
      "bg-amber-100 text-amber-800",
      "bg-emerald-100 text-emerald-800"
    ];
    
    if (tag === 'Untagged') return "bg-blue-100 text-blue-800";
    if (tag === 'Others') return "bg-gray-100 text-gray-800";

    return colors[index % colors.length];
  };

  // Progress bar colors (keep vibrant for bars)
  const getProgressBarColor = (tag: string, index: number) => {
    const colors = [
      'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-amber-500', 'bg-emerald-500'
    ];
    
    if (tag === 'Others') return 'bg-gray-500';
    return colors[index % colors.length];
  };

  // Process tags to show top N + Others
  const processTagsForDisplay = (tagData: Record<string, number>): [string, number][] => {
    const entries = Object.entries(tagData || {});
    const sortedTags = entries.sort(([,a], [,b]) => b - a);
    
    const MAX_TAGS = 6; // Show top 6 tags
    
    if (sortedTags.length <= MAX_TAGS) {
      return sortedTags.map(([tag, count]) => [tag, Number(count)]);
    }
    
    const topTags = sortedTags.slice(0, MAX_TAGS - 1);
    const otherTags = sortedTags.slice(MAX_TAGS - 1);
    const othersCount = otherTags.reduce((sum, [, count]) => sum + Number(count), 0);
    
    return [...topTags.map(([tag, count]) => [tag, Number(count)] as [string, number]), ['Others', othersCount]];
  };

  // Helper function to get assignee name
  const getAssigneeName = (assignedTo: any) => {
    if (!assignedTo) return 'Unassigned';
    if (typeof assignedTo === 'string') return 'Assigned';
    return assignedTo.name || 'Assigned';
  };

  // COMPACT: Team workload card (much smaller)
  const renderCompactWorkloadCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Team Workload
        </CardTitle>
        <CardDescription>
          {workloadSummary?.summary && (
            `${workloadSummary.summary.activeEmployees}/${workloadSummary.summary.totalEmployees} employees active`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingTeam ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : workloadSummary?.summary ? (
          <div className="space-y-4">
            {/* COMPACT: Distribution Overview */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="text-lg font-bold text-green-700">
                  {workloadSummary.summary.workloadDistribution.light}
                </div>
                <div className="text-xs text-green-600">Light (≤2)</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded">
                <div className="text-lg font-bold text-yellow-700">
                  {workloadSummary.summary.workloadDistribution.medium}
                </div>
                <div className="text-xs text-yellow-600">Medium (3-5)</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <div className="text-lg font-bold text-red-700">
                  {workloadSummary.summary.workloadDistribution.heavy}
                </div>
                <div className="text-xs text-red-600">Heavy (6+)</div>
              </div>
            </div>

            {/* COMPACT: Key Stats */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Available: {workloadSummary.summary.availableEmployees}</span>
              <span>Avg: {workloadSummary.summary.avgWorkload} tickets</span>
            </div>

            {/* COMPACT: Top 3 Busiest (instead of all employees) */}
            {workloadSummary.topBusy?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Busiest Team Members</p>
                <div className="space-y-1">
                  {workloadSummary.topBusy.map((employee, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="truncate">{employee.name}</span>
                      <Badge variant="outline" className="text-xs ml-2">
                        {employee.ticketCount}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COMPACT: Link to detailed view */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate("/dashboard/team-workload")} // Separate detailed page
            >
              View Detailed Workload
            </Button>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">No workload data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent").length,
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
          <p className="text-muted-foreground">
            Manage all team tickets and monitor performance
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate("/tickets/new")}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.summary.totalTickets || stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics ? `${analytics.summary.departmentTickets} dept + ${analytics.summary.myTickets} mine` : 'Department & mine'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Need assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being resolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgent}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department + Manager Tag Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tag Distribution
            </CardTitle>
            <CardDescription>
              <Building2 className="w-4 h-4 inline mr-1" />
              {userDepartment} department + your created tickets
              {analytics && ` (Last ${analytics.summary.timeframe} days)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : analytics?.tags.length ? (
              <div className="space-y-4">
                {processTagsForDisplay(
                  Object.fromEntries(
                    analytics.tags.map((tagData) => [tagData.tag, tagData.totalTickets])
                  )
                ).map(([tagName, totalCount]: [string, number], index: number) => {
                  const originalTagData = analytics.tags.find(t => t.tag === tagName);
                  const isOthersCategory = tagName === 'Others';
                  
                  return (
                    <div key={tagName} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge className={getTagColor(tagName, index)}>
                            <Hash className="w-3 h-3 mr-1" />
                            {tagName}
                            {isOthersCategory && ` (${analytics.tags.length - 5} tags)`}
                          </Badge>
                          {!isOthersCategory && originalTagData && (
                            <div className="flex gap-1 text-xs">
                              <span className="text-blue-600">Dept: {originalTagData.departmentTickets}</span>
                              <span className="text-purple-600">Mine: {originalTagData.myTickets}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {totalCount} total ({((Number(totalCount) / Number(analytics.summary.totalTickets)) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      
                      {/* Progress bar with unique colors */}
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className={`rounded-full h-3 transition-all duration-500 ${getProgressBarColor(tagName, index)}`}
                          style={{
                            width: `${(Number(totalCount) / Number(analytics.summary.totalTickets)) * 100}%`
                          }}
                        />
                      </div>
                      
                      {/* Status breakdown badges - only for real tags, not Others */}
                      {!isOthersCategory && originalTagData && (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(originalTagData.statusBreakdown || {}).map(([status, count]) => (
                            <Badge 
                              key={status} 
                              className={getStatusColor(status)}
                              variant="secondary"
                            >
                              {status}: {count}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {isOthersCategory && (
                        <div className="text-xs text-muted-foreground">
                          Combined data from {analytics.tags.length - 5} less common tags
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="w-8 h-8 mx-auto mb-2" />
                <p>No tag data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* COMPACT: Smart Team Workload */}
        {renderCompactWorkloadCard()}
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Tickets</CardTitle>
              <CardDescription>Latest from your department and created tickets</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm"
                variant="outline" 
                onClick={() => navigate("/tickets")}
              >
                <Eye className="w-4 h-4 mr-1" />
                View All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTickets ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-gray-600">Loading tickets...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700">No tickets yet</p>
              <p className="text-sm text-gray-500 mb-4">Department tickets will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 4)
                .map((ticket) => (
                <div key={ticket._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(ticket.status)}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{ticket.title}</p>
                        {ticket.createdBy?._id === userId && (
                          <Badge variant="outline" className="text-xs">
                            Created by me
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        {ticket.tags && ticket.tags.map((tag, index) => (
                          <Badge key={tag} className={getTagColor(tag, index)}>
                            <Hash className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-xs text-gray-600">Assigned: {getAssigneeName(ticket.assignedTo)}</span>
                        <Calendar className="w-3 h-3" />
                        <span className="text-xs text-gray-600">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status.replace("-", " ").toUpperCase()}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/dashboard/tickets/${ticket._id}`)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
