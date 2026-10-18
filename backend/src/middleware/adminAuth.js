const crypto = require('crypto');
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-this-secret').update(body).digest('base64url');
  return `${body}.${signature}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-this-secret').update(body).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch (_) { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try { const payload = JSON.parse(Buffer.from(body, 'base64url').toString()); return payload.exp > Date.now() ? payload : null; } catch (_) { return null; }
}
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = verify(token);
  if (!session) return res.status(401).json({ error: 'Admin session is missing or expired. Please sign in again.' });
  req.admin = session;
  next();
}
module.exports = { sign, requireAdmin };
