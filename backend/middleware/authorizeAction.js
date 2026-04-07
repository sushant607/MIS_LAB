const mongoose = require('mongoose');
const User = require('../models/User');

// Role helpers
function requireRole(...allowed) {
  return (req, res, next) => {
    const ok = allowed.includes(req.user.role);
    if (!ok) return res.status(403).json({ msg: 'Forbidden' });
    return next();
  };
}

// Listing scope: employee → self only; manager/admin → department only
function listScope(req) {
  const role = req.user.role;
  if (role === 'employee') {
    return { createdBy: new mongoose.Types.ObjectId(req.user.id) };
  }
  return { department: req.user.department };
}

function canAccessTeamScope(req) {
  const role = req.user.role;
  return role === 'manager' || role === 'admin';
}

// NEW CREATION POLICY
// - Employee: can only create for self (createdBy = self, assignedTo = self mandatory)
// - Manager/Admin: can create for anyone in same department (assignedTo mandatory, must be same dept)
async function canCreateTicket(req, createdForUserId, assignedToUserId) {
  const { role, department, id: creatorId } = req.user;
  
  const createdForUser = await User.findById(createdForUserId).select('department');

  // Employee restrictions
  if (role === 'employee') {
    // Must create for self only
    
    if (createdForUserId !== creatorId) {
      return { allowed: false, reason: 'Employees can only create tickets for themselves' };
    }
    // Must assign to self only  
    if (assignedToUserId !== creatorId) {
      return { allowed: false, reason: 'Employees must assign tickets to themselves' };
    }
    if (createdForUser.department !== req.body.department) {
      return { allowed: false, reason: 'Cannot create tickets for users outside your department' };
    }
    return { allowed: true };
  }

  // Manager/Admin restrictions
  if (role === 'manager' || role === 'admin') {
    // Verify createdFor user exists and is in same department
    if (!createdForUser) {
      return { allowed: false, reason: 'Created-for user not found' };
    }
    if (createdForUser.department !== department) {
      return { allowed: false, reason: 'Cannot create tickets for users outside your department' };
    }

    // Verify assignedTo user exists and is in same department
    const assignedToUser = await User.findById(assignedToUserId).select('department');
    if (!assignedToUser) {
      return { allowed: false, reason: 'Assigned-to user not found' };
    }
    if (assignedToUser.department !== department) {
      return { allowed: false, reason: 'Cannot assign tickets to users outside your department' };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Invalid role' };
}

// Update permissions
async function canUpdate(req, ticket) {
  const { role, department, id: userId } = req.user;
  
  if (role === 'employee') {
    // Can update only if creator or assignee
    const isCreator = ticket.createdBy && ticket.createdBy.toString() === userId;
    const isAssignee = ticket.assignedTo && ticket.assignedTo.toString() === userId;
    return isCreator || isAssignee;
  }
  
  if (role === 'manager' || role === 'admin') {
    // Can update tickets in same department
    return ticket.department === department;
  }
  
  return false;
}

// Delete permissions
async function canDelete(req, ticket) {
  const { role, department, id: userId } = req.user;
  
  if (role === 'employee') {
    // Can delete only own tickets
    return ticket.createdBy && ticket.createdBy.toString() === userId;
  }
  
  if (role === 'manager' || role === 'admin') {
    // Can delete tickets in same department
    return ticket.department === department;
  }
  
  return false;
}

// Mark complete permissions
async function canMarkComplete(req, ticket) {
  const { role, department } = req.user;
  
  if (role === 'employee') {
    return false; // Employees cannot mark tickets complete
  }
  
  if (role === 'manager' || role === 'admin') {
    return ticket.department === department;
  }
  
  return false;
}

// Assign permissions
async function canAssign(req, ticket, assigneeUser) {
  if (!ticket) return false;
  const isPrivileged = req.user.role === 'manager' || req.user.role === 'admin';
  if (!isPrivileged) return false;
  if (ticket.department !== req.user.department) return false;
  if (assigneeUser && assigneeUser.department !== ticket.department) return false;
  return true;
}

module.exports = {
  requireRole,
  listScope,
  canAccessTeamScope,
  canCreateTicket,
  canUpdate,
  canDelete,
  canMarkComplete,
  canAssign,
};
