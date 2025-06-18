// src/index.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';

// Import routes
import authRoutes from './routes/auth';
import websiteRoutes from './routes/websites';
import postRoutes from './routes/posts';
import userRoutes from './routes/users';
import roleRoutes from './routes/roles';
import seriesRoutes from './routes/series';
import storageRoutes from './routes/storage';
import heavyComputeApiRoutes from './routes/heavyComputeApi';

// Import middleware
import { ensureAuth } from './middlewares/auth.middleware';

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
const authMiddleware = ensureAuth(); // ensure authMiddleware is defined before use

// CORS Middleware
app.use('*', (c, next) => {
  const middleware = cors({
    origin: (origin) => {
      const allowedDevelopmentOrigin = 'http://localhost:8081';
      const allowedProductionOrigin = 'https://dash.xeopub.com';

      if (c.env.ENVIRONMENT === 'production') {
        return origin === allowedProductionOrigin ? origin : null;
      }
      // Allow requests from localhost for development, and also allow requests with no origin (e.g. curl, Postman)
      return origin === allowedDevelopmentOrigin || !origin ? origin || allowedDevelopmentOrigin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Requested-With', 'Cookie', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  });
  return middleware(c, next);
});

// Public routes first
app.route('/auth', authRoutes);

// Apply auth middleware to protected route paths
app.use('/websites/*', authMiddleware);
app.use('/posts/*', authMiddleware);
app.use('/users/*', authMiddleware);
app.use('/roles/*', authMiddleware);
app.use('/series/*', authMiddleware);
app.use('/storage/*', authMiddleware);
app.use('/heavy-compute-api/*', authMiddleware);

// Mount protected routes
app.route('/websites', websiteRoutes);
app.route('/posts', postRoutes);
app.route('/users', userRoutes);
app.route('/roles', roleRoutes);
app.route('/series', seriesRoutes);
app.route('/storage', storageRoutes);
app.route('/heavy-compute-api', heavyComputeApiRoutes);

// OpenAPI Documentation
app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    version: '1.0.1',
    title: 'XeoPub Admin API',
    description: 'API for managing XeoPub post content and users.',
  },
  servers: [
    {
      url: 'http://localhost:8788', // Adjust if your local dev server is different
      description: 'Local development server'
    },
    // Add production server URL here when available
  ]
});

// A simple root message
app.get('/', (c) => c.text('XeoPub Admin API Worker is running. Visit /doc/ui for documentation.'));

// Swagger UI
app.get('/doc/ui', swaggerUI({ url: '/doc' }));

export default app;

