const request = require("supertest");

global.mockUser = { id: 'u1', role: 'employee', department: 'IT' };

// Mock dependencies BEFORE importing app
jest.mock("../middleware/auth", () => (req, res, nxt) => {
  if (req.originalUrl.includes('tickets')) {
    req.user = global.mockUser;
  }
  nxt();
});

jest.mock("../middleware/authorizeAction", () => ({
  canCreateTicket: jest.fn().mockResolvedValue({ allowed: true, reason: "" }),
  canUpdate: jest.fn(),
  requireRole: jest.fn(() => (req, res, nxt) => nxt()),
  canCreateFor: jest.fn(),
  canDelete: jest.fn(),
  canMarkComplete: jest.fn(),
  canAssign: jest.fn(),
}));

jest.mock("../models/User", () => ({
  findById: jest.fn(),
  exists: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../models/Ticket", () => ({
  create: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../routes/notifications", () => ({
  createStatusChangeNotifications: jest.fn(),
  router: require("express").Router(),
}));

const User = require("../models/User");
const Ticket = require("../models/Ticket");
const { canCreateTicket } = require("../middleware/authorizeAction");
const app = require("../server");

describe("Structural Testing: POST /api/tickets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.mockUser = { id: 'u1', role: 'employee', department: 'IT' };

    // Default valid mock responses
    canCreateTicket.mockResolvedValue({ allowed: true, reason: "" });
    
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ department: 'IT' })
    });
    
    User.exists.mockResolvedValue(true);
    Ticket.create.mockResolvedValue({ _id: 'new_ticket_id' });
  });

  it("should return 400 if title or priority is missing", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send({ priority: "high" }); 
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("title and priority required");

    const res2 = await request(app)
      .post("/api/tickets")
      .send({ title: "Crash" }); 
    expect(res2.status).toBe(400);
  });

  it("should return 400 if role is not employee and missing assignedTo", async () => {
    global.mockUser = { id: 'admin1', role: 'admin', department: 'IT' };
    const res = await request(app)
      .post("/api/tickets")
      .send({ title: "T1", priority: "high" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("assignedTo is required for this role");
  });

  it("should return 403 if canCreateTicket fails", async () => {
    canCreateTicket.mockResolvedValue({ allowed: false, reason: "Not allowed" });
    const res = await request(app)
      .post("/api/tickets")
      .send({ title: "T1", priority: "high" });
    expect(res.status).toBe(403);
    expect(res.body.msg).toBe("Not allowed");
  });

  it("should return 400 if target user not found", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });
    const res = await request(app)
      .post("/api/tickets")
      .send({ title: "T1", priority: "high" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("target user not found");
  });

  it("should return 400 if target user missing department", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ department: null })
    });
    const res = await request(app)
      .post("/api/tickets")
      .send({ title: "T1", priority: "high" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("target user missing department");
  });

  it("should return 400 if assignee exists check fails", async () => {
    User.exists.mockResolvedValue(false);
    const res = await request(app)
      .post("/api/tickets")
      .send({ title: "T1", priority: "high" });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("assignee not found");
  });

  it("should create ticket and match tags for VPN and Database", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send({ 
        title: "vpn database", 
        priority: "high",
        description: "need vpn for database" 
      });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Ticket created and assigned successfully");
    
    expect(Ticket.create).toHaveBeenCalled();
    const createArg = Ticket.create.mock.calls[0][0];
    expect(createArg.tags).toContain("VPN");
    expect(createArg.tags).toContain("Database");
  });

  it("should create ticket for admin with assignedTo", async () => {
    global.mockUser = { id: 'admin1', role: 'admin', department: 'IT' };
    const res = await request(app)
      .post("/api/tickets")
      .send({ 
        title: "T1", 
        priority: "high",
        assignedTo: 'user2'
      });
    expect(res.status).toBe(201);
    expect(Ticket.create).toHaveBeenCalledWith(expect.objectContaining({
      assignedTo: 'user2'
    }));
  });

  it("should fallback to General tag if none matches", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .send({ 
        title: "T1", 
        priority: "high",
        description: "just some random text"
      });
    expect(res.status).toBe(201);
    const createArg = Ticket.create.mock.calls[0][0];
    expect(createArg.tags).toContain("General");
  });

  it("should return 500 on create error", async () => {
    Ticket.create.mockRejectedValue(new Error("DB Error"));
    const res = await request(app)
      .post("/api/tickets")
      .send({ title: "T1", priority: "high" });
    expect(res.status).toBe(500);
    expect(res.body.msg).toBe("create_error");
  });
});