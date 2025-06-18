import { Context } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
// HTTPException might not be needed if we don't throw specific errors for logout failures, 
// but can be kept for consistency or future use.

export const logoutHandler = async (c: Context) => {
  console.log('Logout attempt');

  const sessionToken = getCookie(c, 'session_token');

  if (sessionToken) {
    try {
      const db = c.env.DB as D1Database; // Ensure DB is correctly typed in your Env
      const stmt = db.prepare('DELETE FROM user_sessions WHERE session_token = ?');
      await stmt.bind(sessionToken).run();
      console.log(`Session invalidated for token: ${sessionToken.substring(0, 8)}...`);
    } catch (dbError: any) {
      console.error("Error deleting session from DB:", dbError.message);
      // Non-critical for client, proceed to delete cookie
    }
  } else {
    console.log('No session token found in cookies.');
  }

  deleteCookie(c, 'session_token', { path: '/' });
  console.log('Session cookie deleted.');

  return c.json({ success: true, message: 'Logged out successfully.' as const }, 200);
};
