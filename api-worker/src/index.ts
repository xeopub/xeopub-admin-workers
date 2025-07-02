// src/index.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';

// Import routes
import authRoutes from './routes/auth.routes';
import websiteRoutes from './routes/website.routes';
import postRoutes from './routes/post.routes';
import whatsNextRoutes from './routes/whats-next.routes';
import userRoutes from './routes/user.routes';
import roleRoutes from './routes/role.routes';
import seriesRoutes from './routes/serie.routes';
import storageRoutes from './routes/storage.routes';

// Import middleware
import { ensureAuth } from './middlewares/auth.middleware';

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
const authMiddleware = ensureAuth(); // ensure authMiddleware is defined before use

// CORS Middleware
app.use('*', (c, next) => {
  const middleware = cors({
    origin: (origin) => {
      const allowedDevelopmentOrigin = 'http://localhost:8080';
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
app.use('/whats-next/*', authMiddleware);
app.use('/storage/*', authMiddleware);

// Mount protected routes
app.route('/websites', websiteRoutes);
app.route('/posts', postRoutes);
app.route('/users', userRoutes);
app.route('/roles', roleRoutes);
app.route('/series', seriesRoutes);
app.route('/whats-next', whatsNextRoutes);
app.route('/storage', storageRoutes);

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
app.get('/', (c) => c.text('XeoPub Admin API Worker is running. Visit /api/ui for documentation.'));

// Swagger UI
app.get('/doc/ui', swaggerUI({ url: '/doc', title: 'XeoPub Dash API | Swagger UI' }));

export default app;

