require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const bookingRoutes = require('./routes/bookings');
const packageRoutes = require('./routes/packages');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================
// Middleware
// ============================

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'AI rate limit reached, please wait a moment' }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// ============================
// API Routes
// ============================
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/vehicles', apiLimiter, vehicleRoutes);
app.use('/api/bookings', apiLimiter, bookingRoutes);
app.use('/api/packages', apiLimiter, packageRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Hello Brother API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================
// Error handling
// ============================
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ============================
// Start Server
// ============================
const startServer = async () => {
  try {
    // Connect to MongoDB (skip if MONGODB_URI not set for static demo)
    if (process.env.MONGODB_URI) {
      await connectDB();
    } else {
      console.log('⚠️  No MONGODB_URI set — running in static/demo mode');
    }

    app.listen(PORT, '0.0.0.0', () => {
      // Get local network IP for mobile access
      const os = require('os');
      const interfaces = os.networkInterfaces();
      let localIP = 'localhost';
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
          }
        }
        if (localIP !== 'localhost') break;
      }

      console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   🚗 Hello Brother Server                    ║
║                                              ║
║   Local:   http://localhost:${PORT}              ║
║   Mobile:  http://${localIP}:${PORT}       ║
║                                              ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(26)}  ║
║                                              ║
╚══════════════════════════════════════════════╝

📱 To view on mobile: Connect your phone to the
   same WiFi and open http://${localIP}:${PORT}
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
