// src/handlers/auth/session.handler.ts
import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

// Define types for DB results
interface UserSessionRecord {
  user_id: number;
  expires_at: string;
}

interface UserRecord {
  id: number;
  email: string;
  name: string | null;
}

interface RoleRecord {
  role_name: string;
}

export const getSessionHandler = async (c: Context) => {
  const sessionToken = getCookie(c, 'session_token');

  if (!sessionToken) {
    return c.json({ isActive: false }, 200);
  }

  const db = c.env.DB as D1Database;

  try {
    // Step 1: Validate session token and check expiry
    const sessionStmt = db.prepare(
      'SELECT user_id, expires_at FROM user_sessions WHERE session_token = ?'
    );
    const sessionResult = await sessionStmt.bind(sessionToken).first<UserSessionRecord>();

    if (!sessionResult) {
      return c.json({ isActive: false }, 200); // Token not found
    }

    const expiresAt = new Date(sessionResult.expires_at);
    if (expiresAt < new Date()) {
      // Optionally, delete expired session from DB
      // const deleteStmt = db.prepare('DELETE FROM user_sessions WHERE session_token = ?');
      // await deleteStmt.bind(sessionToken).run();
      return c.json({ isActive: false }, 200); // Session expired
    }

    // Step 2: Fetch user details
    const userStmt = db.prepare(
      'SELECT id, email, name FROM users WHERE id = ?'
    );
    const userResult = await userStmt.bind(sessionResult.user_id).first<UserRecord>();

    if (!userResult) {
      // This case should ideally not happen if session exists and user_id is valid
      console.error(`User not found for user_id: ${sessionResult.user_id} from a valid session.`);
      throw new HTTPException(500, { message: 'User data inconsistency.' });
    }

    // Step 3: Fetch user role
    const roleStmt = db.prepare(
      'SELECT r.name as role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?'
    );
    const roleResult = await roleStmt.bind(userResult.id).first<RoleRecord>();

    if (!roleResult || !roleResult.role_name) {
      console.error(`Role not found for user ID: ${userResult.id}`);
      throw new HTTPException(500, { message: 'User role configuration error.' });
    }

    return c.json(
      {
        isActive: true,
        user: {
          id: userResult.id,
          email: userResult.email,
          name: userResult.name,
          role: roleResult.role_name,
        },
      },
      200
    );
  } catch (e: any) {
    console.error('Error during getSession process:', e);
    if (e instanceof HTTPException) {
      throw e;
    }
    throw new HTTPException(500, { message: 'An internal error occurred while fetching session status.' });
  }
};
