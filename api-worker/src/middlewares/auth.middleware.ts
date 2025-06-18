// /Users/fabian/Documents/CodeProjects/github.com/xeocast/xeocast-admin-workers/api-worker/src/middlewares/auth.middleware.ts
import { MiddlewareHandler, Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

// This assumes CloudflareBindings is globally available or correctly inferred by Hono.
// If not, you might need to import it or define a local Env type:
// import type { CloudflareBindings } from '../env'; 

interface UserSession {
  user_id: number;
  expires_at: string;
}

export const ensureAuth = (): MiddlewareHandler<{ Bindings: CloudflareBindings }> => {
  return async (c: Context<{ Bindings: CloudflareBindings }>, next: Next) => {
    const sessionToken = getCookie(c, 'session_token');

    if (!sessionToken) {
      throw new HTTPException(401, { message: 'Unauthorized: Missing session token.' });
    }

    const db = c.env.DB;

    try {
      const sessionStmt = db.prepare('SELECT user_id, expires_at FROM user_sessions WHERE session_token = ?');
      const sessionResult = await sessionStmt.bind(sessionToken).first<UserSession>();

      if (!sessionResult) {
        // To prevent token scanning, it's good practice to also delete an invalid token if found, 
        // though this depends on whether tokens could be guessed or are always long and random.
        // For now, just denying access is sufficient.
        throw new HTTPException(401, { message: 'Unauthorized: Invalid session token.' });
      }

      const now = new Date();
      const expiresAt = new Date(sessionResult.expires_at);

      if (expiresAt < now) {
        // Optional: Delete expired session from DB to keep the table clean.
        // const deleteStmt = db.prepare('DELETE FROM user_sessions WHERE session_token = ?');
        // await deleteStmt.bind(sessionToken).run();
        throw new HTTPException(401, { message: 'Unauthorized: Session expired.' });
      }

      // Session is valid. You can set user information in the context if needed by other handlers.
      // For example: c.set('userId', sessionResult.user_id);

      await next();
    } catch (error: any) {
      console.error('Authentication middleware error:', error.message, error.stack);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { message: 'Internal server error during authentication.' });
    }
  };
};
