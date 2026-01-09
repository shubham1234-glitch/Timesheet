import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import epicRoutes from './routes/epicRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import commentsRoutes from './routes/commentsRoutes.js';
import challengesRoutes from './routes/challengesRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import timesheetRoutes from './routes/timesheetRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import teamDashboardRoutes from './routes/teamDashboardRoutes.js';
import superAdminDashboardRoutes from './routes/superAdminDashboardRoutes.js';
import predefinedEpicRoutes from './routes/predefinedEpicRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());

// Simple test route
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW() as current_time');
  res.json({ message: 'API running', time: result.rows[0].current_time });
});

// ✅ Mount your timesheet routes
app.use('/api/v1/timesheet', epicRoutes);
app.use('/api/v1/timesheet', taskRoutes);
app.use('/api/v1/timesheet', commentsRoutes);
app.use('/api/v1/timesheet', challengesRoutes);
app.use('/api/v1/timesheet', activityRoutes);
app.use('/api/v1/timesheet', timesheetRoutes);
app.use('/api/v1/timesheet', ticketRoutes);
app.use('/api/v1/timesheet', leaveRoutes);
app.use('/api/v1/timesheet', dashboardRoutes);
app.use('/api/v1/timesheet', teamDashboardRoutes);
app.use('/api/v1/timesheet', superAdminDashboardRoutes);
app.use('/api/v1/timesheet', predefinedEpicRoutes);

export default app;
