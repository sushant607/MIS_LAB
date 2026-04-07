import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  ArrowLeft, 
  Mail, 
  Calendar, 
  Ticket, 
  Clock, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle,
  User,
  BarChart3,
  Target,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  totalTickets: number;
  activeTickets: number;
  completedTickets: number;
  priorityBreakdown: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  workloadScore: number;
  completionRate: string;
  recentTickets: Array<{
    _id: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    createdBy: string;
  }>;
  lastActivity: string;
  avgResponseTime: string;
  status: 'available' | 'light' | 'medium' | 'heavy';
}

interface WorkloadSummary {
  total: number;
  filtered: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  department: string;
  filters: {
    sortBy: string;
    sortOrder: string;
    filter: string;
    search: string;
  };
  stats: {
    available: number;
    light: number;
    medium: number;
    heavy: number;
    totalActiveTickets: number;
    avgWorkload: string;
  };
}

interface TeamWorkloadResponse {
  success: boolean;
  teamMembers: TeamMember[];
  summary: WorkloadSummary;
}

export default function TeamWorkloadPage() {
  const [data, setData] = useState<TeamWorkloadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('workload');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("auth_token") || "";
  const userDepartment = localStorage.getItem("user_department") || "";

  useEffect(() => {
    fetchTeamWorkload();
  }, [searchTerm, selectedFilter, sortBy, sortOrder, currentPage]);

  const fetchTeamWorkload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sortBy,
        sortOrder,
        filter: selectedFilter,
        search: searchTerm,
        department: userDepartment
      });

      const response = await fetch(
        `http://localhost:5000/api/tickets/team-workload?${params}`,
        {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        console.error("Failed to fetch team workload:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching team workload:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'light': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'heavy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4" />;
      case 'light': return <TrendingUp className="w-4 h-4" />;
      case 'medium': return <Clock className="w-4 h-4" />;
      case 'heavy': return <AlertTriangle className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Workload</h1>
            <p className="text-muted-foreground">
              Detailed workload management for {userDepartment} department
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {data.summary.stats.available}
              </div>
              <p className="text-xs text-muted-foreground">Ready for assignments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Light Load</CardTitle>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {data.summary.stats.light}
              </div>
              <p className="text-xs text-muted-foreground">1-2 active tickets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medium Load</CardTitle>
              <Clock className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-700">
                {data.summary.stats.medium}
              </div>
              <p className="text-xs text-muted-foreground">3-5 active tickets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heavy Load</CardTitle>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {data.summary.stats.heavy}
              </div>
              <p className="text-xs text-muted-foreground">6+ active tickets</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter */}
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="light">Light Load</SelectItem>
                <SelectItem value="medium">Medium Load</SelectItem>
                <SelectItem value="heavy">Heavy Load</SelectItem>
                <SelectItem value="overloaded">Overloaded (6+)</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workload">Active Tickets</SelectItem>
                <SelectItem value="score">Workload Score</SelectItem>
                <SelectItem value="completion">Completion Rate</SelectItem>
                <SelectItem value="activity">Last Activity</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                {data?.summary && (
                  `Showing ${data.summary.filtered} of ${data.summary.total} members • Page ${data.summary.page} of ${data.summary.totalPages}`
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading team workload...</span>
            </div>
          ) : data?.teamMembers.length ? (
            <div className="space-y-4">
              {data.teamMembers.map((member) => (
                <Card key={member._id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Member Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(member.status)}
                            <div>
                              <h3 className="font-semibold text-lg">{member.name}</h3>
                              <p className="text-sm text-muted-foreground">{member.role}</p>
                            </div>
                          </div>
                        </div>
                        <Badge className={getStatusColor(member.status)}>
                          {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>Avg: {member.avgResponseTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          <span>{member.completionRate}% completion</span>
                        </div>
                      </div>
                    </div>

                    {/* Workload Stats */}
                    <div className="lg:w-80">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">{member.activeTickets}</div>
                          <div className="text-xs text-muted-foreground">Active</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{member.completedTickets}</div>
                          <div className="text-xs text-muted-foreground">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-purple-600">{member.workloadScore}</div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>

                      {/* Priority Breakdown */}
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(member.priorityBreakdown).map(([priority, count]) => 
                          count > 0 && (
                            <Badge key={priority} className={getPriorityColor(priority)} variant="secondary">
                              {priority}: {count}
                            </Badge>
                          )
                        )}
                      </div>

                      {/* Recent Tickets */}
                      {member.recentTickets.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Tickets:</p>
                          <div className="space-y-1">
                            {member.recentTickets.slice(0, 3).map((ticket, index) => (
                              <div key={ticket._id} className="flex justify-between items-center text-xs">
                                <span className="truncate flex-1 mr-2">{ticket.title}</span>
                                <Badge className={getPriorityColor(ticket.priority)} variant="outline">
                                  {ticket.priority}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              {/* Pagination */}
              {data.summary.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, data.summary.totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    disabled={!data.summary.hasMore}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No team members found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
