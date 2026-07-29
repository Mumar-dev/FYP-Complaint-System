import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import authRoutes from './routes/auth.routes';
import complaintRoutes from './routes/complaint.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import departmentRoutes from './routes/department.routes';
import staffRoutes from './routes/staff.routes';
import notificationRoutes from './routes/notification.routes';
import evidenceRoutes from './routes/evidence.routes';
import slaRoutes from './routes/sla.routes';
import dashboardRoutes from './routes/dashboard.routes';
import employeeRoutes from './routes/employee.routes';
import shiftRoutes from './routes/shift.routes';
import attendanceRoutes from './routes/attendance.routes';
import leaveRoutes from './routes/leave.routes';
import performanceRoutes from './routes/performance.routes';
import promotionRoutes from './routes/promotion.routes';
import employeeTransferRoutes from './routes/employeeTransfer.routes';
import disciplinaryRoutes from './routes/disciplinary.routes';
import hrDashboardRoutes from './routes/hrDashboard.routes';
import { connectDB } from './config/database';
import { startSlaMonitorJob } from './jobs/slaMonitor.job';
import { checkAiHealth } from './services/ai.service';

// dotenv already configured at the top

// Critical Environment Validation
if (!process.env.JWT_SECRET) {
  console.error('[FATAL SERVER ERROR] JWT_SECRET is missing from environment variables. Stopping server to prevent exposed cookies.');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.error('[FATAL SERVER ERROR] JWT_REFRESH_SECRET is missing from environment variables. Stopping server.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware - Helmet provides multiple security headers
app.use(helmet());

// Middleware Application
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Crucial for HTTP-only cookies
  })
);

// Rate Limiting Middleware - Security Enhancement
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 login/register attempts per windowMs (increased for development)
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply rate limiting to all requests
app.use(generalLimiter);

// Route Registration
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/employee-transfers', employeeTransferRoutes);
app.use('/api/disciplinary', disciplinaryRoutes);
app.use('/api/hr-dashboard', hrDashboardRoutes);

import { createServer } from 'http';
import { initSocket } from './services/socket.service';

// Global Error Handler Array fallback
app.use((err: Error, request: Request, response: Response, next: NextFunction) => {
  console.error('[Global Error Handler Triggered]:', err.message);
  response.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

// Database Start & Server Listener
const startServer = async () => {
  try {
    await connectDB();
    
    // Start background jobs
    startSlaMonitorJob();

    const httpServer = createServer(app);
    initSocket(httpServer);

    // AI API Health & Diagnostics Check
    try {
      const aiHealth = await checkAiHealth();
      if (aiHealth.ok) {
        console.log(`[AI] ✅ AI API is configured and working (Groq: ${aiHealth.model})`);
      } else {
        console.warn(`[AI] ❌ AI API is NOT working: ${aiHealth.error}`);
      }
    } catch (aiErr: any) {
      console.warn(`[AI] ❌ AI API is NOT working: ${aiErr?.message || aiErr}`);
    }

    httpServer.listen(PORT, () => {
      console.log(`[Server] Live and listening securely on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server Ignition Error] DB failed to connect', error);
    process.exit(1);
  }
};

startServer();
