import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Ticket, Clock, CheckCircle, XCircle, BarChart3, PieChart, TrendingUp, AlertCircle, Tag, Hash, Eye, Edit, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  _id: string;
  title: string;
  description: string;
  department: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: any;
  assignedTo?: any;
}

interface TagAnalytics {
  tag: string;
  totalTickets: number;
  departmentTickets: number;
  myTickets: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  recentTickets: any[];
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

export default function EmployeeDashboard() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  const userDepartment = localStorage.getItem("user_department") || "";
  const navigate = useNavigate();

  const token = localStorage.getItem("auth_token") || "";
  const userId = localStorage.getItem("user_id") || "";

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (tickets.length > 0) {
      fetchAnalytics();
    }
  }, [tickets]);
  useEffect(() => {
    fetchTickets();
    fetchUserSkills();
  }, []);

  const fetchUserSkills = async () => {
    setLoadingSkills(true);
    try {
      const response = await fetch("http://localhost:5000/api/tickets/skills/me", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserSkills(data.user.skills || []);
      } else {
        console.error("Failed to fetch user skills:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching user skills:", error);
    } finally {
      setLoadingSkills(false);
    }
  };

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
        const allTickets = data.tickets || data;
        const employeeTickets = allTickets.filter((ticket: TicketData) =>
          ticket.department === userDepartment || ticket.createdBy?.id === userId
        );
        setTickets(employeeTickets);
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
        console.error("❌ API FAILED:", response.status, response.statusText);
        if (tickets.length > 0) {
          createFallbackTagAnalytics();
        }
      }
    } catch (error) {
      console.error("❌ API ERROR:", error);
      console.log("ERROR FALLBACK - tickets length:", tickets.length);
      if (tickets.length > 0) {
        createFallbackTagAnalytics();
      }
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Create tag analytics from actual ticket data if API fails
  const createFallbackTagAnalytics = () => {
    const tagGroups: Record<string, TagAnalytics> = {};

    tickets.forEach(ticket => {
      const ticketTags = ticket.tags && ticket.tags.length > 0 ? ticket.tags : ['Untagged'];

      ticketTags.forEach(tag => {
        if (!tagGroups[tag]) {
          tagGroups[tag] = {
            tag,
            totalTickets: 0,
            departmentTickets: 0,
            myTickets: 0,
            statusBreakdown: {},
            priorityBreakdown: {},
            recentTickets: []
          };
        }

        tagGroups[tag].totalTickets++;

        if (ticket.createdBy?.id === userId) {
          tagGroups[tag].myTickets++;
        } else if (ticket.department === userDepartment) {
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
        departmentTickets: tickets.filter(t => t.department === userDepartment && t.createdBy?.id !== userId).length,
        myTickets: tickets.filter(t => t.createdBy?.id === userId).length,
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
    const sortedTags = entries.sort(([, a], [, b]) => b - a);

    const MAX_TAGS = 6; // Show top 6 tags

    if (sortedTags.length <= MAX_TAGS) {
      return sortedTags.map(([tag, count]) => [tag, Number(count)]);
    }

    const topTags = sortedTags.slice(0, MAX_TAGS - 1);
    const otherTags = sortedTags.slice(MAX_TAGS - 1);
    const othersCount = otherTags.reduce((sum, [, count]) => sum + Number(count), 0);

    return [...topTags.map(([tag, count]) => [tag, Number(count)] as [string, number]), ['Others', othersCount]];
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground">
            Here's an overview of your support tickets
          </p>
        </div>
        <Button
          onClick={() => navigate("/tickets/new")}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Skills</CardTitle>
          <CardDescription>Your registered skill set</CardDescription>
        </CardHeader>

        <CardContent>
          {loadingSkills ? (
            <p>Loading skills...</p>
          ) : (
            <>
              {/* Horizontal Skill Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {userSkills.length > 0 ? (
                  userSkills.map((skill) => (
                    <div
                      key={skill}
                      className="relative group inline-flex items-center bg-blue-100 text-blue-900 
                         text-sm px-3 py-1 rounded-lg shrink-0 transition-colors duration-200"
                    >
                      {skill}
                      <button
                        onClick={async () => {
                          const response = await fetch("http://localhost:5000/api/tickets/skills/remove", {
                            method: "DELETE",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: token ? `Bearer ${token}` : "",
                            },
                            body: JSON.stringify({ skill }),
                          });
                          if (response.ok) {
                            const data = await response.json();
                            setUserSkills(data.skills);
                          }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-300 text-gray-700
                           text-[10px] flex items-center justify-center font-bold opacity-0
                           group-hover:opacity-100 transition-all duration-200 
                           hover:bg-gray-500 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No skills found</p>
                )}

                {/* Add Skill Button / Dropdown */}
                {!isAddingSkill ? (
                  <Button
                    size="sm"
                    onClick={() => setIsAddingSkill(true)}
                    className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                  >
                    + Add
                  </Button>
                ) : (
                  <div
                    className="flex items-center gap-2 shrink-0 transition-all duration-300 ease-in-out"
                  >
                    <select
                      value={selectedSkill}
                      onChange={(e) => setSelectedSkill(e.target.value)}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    >
                      <option value="">Select a skill</option>
                      {[
                        "troubleshooting",
                        "networking",
                        "operating systems",
                        "hardware support",
                        "software installation",
                        "database basics",
                        "ticketing systems",
                        "customer support",
                        "communication",
                      ].map((skill) => (
                        <option key={skill} value={skill}>
                          {skill}
                        </option>
                      ))}
                    </select>

                    {/* Confirm & Cancel Buttons */}
                    <Button
                      size="sm"
                      className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                      onClick={async () => {
                        if (!selectedSkill) return;
                        const response = await fetch("http://localhost:5000/api/tickets/skills/add", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: token ? `Bearer ${token}` : "",
                          },
                          body: JSON.stringify({ skill: selectedSkill }),
                        });
                        if (response.ok) {
                          const data = await response.json();
                          setUserSkills(data.skills);
                          setSelectedSkill("");
                          setIsAddingSkill(false);
                        }
                      }}
                    >
                      <span className="text-white">&#10003;</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                      onClick={() => setIsAddingSkill(false)}
                    >
                      <span className="text-white">✕</span> 
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.summary.totalTickets || stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics ?
                `${analytics.summary.myTickets} mine + ${analytics.summary.departmentTickets} others` :
                'Department + your created tickets (last 30 days)'
              }
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
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Section */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tag Distribution
              </CardTitle>
              <CardDescription>
                Department + your created tickets (last {analytics?.summary.timeframe || 30} days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : analytics?.tags.length ? (
                <div className="space-y-3">
                  {processTagsForDisplay(
                    Object.fromEntries(
                      analytics.tags.map((tagData) => [tagData.tag, tagData.totalTickets])
                    )
                  ).map(([tagName, totalCount]: [string, number], index: number) => {
                    const originalTagData = analytics.tags.find(t => t.tag === tagName);
                    const isOthersCategory = tagName === 'Others';

                    return (
                      <div key={tagName} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Badge className={getTagColor(tagName, index)}>
                              <Hash className="w-3 h-3 mr-1" />
                              {tagName}
                              {isOthersCategory && ` (${analytics.tags.length - 5} tags)`}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3">
                            {!isOthersCategory && originalTagData && (
                              <div className="flex gap-1 text-xs">
                                <span className="text-blue-600">Dept: {originalTagData.departmentTickets}</span>
                                <span className="text-purple-600">Mine: {originalTagData.myTickets}</span>
                              </div>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {totalCount} total ({((Number(totalCount) / analytics.tags.reduce((sum, tag) => sum + tag.totalTickets, 0)) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`rounded-full h-2 transition-all duration-500 ${getProgressBarColor(tagName, index)}`}
                            style={{
                              width: `${(Number(totalCount) / analytics.tags.reduce((sum, tag) => sum + tag.totalTickets, 0)) * 100}%`
                            }}
                          />
                        </div>

                        {/* Status breakdown badges */}
                        {!isOthersCategory && originalTagData && (
                          <div className="flex flex-wrap gap-1">
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
                <div className="text-center py-6 text-muted-foreground">
                  <Tag className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">No tag data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Priority Distribution
              </CardTitle>
              <CardDescription>
                Your tickets breakdown by priority
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['urgent', 'high', 'medium', 'low'].map(priority => {
                  const total = analytics?.tags.reduce((sum, tag) => {
                    const priorityCount = tag.priorityBreakdown?.[priority] || 0;
                    const myPortion = tag.myTickets > 0 ?
                      Math.round(priorityCount * (tag.myTickets / tag.totalTickets)) : 0;
                    return sum + myPortion;
                  }, 0) || 0;

                  if (total === 0) return null;

                  const myTotalTickets = analytics?.summary?.myTickets || 1;
                  const percentage = (total / myTotalTickets) * 100;

                  return (
                    <div key={priority} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge className={getPriorityColor(priority)}>
                          {priority.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {total} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`rounded-full h-2 transition-all duration-500 ${priority === 'urgent' ? 'bg-red-500' :
                            priority === 'high' ? 'bg-orange-500' :
                              priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Tickets
          </CardTitle>
          <CardDescription>
            Latest from your department and created tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTickets ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : tickets.length ? (
            <div className="space-y-4">
              {tickets
                .slice(0, 4)
                .map((ticket) => {
                  const isCreatedByMe = ticket.createdBy?._id === userId;
                  const isAssignedToMe = ticket.assignedTo?._id === userId;
                  const canEdit = isCreatedByMe || isAssignedToMe;

                  return (
                    <div
                      key={ticket._id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 flex-1 mr-4">
                          {ticket.title}
                          {isCreatedByMe && (
                            <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700">
                              Created by me
                            </Badge>
                          )}
                        </h4>

                        {/* Smart Single Button - Edit OR View Details */}
                        <div className="flex-shrink-0">
                          {canEdit && !['closed'].includes(ticket.status) ? (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 hover:border-green-300"
                              onClick={() => navigate(`/dashboard/tickets/${ticket._id}`)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300"
                              onClick={() => navigate(`/dashboard/tickets/${ticket._id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Badge
                            className={getStatusColor(ticket.status)}
                            variant="secondary"
                          >
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                          <Badge
                            className={getPriorityColor(ticket.priority)}
                            variant="secondary"
                          >
                            {ticket.priority}
                          </Badge>
                          {ticket.department && (
                            <Badge variant="outline" className="bg-gray-50">
                              {ticket.department}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(ticket.createdAt).toLocaleDateString()}
                          {ticket.assignedTo && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>
                                Assigned to {isAssignedToMe ? 'me' : ticket.assignedTo.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4" />
              <h3 className="font-medium mb-2">No tickets yet</h3>
              <p>Create your first ticket to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}