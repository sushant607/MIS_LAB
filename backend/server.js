require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const connectDB = require('./config/db');
const authenticate = require('./middleware/auth');
const ai = require('./ai');
const uploadRoutes=require('./routes/uploadRoutes')
const employees=require("./routes/employees")
const documentRoutes = require('./routes/documents')

const app = express();

// --- Core Middleware ---
app.use(helmet()); // Basic security headers
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:8080' || 'http://localhost:8081', // Your frontend URL
  credentials: true, // Important for sending cookies with requests
}));
app.use(express.json()); // For parsing application/json
app.use(cookieParser()); // For parsing cookies, used by auth middleware

// Connect to MongoDB
connectDB();

// --- API Routes ---

// Public routes (authentication)
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/api/tickets', authenticate, require('./routes/authTickets')); // Use the secure ticket routes
app.use('/api/notifications', authenticate, require('./routes/notifications').router);
app.use('/api/gmail',  require('./routes/gmail'));
app.use("/api/upload", authenticate, uploadRoutes);
app.use("/api",employees)

// --- AI Chatbot Route ---
app.use('/api/ai-chat', authenticate);
ai.setupChatbotRoutes(app);

// Health check endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/documents', documentRoutes);

require('./services/reminderService');
// --- Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
