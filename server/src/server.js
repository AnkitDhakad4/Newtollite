require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { authenticate } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const AgentService = require('./services/agentService');
const { seedDatabase } = require('./seed/seed');
const User = require('./models/User');

const workItemRoutes = require('./routes/workItemRoutes');
const authRoutes = require('./routes/authRoutes');
const teamRoutes = require('./routes/teamRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors({
  origin: '*',
  exposedHeaders: ['ETag', 'X-Cache-Lookup']
}));
app.use(express.json());

// Request logger for observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/api/work-items/attention-feed') || duration > 100) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Authentication middleware applied globally to /api
app.use('/api', authenticate);

// Mount API routes
app.use('/api/work-items', workItemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// Centralized Error Handler
app.use(errorHandler);

// Boot function
async function startServer() {
  try {
    await connectDB();

    // Auto-seed if empty for frictionless evaluation
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Bootstrap] Empty database detected. Auto-seeding initial scenario data...');
      await seedDatabase();
    }

    // Initialize Autonomous AI Copilot Worker
    AgentService.initialize();

    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  Newtonite Operations Platform Engine (JavaScript)   `);
      console.log(`  Server running on http://localhost:${PORT}          `);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=======================================================`);
    });

    return { app, server };
  } catch (err) {
    console.error('[Bootstrap] Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };

