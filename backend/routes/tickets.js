const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Create ticket
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const ticket = new Ticket({
      title,
      description,
      priority,
      createdBy: req.user.id
    });
    await ticket.save();
    res.json(ticket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all tickets (with optional query filters)
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, mine } = req.query;
    const q = {};
    if (status) q.status = status;
    if (priority) q.priority = priority;
    if (mine === 'true') q.createdBy = req.user.id;
    const tickets = await Ticket.find(q).populate('createdBy','name email').populate('assignedTo','name email').sort({createdAt:-1});
    res.json(tickets);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get ticket by id
router.get('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('createdBy','name email').populate('comments.author','name email');
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update ticket
router.put('/:id', auth, async (req, res) => {
  try {
    const updates = req.body;
    updates.updatedAt = Date.now();
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Add comment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    const comment = { author: req.user.id, message: req.body.message };
    ticket.comments.push(comment);
    await ticket.save();
    res.json(ticket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete ticket
router.delete('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    await ticket.remove();
    res.json({ msg: 'Ticket removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});



module.exports = router;
