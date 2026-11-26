import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import {
  callNextToken,
  cancelToken,
  createCounter,
  createOrganization,
  createService,
  createToken,
  finishCounterToken,
  getAdminOrganizations,
  getOrganizationAdminWorkspace,
  getOrganizationLiveDisplay,
  getOrganizationsWithQueues,
  getPublicStats,
  getUserNotifications,
  getUserTokens,
  lookupToken,
  markAllNotificationsRead,
  toggleCounterStatus,
  toggleServiceOpen,
  updateUserProfile,
} from './src/db/queries.ts';
import { optionalAuth, requireAuth, type AuthRequest } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const httpServer = createHttpServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

interface QueueEventPayload {
  type: 'queue:updated' | 'token:called' | 'token:booked' | 'token:cancelled';
  organizationId: number;
  serviceId?: number;
  tokenCode?: string;
  counterName?: string;
  timestamp: string;
}

const broadcastQueueEvent = (payload: QueueEventPayload) => {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
    })
  );
  socket.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

// Validation Schemas
const bookTokenSchema = z.object({
  organizationId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().max(24).optional().nullable(),
  customerEmail: z.string().trim().email().optional().or(z.literal('')).nullable(),
  isPriority: z.boolean().default(false),
  priorityReason: z
    .enum(['standard', 'senior', 'disability', 'emergency', 'vip'])
    .default('standard'),
  notes: z.string().trim().max(240).optional().nullable(),
});

const createOrgSchema = z.object({
  name: z.string().trim().min(3).max(80),
  category: z.enum(['Hospital', 'Bank', 'Government', 'College', 'Service Centre']),
  location: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(240),
  serviceName: z.string().trim().min(2).max(60),
  servicePrefix: z.string().trim().min(1).max(2),
  avgServiceMinutes: z.number().int().min(1).max(120),
  counterName: z.string().trim().min(2).max(40),
  staffName: z.string().trim().min(2).max(60),
});

const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  prefix: z.string().trim().min(1).max(2),
  avgServiceMinutes: z.number().int().min(1).max(120),
  priorityEnabled: z.boolean().default(true),
});

const createCounterSchema = z.object({
  name: z.string().trim().min(2).max(40),
  staffName: z.string().trim().min(2).max(60),
  serviceId: z.number().int().positive().nullable(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(24).optional(),
  defaultPriorityType: z
    .enum(['standard', 'senior', 'disability', 'emergency', 'vip'])
    .optional(),
});

// Public Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/public/stats', async (_req, res) => {
  try {
    const stats = await getPublicStats();
    res.json(stats);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load stats';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/public/organizations', async (_req, res) => {
  try {
    const orgs = await getOrganizationsWithQueues();
    res.json({ organizations: orgs });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load organizations';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/public/display/:slugOrId', async (req, res) => {
  try {
    const data = await getOrganizationLiveDisplay(req.params.slugOrId);
    if (!data) {
      res.status(404).json({ error: 'Organization display not found.' });
      return;
    }
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load live display';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/public/tokens/lookup', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.trim().length < 2) {
      res.status(400).json({ error: 'Enter a valid token code (e.g. A-016) or phone number.' });
      return;
    }
    const results = await lookupToken(q);
    res.json({ tokens: results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lookup failed';
    res.status(500).json({ error: msg });
  }
});

// Token Booking (Supports both authenticated users and walk-in/guest booking)
app.post('/api/tokens', optionalAuth, async (req: AuthRequest, res) => {
  const parsed = bookTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Please check your booking details.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const data = parsed.data;
    const result = await createToken({
      organizationId: data.organizationId,
      serviceId: data.serviceId,
      userUid: req.user?.uid || null,
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      customerEmail: data.customerEmail || req.user?.email || null,
      isPriority: data.isPriority,
      priorityReason: data.priorityReason,
      notes: data.notes || null,
    });

    broadcastQueueEvent({
      type: 'token:booked',
      organizationId: data.organizationId,
      serviceId: data.serviceId,
      tokenCode: result.token.tokenCode,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to book token';
    res.status(400).json({ error: msg });
  }
});

// Authenticated User Routes
app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile fields.' });
    return;
  }
  try {
    const updated = await updateUserProfile(req.user!.uid, parsed.data);
    res.json({ user: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Update failed';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/my/tokens', requireAuth, async (req: AuthRequest, res) => {
  try {
    const myTokens = await getUserTokens(req.user!.uid);
    res.json({ tokens: myTokens });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load tokens';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/tokens/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  const tokenId = Number(req.params.id);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    res.status(400).json({ error: 'Invalid token ID.' });
    return;
  }
  try {
    const cancelled = await cancelToken(
      tokenId,
      req.user!.uid,
      req.dbUser?.role === 'admin'
    );
    broadcastQueueEvent({
      type: 'token:cancelled',
      organizationId: cancelled.organizationId,
      serviceId: cancelled.serviceId,
      tokenCode: cancelled.tokenCode,
      timestamp: new Date().toISOString(),
    });
    res.json({ token: cancelled });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Cancel failed';
    const status = msg.includes('Unauthorized') ? 403 : 400;
    res.status(status).json({ error: msg });
  }
});

app.get('/api/my/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await getUserNotifications(req.user!.uid);
    res.json({ notifications: items });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load notifications';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/my/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await markAllNotificationsRead(req.user!.uid);
    res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to mark read';
    res.status(500).json({ error: msg });
  }
});

// Admin & Organization Workspace Routes
app.get('/api/admin/organizations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await getAdminOrganizations(req.user!.uid, req.dbUser?.role || 'customer');
    res.json({ organizations: list });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load organizations';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/admin/organizations', requireAuth, async (req: AuthRequest, res) => {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Please fill out all organization fields accurately.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  try {
    const result = await createOrganization({
      ...parsed.data,
      ownerUid: req.user!.uid,
    });
    broadcastQueueEvent({
      type: 'queue:updated',
      organizationId: result.organization.id,
      timestamp: new Date().toISOString(),
    });
    res.status(201).json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Creation failed';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/admin/organizations/:orgId/workspace', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    res.status(400).json({ error: 'Invalid organization ID.' });
    return;
  }
  try {
    const workspace = await getOrganizationAdminWorkspace(
      orgId,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    res.json(workspace);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load workspace';
    const status = msg.includes('Forbidden') ? 403 : 400;
    res.status(status).json({ error: msg });
  }
});

app.post('/api/admin/organizations/:orgId/counters/:counterId/call-next', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  const counterId = Number(req.params.counterId);
  if (!Number.isInteger(orgId) || !Number.isInteger(counterId)) {
    res.status(400).json({ error: 'Invalid identifiers.' });
    return;
  }
  try {
    const result = await callNextToken(
      orgId,
      counterId,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    broadcastQueueEvent({
      type: 'token:called',
      organizationId: orgId,
      serviceId: result.calledToken?.serviceId,
      tokenCode: result.calledToken?.tokenCode,
      counterName: result.counter.name,
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Call next failed';
    const status = msg.includes('Forbidden') ? 403 : 400;
    res.status(status).json({ error: msg });
  }
});

app.post('/api/admin/organizations/:orgId/counters/:counterId/finish', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  const counterId = Number(req.params.counterId);
  const outcome = req.body?.outcome === 'no_show' ? 'no_show' : 'completed';
  if (!Number.isInteger(orgId) || !Number.isInteger(counterId)) {
    res.status(400).json({ error: 'Invalid identifiers.' });
    return;
  }
  try {
    const result = await finishCounterToken(
      orgId,
      counterId,
      outcome,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    broadcastQueueEvent({
      type: 'queue:updated',
      organizationId: orgId,
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Operation failed';
    const status = msg.includes('Forbidden') ? 403 : 400;
    res.status(status).json({ error: msg });
  }
});

app.patch('/api/admin/organizations/:orgId/counters/:counterId/status', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  const counterId = Number(req.params.counterId);
  const status = req.body?.status === 'paused' ? 'paused' : 'active';
  try {
    const counter = await toggleCounterStatus(
      orgId,
      counterId,
      status,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    broadcastQueueEvent({
      type: 'queue:updated',
      organizationId: orgId,
      timestamp: new Date().toISOString(),
    });
    res.json({ counter });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Operation failed';
    res.status(msg.includes('Forbidden') ? 403 : 400).json({ error: msg });
  }
});

app.post('/api/admin/organizations/:orgId/services', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid service fields.' });
    return;
  }
  try {
    const service = await createService(
      orgId,
      parsed.data,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    broadcastQueueEvent({
      type: 'queue:updated',
      organizationId: orgId,
      timestamp: new Date().toISOString(),
    });
    res.status(201).json({ service });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Operation failed';
    res.status(msg.includes('Forbidden') ? 403 : 400).json({ error: msg });
  }
});

app.patch('/api/admin/organizations/:orgId/services/:serviceId/open', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  const serviceId = Number(req.params.serviceId);
  const isOpen = Boolean(req.body?.isOpen);
  try {
    const service = await toggleServiceOpen(
      orgId,
      serviceId,
      isOpen,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    broadcastQueueEvent({
      type: 'queue:updated',
      organizationId: orgId,
      serviceId,
      timestamp: new Date().toISOString(),
    });
    res.json({ service });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Operation failed';
    res.status(msg.includes('Forbidden') ? 403 : 400).json({ error: msg });
  }
});

app.post('/api/admin/organizations/:orgId/counters', requireAuth, async (req: AuthRequest, res) => {
  const orgId = Number(req.params.orgId);
  const parsed = createCounterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid counter fields.' });
    return;
  }
  try {
    const counter = await createCounter(
      orgId,
      parsed.data,
      req.user!.uid,
      req.dbUser?.role || 'customer'
    );
    broadcastQueueEvent({
      type: 'queue:updated',
      organizationId: orgId,
      timestamp: new Date().toISOString(),
    });
    res.status(201).json({ counter });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Operation failed';
    res.status(msg.includes('Forbidden') ? 403 : 400).json({ error: msg });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`QueueLess server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
