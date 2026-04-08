require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const connectDB = require('./config/db');
const authenticate = require('./middleware/auth');
const ai = require('./ai');

const uploadRoutes = require('./routes/uploadRoutes');
const employees = require("./routes/employees");
const documentRoutes = require('./routes/documents');

const app = express();

// --- Core Middleware ---
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:8080',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// --- API Routes ---

app.use('/api/auth', require('./routes/auth'));

app.use('/api/tickets', authenticate, require('./routes/authTickets'));
app.use('/api/notifications', authenticate, require('./routes/notifications').router);
app.use('/api/gmail', require('./routes/gmail'));
app.use("/api/upload", authenticate, uploadRoutes);
app.use("/api", employees);

// --- AI Route ---
app.use('/api/ai-chat', authenticate);

// --- Health ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/documents', documentRoutes);

// ✅ ONLY run side-effects outside test
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  ai.setupChatbotRoutes(app);
  require('./services/reminderService');
}

// --- Server Startup ---
const PORT = process.env.PORT || 5000;

// ✅ ONLY start server outside test
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// ✅ EXPORT APP (VERY IMPORTANT)
module.exports = app;