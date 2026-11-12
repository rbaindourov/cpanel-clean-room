/**
 * server.ts
 * Unified HTTP and WebSocket server initialization, global middleware stack,
 * route registration, and graceful lifecycle management.
 */

import http from 'node:http';
import path from 'node:path';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { AgentdClient } from './agentd-client.ts';
import type { DatabaseConnection } from './db/sqlite-adapter.ts';
import { PanelWebSocketManager } from './ws/index.ts';
import { createAuthMiddleware } from './middlewares/auth.ts';
import { createImpersonationMiddleware } from './middlewares/impersonation.ts';
import { createRateLimiter } from './middlewares/rate-limiter.ts';
import { createRequestLogger } from './middlewares/logger.ts';
import { createErrorHandler } from './middlewares/error-handler.ts';

// Route Modules
import { registerAuthRoutes } from './routes/auth.ts';
import { registerFilesRoutes } from './routes/files.ts';
import { registerDatabasesRoutes } from './routes/databases.ts';
import { registerDomainsRoutes } from './routes/domains.ts';
import { registerEmailRoutes } from './routes/email.ts';
import { registerMetricsRoutes } from './routes/metrics.ts';
import { registerSecurityRoutes } from './routes/security.ts';
import { registerSoftwareRoutes } from './routes/software.ts';
import { registerAdvancedRoutes } from './routes/advanced.ts';
import { registerPreferencesRoutes } from './routes/preferences.ts';
import { registerBackupRoutes } from './routes/backup.ts';
import { registerAdminRoutes } from './routes/admin.ts';

export interface ServerOptions {
  port?: number;
  host?: string;
  db: DatabaseConnection;
  agentd: AgentdClient;
  spaStaticDir?: string;
  jwtSecret?: string;
  ssoSecret?: string;
  sysrootPath?: string;
}

export interface AppServer {
  app: Express;
  httpServer: http.Server;
  wsManager: PanelWebSocketManager;
  start: () => Promise<{ port: number; host: string }>;
  stop: () => Promise<void>;
}

export function createServer(options: ServerOptions): AppServer {
  const app = express();
  const httpServer = http.createServer(app);
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
  const host = options.host || '0.0.0.0';

  // 1. Basic Security & Parsing Middlewares
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 2. CORS Headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Impersonate-User, X-Request-ID'
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // 3. Request Correlation ID & Logging
  app.use(createRequestLogger());

  // 4. Rate Limiting
  app.use(createRateLimiter());

  // 5. WebSocket Dispatcher
  const wsManager = new PanelWebSocketManager({
    jwtSecret: options.jwtSecret,
    sysrootPath: options.sysrootPath,
    db: options.db,
  });

  httpServer.on('upgrade', (req, socket, head) => {
    wsManager.handleUpgrade(req, socket as import('node:net').Socket, head);
  });

  // 6. Public / Unauthenticated Routes
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  const publicRouter = express.Router();
  publicRouter.use('/auth', registerAuthRoutes({ db: options.db, jwtSecret: options.jwtSecret }));
  app.use('/api/v1', publicRouter);

  // 7. Authenticated & Impersonation-aware API Routes (/api/v1/*)
  const authMiddleware = createAuthMiddleware({
    db: options.db,
    jwtSecret: options.jwtSecret,
  });
  const impersonationMiddleware = createImpersonationMiddleware({
    db: options.db,
  });

  const apiRouter = express.Router();
  apiRouter.use(authMiddleware);
  apiRouter.use(impersonationMiddleware);

  // Mount 9 cPanel Category Routers + Admin WHM Router
  apiRouter.use('/files', registerFilesRoutes({ db: options.db, agentd: options.agentd }));
  apiRouter.use('/databases', registerDatabasesRoutes({
    db: options.db,
    agentd: options.agentd,
    ssoSecret: options.ssoSecret,
    sysrootPath: options.sysrootPath,
  }));
  apiRouter.use('/domains', registerDomainsRoutes({ db: options.db, agentd: options.agentd }));
  apiRouter.use('/email', registerEmailRoutes({
    db: options.db,
    agentd: options.agentd,
    ssoSecret: options.ssoSecret,
  }));
  apiRouter.use('/metrics', registerMetricsRoutes({ db: options.db, sysrootPath: options.sysrootPath }));
  apiRouter.use('/security', registerSecurityRoutes({ db: options.db, agentd: options.agentd }));
  apiRouter.use('/software', registerSoftwareRoutes({ db: options.db, agentd: options.agentd }));
  apiRouter.use('/advanced', registerAdvancedRoutes({ db: options.db }));
  apiRouter.use('/preferences', registerPreferencesRoutes({ db: options.db, jwtSecret: options.jwtSecret }));
  apiRouter.use('/backup', registerBackupRoutes({ db: options.db, agentd: options.agentd }));
  apiRouter.use('/admin', registerAdminRoutes({ db: options.db, agentd: options.agentd }));

  app.use('/api/v1', apiRouter);

  // 7.5 API Catch-All 404 Handler (RFC 7807 JSON)
  // Ensures all unmatched /api and /api/* requests return structured JSON instead of falling through to HTML SPA fallback
  app.all(['/api', '/api/*'], (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Resource '${req.method} ${req.path}' not found`,
        status: 404,
        requestId: req.id,
      },
    });
  });

  // 8. Static SPA Serving & Fallback
  const staticDir = options.spaStaticDir || path.resolve('./packages/web/dist');
  app.use(express.static(staticDir));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (
      req.path === '/api' ||
      req.path.startsWith('/api/') ||
      req.path === '/ws' ||
      req.path.startsWith('/ws/') ||
      req.path.startsWith('/assets/')
    ) {
      next();
      return;
    }
    res.sendFile(path.join(staticDir, 'index.html'), (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Resource '${req.path}' not found`,
            status: 404,
            requestId: req.id,
          },
        });
      }
    });
  });

  // 9. Global Central Error Handler
  app.use(createErrorHandler());

  return {
    app,
    httpServer,
    wsManager,
    start: async () => {
      await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.removeListener('error', reject);
          resolve();
        });
      });
      const addr = httpServer.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      return { port: actualPort, host };
    },
    stop: async () => {
      wsManager.close();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
