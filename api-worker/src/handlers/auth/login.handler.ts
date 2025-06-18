import { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs'; // For password hashing, as in old code
// crypto.randomUUID() will be used for session tokens, no specific import needed.
import { LoginRequestSchema } from '../../schemas/authSchemas';

// Define types for DB results
interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
}

interface RoleRecord {
  role: string;
}

export const loginHandler = async (c: Context) => {
  const body = await c.req.json().catch(() => {
    console.error('Login error: Malformed JSON payload or no payload.');
    return null;
  });

  const validationResult = LoginRequestSchema.safeParse(body);

  if (!validationResult.success) {
    console.error('Login validation error:', validationResult.error.flatten());
    // Corresponds to LoginMissingFieldsErrorSchema
    return c.json({ success: false, error: 'missing' as const, message: 'Email and password are required.' as const }, 400);
  }

  const { email, password } = validationResult.data;
  const db = c.env.DB as D1Database;
  const environment = (c.env.ENVIRONMENT as string) || 'development';

  try {
    // Step 1: Fetch user by email
    const userStmt = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?');
    const userResult = await userStmt.bind(email).first<UserRecord>();

    if (!userResult) {
      console.error(`User not found for email: ${email}`);
      // Corresponds to LoginUserNotFoundErrorSchema
      return c.json({ success: false, error: 'invalid' as const, message: 'Invalid user or password.' as const }, 401);
    }

    // Step 2: Verify password
    const validPassword = await bcrypt.compare(password, userResult.password_hash);
    if (!validPassword) {
      console.error(`Password validation failed for user: ${userResult.email}`);
      // Corresponds to LoginInvalidPasswordErrorSchema
      return c.json({ success: false, error: 'invalid' as const, message: 'Invalid user or password.' as const }, 401);
    }

    // Step 3: Fetch user role
    const roleStmt = db.prepare('SELECT r.name as role FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?');
    const roleResult = await roleStmt.bind(userResult.id).first<RoleRecord>();

    if (!roleResult || !roleResult.role) {
      console.error(`Role not found for user ID: ${userResult.id}`);
      // Corresponds to LoginRoleConfigErrorSchema (mapped to 401 in auth.ts for login route)
      return c.json({ success: false, error: 'authentication_failed' as const, message: 'User role configuration error.' as const }, 401);
    }

    // Step 4: Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 1000); // 1 day

    const sessionStmt = db.prepare('INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)');
    await sessionStmt.bind(userResult.id, sessionToken, expiresAt.toISOString()).run();

    // Set session token in cookie
    setCookie(c, 'session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'None',
      secure: true, // Always true for SameSite=None
      domain: environment === 'production' ? '.xeocast.com' : undefined, // Set domain for production
      maxAge: 60 * 60 * 24, // 1 day in seconds
    });

    // Corresponds to LoginSuccessResponseSchema
    return c.json({ success: true }, 200);

  } catch (e: any) {
    console.error("Error during login process:", e);
    // Corresponds to LoginInternalErrorSchema
    return c.json({ success: false, error: 'authentication_failed' as const, message: 'An internal error occurred during login.' as const }, 500);
  }
};
