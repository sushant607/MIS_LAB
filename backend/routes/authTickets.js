const router = require("express").Router();
const mongoose = require("mongoose");
const authenticate = require("../middleware/auth");
const {
  requireRole,
  canCreateFor,
  canUpdate,
  canDelete,
  canMarkComplete,
  canAssign,
  canCreateTicket,
} = require("../middleware/authorizeAction");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const { createStatusChangeNotifications } = require("./notifications");

// Utility: Get number of tickets assigned to a user
async function countTicketsAssignedToUser(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
  return await Ticket.countDocuments({ assignedTo: userId });
}
// PATCH /api/tickets/:id/status — update status only with RBAC
// PUT /api/tickets/:id — update fields (including status) and return updated doc
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...(req.body || {}) };
    const oldTicket = await Ticket.findById(id)
      .populate("createdBy", "name email role department")
      .populate("assignedTo", "name email role department");

    if (!oldTicket) return res.status(404).json({ msg: "not found" });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "invalid_id" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ msg: "not_found" });

    const allowed = await canUpdate(req, ticket);
    if (!allowed) return res.status(403).json({ msg: "forbidden" });

    // Employees cannot change department/creator
    if (req.user.role === "employee") {
      delete updates.department;
      delete updates.createdBy;
    }
    // Managers/Admins cannot move across departments
    if (
      (req.user.role === "manager" || req.user.role === "admin") &&
      updates.department &&
      updates.department !== ticket.department
    ) {
      return res
        .status(403)
        .json({ msg: "cannot move ticket across departments" });
    }

    // Optional: validate status enum
    if (typeof updates.status !== "undefined") {
      const allowedStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!allowedStatuses.includes(updates.status)) {
        return res.status(400).json({ msg: "invalid_status" });
      }
    }

    ticket.set({ ...updates, updatedAt: new Date() });
    await ticket.save();

    // Check if status is being changed
    const statusChanged = updates.status && updates.status !== oldTicket.status;

    // Apply updates
    oldTicket.set({ ...updates, updatedAt: new Date() });
    await oldTicket.save();

    // 🔔 SEND NOTIFICATIONS FOR STATUS CHANGES
    if (statusChanged) {
      await createStatusChangeNotifications(
        oldTicket,
        req.user,
        updates.status
      );
    }

    const updated = await Ticket.findById(id)
      .populate("createdBy", "name email role department")
      .populate("assignedTo", "name email role department")
      .populate("comments.author", "name");

    return res.json({ message: "ticket_updated", ticket: updated });
  } catch (e) {
    console.error("PUT /tickets/:id error:", e);
    return res.status(500).json({ msg: "update_error" });
  }
});

// GET /api/tickets/analytics/tags
router.get("/analytics/tags", authenticate, async (req, res) => {
  try {
    const { timeframe = "30" } = req.query;
    const daysBack = parseInt(timeframe) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const departmentFilter = {
      createdAt: { $gte: startDate },
      department: req.user.department,
    };

    const userPersonalFilter = {
      createdAt: { $gte: startDate },
      $or: [{ createdBy: userId }, { assignedTo: userId }],
    };

    const deptTicketsCount = await Ticket.countDocuments(departmentFilter);
    const myTicketsCount = await Ticket.countDocuments(userPersonalFilter);

    const departmentTickets = await Ticket.find(departmentFilter).lean();

    const tagStats = {};
    const ticketsSeen = new Set();

    departmentTickets.forEach((ticket) => {
      const ticketId = ticket._id.toString();

      if (ticketsSeen.has(ticketId)) return;
      ticketsSeen.add(ticketId);

      const isUserTicket =
        ticket.createdBy?.toString() === userId.toString() ||
        ticket.assignedTo?.toString() === userId.toString();

      let tags;
      if (!ticket.tags) {
        tags = ["Untagged"];
      } else if (!Array.isArray(ticket.tags)) {
        tags = ["Untagged"];
      } else if (ticket.tags.length === 0) {
        tags = ["Untagged"];
      } else {
        tags = ticket.tags;
      }

      const weight = 1 / tags.length;

      tags.forEach((tag) => {
        if (!tagStats[tag]) {
          tagStats[tag] = {
            tag,
            totalTickets: 0,
            departmentTickets: 0,
            myTickets: 0,
            statusBreakdown: {},
            priorityBreakdown: {},
          };
        }

        tagStats[tag].totalTickets += weight;

        if (isUserTicket) {
          tagStats[tag].myTickets += weight;
        } else {
          tagStats[tag].departmentTickets += weight;
        }

        const status = ticket.status || "unknown";
        const priority = ticket.priority || "unknown";

        tagStats[tag].statusBreakdown[status] =
          (tagStats[tag].statusBreakdown[status] || 0) + weight;
        tagStats[tag].priorityBreakdown[priority] =
          (tagStats[tag].priorityBreakdown[priority] || 0) + weight;
      });
    });

    const analytics = Object.values(tagStats)
      .map((tag) => ({
        ...tag,
        totalTickets: Math.round(tag.totalTickets),
        departmentTickets: Math.round(tag.departmentTickets),
        myTickets: Math.round(tag.myTickets),
        statusBreakdown: Object.fromEntries(
          Object.entries(tag.statusBreakdown).map(([k, v]) => [
            k,
            Math.round(v),
          ])
        ),
        priorityBreakdown: Object.fromEntries(
          Object.entries(tag.priorityBreakdown).map(([k, v]) => [
            k,
            Math.round(v),
          ])
        ),
      }))
      .sort((a, b) => b.totalTickets - a.totalTickets);

    const summary = {
      totalTags: analytics.length,
      totalTickets: deptTicketsCount,
      departmentTickets: Math.max(0, deptTicketsCount - myTicketsCount),
      myTickets: myTicketsCount,
      timeframe: daysBack,
      userRole: req.user.role,
      generatedAt: new Date(),
    };

    const totalTaggedTickets = analytics.reduce(
      (sum, tag) => sum + tag.totalTickets,
      0
    );
    if (totalTaggedTickets > deptTicketsCount) {
      const scaleFactor = deptTicketsCount / totalTaggedTickets;
      analytics.forEach((tag) => {
        tag.totalTickets = Math.round(tag.totalTickets * scaleFactor);
        tag.myTickets = Math.round(tag.myTickets * scaleFactor);
        tag.departmentTickets = Math.round(tag.departmentTickets * scaleFactor);
      });
    }

    return res.json({
      success: true,
      summary,
      tags: analytics,
    });
  } catch (error) {
    console.error("Unified analytics error:", error);
    return res.status(500).json({
      success: false,
      msg: "Error fetching analytics",
    });
  }
});

// GET /api/tickets/team-workload - Detailed team workload with advanced features
router.get("/team-workload", authenticate, async (req, res) => {
  try {
    const {
      department,
      page = 1,
      limit = 20,
      sortBy = "workload",
      sortOrder = "desc",
      filter = "all",
      search = "",
    } = req.query;

    const dept = department || req.user.department;
    if (!dept) {
      return res
        .status(400)
        .json({ success: false, msg: "Department required" });
    }

    // Build user search filter - ONLY EMPLOYEES, NOT MANAGERS
    const userSearchFilter = {
      department: dept,
      role: "employee", // ADD THIS LINE - Only show employees
      ...(search && {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }),
    };

    // Get all users in department with search (employees only)
    const users = await User.find(userSearchFilter).select(
      "id name email role createdAt"
    );

    if (users.length === 0) {
      return res.json({
        success: true,
        teamMembers: [],
        summary: {
          total: 0,
          filtered: 0,
          page,
          totalPages: 0,
          hasMore: false,
          department: dept,
          filters: { sortBy, sortOrder, filter, search },
          stats: {
            available: 0,
            light: 0,
            medium: 0,
            heavy: 0,
            totalActiveTickets: 0,
            avgWorkload: "0",
          },
        },
      });
    }

    // Get active tickets for workload calculation
    const tickets = await Ticket.find({
      assignedTo: { $in: users.map((u) => u._id) },
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name")
      .select(
        "_id title status priority assignedTo createdBy createdAt updatedAt tags"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Calculate detailed workload for each team member
    const detailedWorkload = users.map((user) => {
      const userTickets = tickets.filter(
        (ticket) =>
          ticket.assignedTo &&
          ticket.assignedTo._id.toString() === user._id.toString()
      );

      const activeTickets = userTickets.filter((t) =>
        ["open", "in-progress"].includes(t.status)
      );
      const completedTickets = userTickets.filter((t) =>
        ["resolved", "closed"].includes(t.status)
      );

      // Categorize by priority
      const priorityBreakdown = {
        urgent: activeTickets.filter((t) => t.priority === "urgent").length,
        high: activeTickets.filter((t) => t.priority === "high").length,
        medium: activeTickets.filter((t) => t.priority === "medium").length,
        low: activeTickets.filter((t) => t.priority === "low").length,
      };

      // Recent activity
      const recentTickets = userTickets.slice(0, 5).map((ticket) => ({
        _id: ticket._id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        createdBy: ticket.createdBy?.name || "Unknown",
      }));

      // Calculate workload score (weighted by priority)
      const workloadScore =
        priorityBreakdown.urgent * 4 +
        priorityBreakdown.high * 3 +
        priorityBreakdown.medium * 2 +
        priorityBreakdown.low * 1;

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        joinedAt: user.createdAt,
        totalTickets: userTickets.length,
        activeTickets: activeTickets.length,
        completedTickets: completedTickets.length,
        priorityBreakdown,
        workloadScore,
        completionRate:
          userTickets.length > 0
            ? ((completedTickets.length / userTickets.length) * 100).toFixed(1)
            : "0",
        recentTickets,
        lastActivity: userTickets[0]?.updatedAt || user.createdAt,
        avgResponseTime: "2.3h", // This could be calculated from actual data
        status:
          activeTickets.length === 0
            ? "available"
            : activeTickets.length <= 2
            ? "light"
            : activeTickets.length <= 5
            ? "medium"
            : "heavy",
      };
    });

    // Apply filters
    let filteredMembers = detailedWorkload;
    if (filter === "active") {
      filteredMembers = detailedWorkload.filter(
        (member) => member.activeTickets > 0
      );
    } else if (filter === "available") {
      filteredMembers = detailedWorkload.filter(
        (member) => member.activeTickets <= 2
      );
    } else if (filter === "overloaded") {
      filteredMembers = detailedWorkload.filter(
        (member) => member.activeTickets >= 6
      );
    } else if (filter === "light") {
      filteredMembers = detailedWorkload.filter(
        (member) => member.status === "light"
      );
    } else if (filter === "medium") {
      filteredMembers = detailedWorkload.filter(
        (member) => member.status === "medium"
      );
    } else if (filter === "heavy") {
      filteredMembers = detailedWorkload.filter(
        (member) => member.status === "heavy"
      );
    }

    // Apply sorting
    filteredMembers.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "workload":
          aVal = a.activeTickets;
          bVal = b.activeTickets;
          break;
        case "score":
          aVal = a.workloadScore;
          bVal = b.workloadScore;
          break;
        case "completion":
          aVal = parseFloat(a.completionRate);
          bVal = parseFloat(b.completionRate);
          break;
        case "activity":
          aVal = new Date(a.lastActivity);
          bVal = new Date(b.lastActivity);
          break;
        default:
          aVal = a.activeTickets;
          bVal = b.activeTickets;
      }

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Pagination
    const totalMembers = filteredMembers.length;
    const totalPages = Math.ceil(totalMembers / parseInt(limit));
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedMembers = filteredMembers.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    // Summary statistics
    const summary = {
      total: users.length,
      filtered: totalMembers,
      page: parseInt(page),
      totalPages,
      hasMore: parseInt(page) < totalPages,
      department: dept,
      filters: { sortBy, sortOrder, filter, search },
      stats: {
        available: detailedWorkload.filter((m) => m.status === "available")
          .length,
        light: detailedWorkload.filter((m) => m.status === "light").length,
        medium: detailedWorkload.filter((m) => m.status === "medium").length,
        heavy: detailedWorkload.filter((m) => m.status === "heavy").length,
        totalActiveTickets: detailedWorkload.reduce(
          (sum, m) => sum + m.activeTickets,
          0
        ),
        avgWorkload:
          detailedWorkload.length > 0
            ? (
                detailedWorkload.reduce((sum, m) => sum + m.activeTickets, 0) /
                detailedWorkload.length
              ).toFixed(1)
            : "0",
      },
    };

    return res.json({
      success: true,
      teamMembers: paginatedMembers,
      summary,
    });
  } catch (error) {
    console.error("Detailed team workload error:", error);
    return res
      .status(500)
      .json({ success: false, msg: "Error fetching detailed team workload" });
  }
});

// GET /api/tickets/team-workload-summary - Compact team overview
router.get("/team-workload-summary", authenticate, async (req, res) => {
  try {
    const dept = req.user.department;
    if (!dept) {
      return res
        .status(400)
        .json({ success: false, msg: "Department required" });
    }

    // Get all users in department (count only)
    const totalUsers = await User.countDocuments({ department: dept });

    // Get active ticket assignments
    const activeTickets = await Ticket.find({
      status: { $in: ["open", "in-progress"] },
    })
      .populate("assignedTo", "name department")
      .lean();

    // Filter tickets for this department
    const deptTickets = activeTickets.filter(
      (ticket) => ticket.assignedTo?.department === dept
    );

    // Calculate workload distribution
    const workloadMap = {};
    deptTickets.forEach((ticket) => {
      if (ticket.assignedTo) {
        const userId = ticket.assignedTo._id.toString();
        workloadMap[userId] = (workloadMap[userId] || 0) + 1;
      }
    });

    const workloads = Object.values(workloadMap);

    // Summary statistics
    const summary = {
      totalEmployees: totalUsers,
      activeEmployees: Object.keys(workloadMap).length,
      availableEmployees: totalUsers - Object.keys(workloadMap).length,
      totalActiveTickets: deptTickets.length,
      avgWorkload:
        workloads.length > 0
          ? (workloads.reduce((a, b) => a + b, 0) / workloads.length).toFixed(1)
          : 0,
      workloadDistribution: {
        light: workloads.filter((w) => w <= 2).length, // 0-2 tickets
        medium: workloads.filter((w) => w >= 3 && w <= 5).length, // 3-5 tickets
        heavy: workloads.filter((w) => w >= 6).length, // 6+ tickets
      },
    };

    // Only return top 3 busiest employees for display
    const topBusy = Object.entries(workloadMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([userId, count]) => {
        const user = activeTickets.find(
          (t) => t.assignedTo?._id.toString() === userId
        )?.assignedTo;
        return {
          name: user?.name || "Unknown",
          ticketCount: count,
        };
      });

    return res.json({
      success: true,
      summary,
      topBusy,
      department: dept,
    });
  } catch (error) {
    console.error("Team workload summary error:", error);
    return res
      .status(500)
      .json({ success: false, msg: "Error fetching team workload" });
  }
});

// GET /api/tickets/recommend-assignees?department=
// GET /api/tickets/recommend-assignees?department=&role=employee
router.get("/recommend-assignees", authenticate, async (req, res) => {
  try {
    const { department, role = "employee" } = req.query || {};
    const roleFilter = role ? { role } : {};
    const users = await User.find({
      department: department.replace("+", " "),
      ...roleFilter,
    }).select("name email role department");

    const userLoads = await Promise.all(
      users.map(async (user) => {
        const count = await countTicketsAssignedToUser(user._id);
        return { user, assignedCount: count };
      })
    );

    userLoads.sort((a, b) => a.assignedCount - b.assignedCount);

    const recommendations = userLoads
      .slice(0, 3)
      .map(({ user, assignedCount }) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        assignedTicketCount: assignedCount,
      }));

    return res.json({ recommendations });
  } catch (e) {
    console.error("GET /tickets/recommend-assignees error:", e);
    return res.status(500).json({ msg: "recommend_error" });
  }
});

// GET /api/tickets?scope=me|team&status=&priority=&keywords=
router.get("/", authenticate, async (req, res) => {
  try {
    const { scope = "me", status, priority, keywords } = req.query || {};
    const filter = {};

    if (scope === "me") {
      if (req.user.role === "employee") {
        filter.assignedTo = new mongoose.Types.ObjectId(req.user.id);
      } else filter.createdBy = new mongoose.Types.ObjectId(req.user.id);
    } else if (scope === "team") {
      if (req.user.role === "employee") {
        return res
          .status(403)
          .json({ msg: "Forbidden: Employees cannot access team tickets" });
      }
      if (!req.user.department) {
        return res.status(400).json({ msg: "Missing user department" });
      }
      filter.createdBy = new mongoose.Types.ObjectId(req.user.id);
      filter.department = req.user.department;
    } else if (scope === "department") {
      if (req.user.role === "manager") {
        filter.department = req.user.department;
      } else if (req.user.role === "employee") {
        filter.$and = [
          { department: req.user.department },
          {
            $or: [
              { createdBy: new mongoose.Types.ObjectId(req.user.id) },
              { assignedTo: new mongoose.Types.ObjectId(req.user.id) },
              { status: "open" },
              { tags: { $in: ["help-needed", "collaboration"] } },
            ],
          },
        ];
      } else {
        return res.status(403).json({ msg: "Access denied" });
      }
    } else {
      return res.status(400).json({ msg: 'Invalid scope. Use "me" or "team"' });
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    let tickets = await Ticket.find(filter)
      .populate("createdBy", "name email role department")
      .populate("assignedTo", "name email role department")
      .populate("comments.author", "name")
      .sort({ createdAt: -1 });
    // console.log(tickets[2].comments);
    if (keywords) {
      const keywordArray = keywords.split("+");
      tickets = tickets.filter((ticket) => {
        for (const keyword of keywordArray) {
          if (
            ticket.description?.includes(keyword) ||
            ticket.title.includes(keyword)
          ) {
            return true;
          }
        }
        return false;
      });
    }
    return res.json({ tickets });
  } catch (e) {
    console.error("GET /tickets error:", e);
    return res.status(500).json({ msg: "fetch_error" });
  }
});

// POST /api/tickets
router.post('/', authenticate, async (req, res) => {
    try {
      const { title, description = '', priority, createdForUserId, assignedTo,comments,attachments } = req.body || {};
      const role = req.user.role;
      const tags = req.body.tags;
      // Basic input checks
      if (!title || !priority) {
        return res.status(400).json({ msg: 'title and priority required' });
      }
      // Target user (defaults to self)
      const targetUserId = createdForUserId || req.user.id;
  
      // Determine final assignee per role policy
      let finalAssignedTo;
      if (role === 'employee') {
        // Employees cannot select assignee; force to self
        finalAssignedTo = req.user.id;
      } else {
        // Admin/other privileged roles must provide assignedTo
        if (!assignedTo) {
          return res.status(400).json({ msg: 'assignedTo is required for this role' });
        }
        finalAssignedTo = assignedTo;
      }
  
      // Authorization check against policy (server-side)
      const { allowed, reason } = await canCreateTicket(req, targetUserId, finalAssignedTo);
      if (!allowed) {
        return res.status(403).json({ msg: reason });
      }
  
      // Validate target user and get department
      const targetUser = await User.findById(targetUserId).select('department');
      if (!targetUser) {
        return res.status(400).json({ msg: 'target user not found' });
      }
      if (!targetUser.department) {
        return res.status(400).json({ msg: 'target user missing department' });
      }
  
      // Optional: ensure assignee exists
      const assigneeExists = await User.exists({ _id: finalAssignedTo });
      if (!assigneeExists) {
        return res.status(400).json({ msg: 'assignee not found' });
      }

      // Tag keywords mapping
      const tagKeywords = {
        'VPN': ['vpn', 'virtual private network', 'remote access'],
        'Database': ['database', 'sql', 'mysql', 'postgres', 'db', 'query'],
        'Installation': ['install', 'installation', 'setup', 'configure', 'deployment'],
        'General': ['general', 'other', 'misc', 'question', 'help'],
        'Wifi/Ethernet': ['wifi', 'wireless', 'ethernet', 'network', 'connection', 'internet'],
        'Authentication': ['login', 'password', 'authenticate', 'authentication', 'access', 'permission']
      };

      // Find matching tags
      const matchedTags = Object.entries(tagKeywords)
        .filter(([tag, keywords]) =>
          keywords.some(keyword => description.includes(keyword))
        )
        .map(([tag]) => tag);

      // Always suggest at least 'General' if nothing matches
      if (matchedTags.length === 0) matchedTags.push('General');

      // Limit to max 3 tags
      const suggestedTags = matchedTags.slice(0, 3);

      // Create ticket (Model.create triggers save middleware)
      const doc = await Ticket.create({
        title,
        description,
        priority,
        createdBy: targetUserId, // storing "created for" per existing field naming
        assignedTo: finalAssignedTo,
        department: targetUser.department,
        tags: suggestedTags,
        status: 'open',
        comments,
        attachments
      });
      // console.log(doc)
      return res.status(201).json({
        ticket_id: doc._id,
        message: 'Ticket created and assigned successfully',
      });
    } catch (e) {
      console.error('POST /tickets error:', e);
      return res.status(500).json({ msg: 'create_error' });
    }
  });
    
// PATCH /api/tickets/:id
router.patch("/:id", authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const patch = { ...(req.body || {}) };

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ msg: "not_found" });

    const allowed = await canUpdate(req, ticket);
    if (!allowed) return res.status(403).json({ msg: "forbidden" });

    // Employees cannot change department/creator
    if (req.user.role === "employee") {
      delete patch.department;
      delete patch.createdBy;
    }

    // Managers/Admin cannot move ticket across departments
    if (
      (req.user.role === "manager" || req.user.role === "admin") &&
      patch.department &&
      patch.department !== ticket.department
    ) {
      return res
        .status(403)
        .json({ msg: "cannot move ticket across departments" });
    }

    ticket.set({ ...patch, updatedAt: new Date() });
    await ticket.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error("PATCH /tickets error:", e);
    return res.status(500).json({ msg: "update_error" });
  }
});

// DELETE /api/tickets/:id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ msg: "not_found" });

    const allowed = await canDelete(req, ticket);
    if (!allowed) return res.status(403).json({ msg: "forbidden" });

    await Ticket.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /tickets error:", e);
    return res.status(500).json({ msg: "delete_error" });
  }
});

// POST /api/tickets/:id/resolve
router.post(
  "/:id/resolve",
  authenticate,
  requireRole("manager", "admin"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const ticket = await Ticket.findById(id);
      if (!ticket) return res.status(404).json({ msg: "not_found" });

      const allowed = await canMarkComplete(req, ticket);
      if (!allowed) return res.status(403).json({ msg: "forbidden" });

      ticket.status = "resolved";
      ticket.updatedAt = new Date();
      await ticket.save();
      return res.json({ ok: true });
    } catch (e) {
      console.error("POST /tickets/:id/resolve error:", e);
      return res.status(500).json({ msg: "resolve_error" });
    }
  }
);

// GET /api/tickets/:id — fetch a single ticket by id with RBAC
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(id)
      .populate("createdBy", "name email role department")
      .populate("assignedTo", "name email role department")
      .populate("comments.author", "name")
      .lean(); // Add .lean() to get plain JS object instead of Mongoose document

    if (!ticket) {
      return res.status(404).json({ msg: "Ticket not found" });
    }

    // RBAC checks (keep existing logic)
    const isCreator =
      ticket.createdBy && ticket.createdBy._id?.toString() === req.user.id;
    const isAssignee =
      ticket.assignedTo && ticket.assignedTo._id?.toString() === req.user.id;
    const sameDept = ticket.department === req.user.department;

    if (req.user.role === "employee") {
      const canViewDepartment = sameDept && ["open"].includes(ticket.status);
      if (!(isCreator || isAssignee || canViewDepartment)) {
        return res.status(403).json({ msg: "Forbidden" });
      }
    } else if (req.user.role === "manager" || req.user.role === "admin") {
      if (!(sameDept || isCreator || isAssignee)) {
        return res
          .status(403)
          .json({ msg: "Cross-department access forbidden" });
      }
    } else {
      return res.status(403).json({ msg: "Forbidden" });
    }

    // Ensure attachments is always an array with proper structure
    if (!Array.isArray(ticket.attachments)) {
      ticket.attachments = [];
    }

    return res.json({ ticket }); // Wrap in object for consistency
  } catch (e) {
    console.error("GET /tickets/:id error:", e);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PATCH /api/tickets/:id/assign — assign or unassign a ticket with RBAC
router.patch(
  "/:id/assign",
  authenticate,
  requireRole("manager", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedTo = null } = req.body || {};

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "invalid_id" });
      }

      const ticket = await Ticket.findById(id);
      if (!ticket) return res.status(404).json({ msg: "not_found" });

      // If provided, validate assignee user
      let assigneeUser = null;
      if (assignedTo) {
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
          return res.status(400).json({ msg: "invalid_assignee_id" });
        }
        assigneeUser = await User.findById(assignedTo).select(
          "department role"
        );
        if (!assigneeUser)
          return res.status(400).json({ msg: "assignee_not_found" });
      }

      // Enforce assignment policy
      const ok = await canAssign(req, ticket, assigneeUser);
      if (!ok) return res.status(403).json({ msg: "forbidden" });

      // Idempotent: allow unassign when assignedTo is null
      ticket.assignedTo = assignedTo || null;
      ticket.updatedAt = new Date();
      await ticket.save();

      return res.json({ ok: true });
    } catch (e) {
      console.error("PATCH /tickets/:id/assign error:", e);
      return res.status(500).json({ msg: "assign_error" });
    }
  }
);

// POST /api/tickets/:id/comments - Add a comment to a ticket
router.post("/:id/comments", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ msg: "Comment message is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ msg: "Ticket not found" });
    }

    // Permission check - similar to view permissions
    const isCreator =
      ticket.createdBy && ticket.createdBy.toString() === req.user.id;
    const isAssignee =
      ticket.assignedTo && ticket.assignedTo.toString() === req.user.id;
    const sameDept = ticket.department === req.user.department;

    // Allow comments if user can view the ticket and it's not closed
    let canComment = false;
    if (req.user.role === "employee") {
      canComment =
        (isCreator || isAssignee || sameDept) && ticket.status !== "closed";
    } else if (req.user.role === "manager" || req.user.role === "admin") {
      canComment =
        (sameDept || isCreator || isAssignee) && ticket.status !== "closed";
    }

    if (!canComment) {
      return res.status(403).json({ msg: "Cannot add comment to this ticket" });
    }

    // Add the comment
    ticket.comments.push({
      author: req.user.id,
      message: message.trim(),
      createdAt: new Date(),
    });

    ticket.updatedAt = new Date();
    await ticket.save();

    // Return the ticket with populated comments
    const updatedTicket = await Ticket.findById(id)
      .populate("createdBy", "name email role department")
      .populate("assignedTo", "name email role department")
      .populate("comments.author", "name");

    return res.json({
      message: "Comment added successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("POST /tickets/:id/comments error:", error);
    return res.status(500).json({ msg: "Server error while adding comment" });
  }
});

// POST /api/tickets/:id/attachments - Add attachments to a ticket
router.post("/:id/attachments", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { attachments } = req.body; // Array of {filename, url} objects

    if (
      !attachments ||
      !Array.isArray(attachments) ||
      attachments.length === 0
    ) {
      return res.status(400).json({ msg: "Attachments array is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ msg: "Ticket not found" });
    }

    // Permission check - only users who can edit the ticket can add attachments
    const allowed = await canUpdate(req, ticket);
    if (!allowed) {
      return res
        .status(403)
        .json({ msg: "Cannot add attachments to this ticket" });
    }

    // Validate attachment objects
    for (const attachment of attachments) {
      if (!attachment.filename || !attachment.url) {
        return res
          .status(400)
          .json({ msg: "Each attachment must have filename and url" });
      }
    }

    // Add attachments
    ticket.attachments.push(...attachments);
    ticket.updatedAt = new Date();
    await ticket.save();

    // Return the updated ticket
    const updatedTicket = await Ticket.findById(id)
      .populate("createdBy", "name email role department")
      .populate("assignedTo", "name email role department")
      .populate("comments.author", "name");

    return res.json({
      message: "Attachments added successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("POST /tickets/:id/attachments error:", error);
    return res
      .status(500)
      .json({ msg: "Server error while adding attachments" });
  }
});

// DELETE /api/tickets/:id/comments/:commentId - Delete a comment
router.delete("/:id/comments/:commentId", authenticate, async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ msg: "Ticket not found" });
    }

    const comment = ticket.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ msg: "Comment not found" });
    }

    // Only comment author or admin can delete
    if (
      comment.author.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ msg: "Cannot delete this comment" });
    }

    ticket.comments.pull(commentId);
    ticket.updatedAt = new Date();
    await ticket.save();

    return res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("DELETE /tickets/:id/comments/:commentId error:", error);
    return res.status(500).json({ msg: "Server error while deleting comment" });
  }
});

// DELETE /api/tickets/:id/attachments/:attachmentId - Delete an attachment
router.delete(
  "/:id/attachments/:attachmentId",
  authenticate,
  async (req, res) => {
    try {
      const { id, attachmentId } = req.params;

      const ticket = await Ticket.findById(id);
      if (!ticket) {
        return res.status(404).json({ msg: "Ticket not found" });
      }

      const attachment = ticket.attachments.id(attachmentId);
      if (!attachment) {
        return res.status(404).json({ msg: "Attachment not found" });
      }

      // Permission check - only users who can edit can delete attachments
      const allowed = await canUpdate(req, ticket);
      if (!allowed) {
        return res
          .status(403)
          .json({ msg: "Cannot delete attachments from this ticket" });
      }

      ticket.attachments.pull(attachmentId);
      ticket.updatedAt = new Date();
      await ticket.save();

      return res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      console.error(
        "DELETE /tickets/:id/attachments/:attachmentId error:",
        error
      );
      return res
        .status(500)
        .json({ msg: "Server error while deleting attachment" });
    }
  }
);

// POST /api/tickets/:id/reminders - Set reminder for a ticket
router.post("/:id/reminders", authenticate, async (req, res) => {
  try {
    const { reminderDate, message } = req.body;
    const { id } = req.params;

    // Validate reminder date is in the future
    if (new Date(reminderDate) <= new Date()) {
      return res
        .status(400)
        .json({ error: "Reminder date must be in the future" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Check if user is employee (has access to set reminders)
    if (req.user.role !== "employee" && req.user.role !== "manager") {
      return res
        .status(403)
        .json({ error: "Only employees can set reminders" });
    }

    // Permission check - user must be able to view the ticket
    const isCreator =
      ticket.createdBy && ticket.createdBy.toString() === req.user.id;
    const isAssignee =
      ticket.assignedTo && ticket.assignedTo.toString() === req.user.id;
    const sameDept = ticket.department === req.user.department;

    let canSetReminder = false;
    if (req.user.role === "employee") {
      canSetReminder = isCreator || isAssignee;
    } else if (req.user.role === "manager" || req.user.role === "admin") {
      canSetReminder = sameDept || isCreator || isAssignee;
    }

    if (!canSetReminder) {
      return res
        .status(403)
        .json({ error: "Cannot set reminder for this ticket" });
    }

    const newReminder = {
      setBy: req.user.id,
      reminderDate: new Date(reminderDate),
      message: message || "Ticket reminder",
      isActive: true,
      notificationsSent: {
        oneDayBefore: false,
        fiveHoursBefore: false,
        oneHourBefore: false,
      },
    };

    ticket.reminders.push(newReminder);
    await ticket.save();

    res.json({
      message: "Reminder set successfully",
      reminder: newReminder,
    });
  } catch (error) {
    console.error("Error setting reminder:", error);
    res.status(500).json({ error: "Failed to set reminder" });
  }
});

// GET /api/tickets/:id/reminders - Get reminders for a ticket
router.get("/:id/reminders", authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate(
      "reminders.setBy",
      "name email"
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Permission check - same as view ticket permissions
    const isCreator =
      ticket.createdBy && ticket.createdBy.toString() === req.user.id;
    const isAssignee =
      ticket.assignedTo && ticket.assignedTo.toString() === req.user.id;
    const sameDept = ticket.department === req.user.department;

    let canView = false;
    if (req.user.role === "employee") {
      canView = isCreator || isAssignee;
    } else if (req.user.role === "manager" || req.user.role === "admin") {
      canView = sameDept || isCreator || isAssignee;
    }

    if (!canView) {
      return res
        .status(403)
        .json({ error: "Cannot view reminders for this ticket" });
    }

    res.json(ticket.reminders.filter((r) => r.isActive));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

// DELETE /api/tickets/:ticketId/reminders/:reminderId - Delete reminder
router.delete(
  "/:ticketId/reminders/:reminderId",
  authenticate,
  async (req, res) => {
    try {
      const { ticketId, reminderId } = req.params;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const reminder = ticket.reminders.id(reminderId);
      if (!reminder) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      // Only reminder creator or manager can delete
      if (
        reminder.setBy.toString() !== req.user.id &&
        req.user.role !== "manager"
      ) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this reminder" });
      }

      reminder.isActive = false;
      await ticket.save();

      res.json({ message: "Reminder deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  }
);

// DELETE /api/tickets/:ticketId/reminders/cleanup - Clean up old reminders
router.delete(
  "/:ticketId/reminders/cleanup",
  authenticate,
  async (req, res) => {
    try {
      const { ticketId } = req.params;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Remove inactive reminders older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const initialCount = ticket.reminders.length;
      ticket.reminders = ticket.reminders.filter(
        (reminder) =>
          reminder.isActive || new Date(reminder.createdAt) > oneDayAgo
      );

      await ticket.save();
      const cleanedCount = initialCount - ticket.reminders.length;

      res.json({
        message: `Cleaned up ${cleanedCount} old reminders`,
        remainingReminders: ticket.reminders.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to cleanup reminders" });
    }
  }
);
// GET all skills of the logged-in user
router.get("/skills/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name email department role skills"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      user: {
        skills: user.skills || [],
      },
    });
  } catch (err) {
    console.error("Error fetching user skills:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/tickets/skills/add
router.post("/skills/add", authenticate, async (req, res) => {
  try {
    const { skill } = req.body;
    const VALID_SKILLS = [
      "troubleshooting",
      "networking",
      "operating systems",
      "hardware support",
      "software installation",
      "database basics",
      "ticketing systems",
      "customer support",
      "communication",
    ];

    if (!skill || !VALID_SKILLS.includes(skill)) {
      return res.status(400).json({ message: "Invalid skill" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.skills.includes(skill)) {
      user.skills.push(skill);
      await user.save();
    }

    res.json({ success: true, skills: user.skills });
  } catch (err) {
    console.error("Error adding skill:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});
//remove a particular skill from the logged-in user
router.delete("/skills/remove", authenticate, async (req, res) => {
  try {
    const { skill } = req.body;
    if (!skill) return res.status(400).json({ message: "Skill is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.skills = user.skills.filter((s) => s !== skill);
    await user.save();

    return res.status(200).json({ success: true, skills: user.skills });
  } catch (err) {
    console.error("Error removing skill:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
