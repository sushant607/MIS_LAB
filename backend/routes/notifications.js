const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// PUT /api/notifications/all/read
router.put('/all/read', auth, async (req, res) => {
  try {
   
    const result = await Notification.updateMany(
      { user: req.user.id, read: false }, 
      { read: true }
    );

    res.json({
      msg: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get notifications for current user
router.get('/', auth, async (req, res) => {
  try {
   
    const notes = await Notification.find({user: req.user.id}).sort({ createdAt: -1 });
   
    res.json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Mark as read
router.put('/:id/read', auth, async (req, res) => {
  try {
  
    const note = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
   
    res.json(note);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    // Find and delete the notification for the logged-in user
    const note = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!note) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    res.json({ msg: 'Notification deleted successfully', deletedId: req.params.id });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST /api/notifications/remind/:ticketId - Only for managers
router.post('/remind/:ticketId', auth, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const User = require('../models/User');
    
    // Get current user to check role
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Check if user is a manager
    if (currentUser.role !== 'manager') {
      return res.status(403).json({ msg: 'Access denied. Only managers can send reminders.' });
    }
    
    // Find the ticket and populate assignedTo and createdBy
    const ticket = await Ticket.findById(req.params.ticketId)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    
    if (!ticket) {
      return res.status(404).json({ msg: 'Ticket not found' });
    }
    
    // Check if ticket has an assignee
    if (!ticket.assignedTo) {
      return res.status(400).json({ msg: 'Ticket has no assignee to remind' });
    }
    
    // Create notification for the assignee
    const notification = new Notification({
      user: ticket.assignedTo._id,
      title: `Manager Reminder: Ticket "${ticket.title}"`,
      message: `Manager ${currentUser.name} sent you a reminder about ticket: "${ticket.title}". Priority: ${ticket.priority.toUpperCase()}. Status: ${ticket.status.replace('_', ' ').toUpperCase()}.`,
      type: 'manager_reminder',
      ticketId: ticket._id,
      read: false
    });
    
    await notification.save();
    
    res.json({ 
      msg: 'Manager reminder sent successfully',
      assigneeName: ticket.assignedTo.name,
      ticketTitle: ticket.title,
      managerName: currentUser.name
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Function to create reminder notifications (used by reminder service)
const createReminderNotification = async (userId, ticket, reminder, timeframe) => {
  try {
    let titleText = '';
    let messagePrefix = '';
    
    switch(timeframe) {
      case 'overdue':
        titleText = 'Ticket Reminder - Due Now!';
        messagePrefix = '⚠️ OVERDUE: ';
        break;
      case '1 minute':
        titleText = 'Ticket Reminder - 1 minute remaining';
        messagePrefix = '🔔 Final reminder: ';
        break;
      case '1 hour':
        titleText = 'Ticket Reminder - 1 hour remaining';
        messagePrefix = '⏰ ';
        break;
      case '5 hours':
        titleText = 'Ticket Reminder - 5 hours remaining';  
        messagePrefix = '📅 ';
        break;
      case '1 day':
        titleText = 'Ticket Reminder - 1 day remaining';
        messagePrefix = '📌 ';
        break;
      default:
        titleText = `Ticket Reminder - ${timeframe}`;
        messagePrefix = '';
    }

    const notification = new Notification({
      user: userId,
      title: titleText,
      message: `${messagePrefix}Reminder for ticket "${ticket.title}": ${reminder.message}`,
      type: 'self_reminder',
      ticketId: ticket._id,
      read: false
    });

    await notification.save();
    // console.log(`Reminder notification created for user ${userId}, ticket ${ticket._id}`);
    return notification;
  } catch (error) {
    console.error('Failed to create reminder notification:', error);
    throw error;
  }
};

// Create Status Change Notifications
const createStatusChangeNotifications = async (ticket, changedBy, newStatus) => {
  try {
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    
    const recipients = new Set(); // Use Set to avoid duplicates
    
    // Find department manager
    const departmentManager = await User.findOne({
      department: ticket.department,
      role: 'manager'
    });
    
    // Notification logic based on who changed the status
    if (changedBy.role === 'employee') {
      // Employee changed status → Notify manager
      if (departmentManager && departmentManager._id.toString() !== changedBy.id) {
        recipients.add(departmentManager._id.toString());
      }
      
      // If employee is not the creator, notify creator too
      if (ticket.createdBy && ticket.createdBy._id.toString() !== changedBy.id) {
        recipients.add(ticket.createdBy._id.toString());
      }
    } else if (changedBy.role === 'manager') {
      // Manager changed status → Notify assignee and creator
      if (ticket.assignedTo && ticket.assignedTo._id.toString() !== changedBy.id) {
        recipients.add(ticket.assignedTo._id.toString());
      }
      
      if (ticket.createdBy && 
          ticket.createdBy._id.toString() !== changedBy.id &&
          ticket.createdBy._id.toString() !== ticket.assignedTo?._id.toString()) {
        recipients.add(ticket.createdBy._id.toString());
      }
    }
    
    // Create notifications for all recipients
    const notifications = Array.from(recipients).map(userId => ({
      user: userId,
      title: `Ticket Status Updated: ${ticket.title}`,
      message: `${changedBy.name} changed ticket status to "${newStatus.toUpperCase()}"`,
      type: 'status_change',
      ticketId: ticket._id,
      read: false
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} status change notifications`);
    }
    
  } catch (error) {
    console.error('❌ Error creating status change notifications:', error);
    // Don't throw - notifications shouldn't break ticket updates
  }
}

module.exports = {
  router,
  createReminderNotification,
  createStatusChangeNotifications
};


