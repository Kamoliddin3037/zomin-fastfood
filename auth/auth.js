const crypto = require('crypto');
const dbService = require('../db/database.js');

const JWT_SECRET = process.env.JWT_SECRET || 'zomin_fastfood_jwt_secret_key_2026_super_safe';

// Simple and robust zero-dependency JWT implementation using Node crypto
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function signToken(payload, expiresInSeconds = 7 * 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Middleware to extract user from Authorization header or cookie
function authMiddleware(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)zomin_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
}

// Guard middleware requiring authenticated user
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan. Iltimos, tizimga kiring.' });
  }
  next();
}

// Guard middleware checking specific roles (e.g. ['admin'], ['admin', 'cook'], etc.)
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Ruxsat yo'q. Ushbu sahifa yoki amal faqat quyidagi rollar uchun: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  signToken,
  verifyToken,
  authMiddleware,
  requireAuth,
  requireRole
};
