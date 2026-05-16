const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const { auditLog } = require('../utils/audit');

const LOGIN_ATTEMPTS = new Map(); // Simple in-memory rate limiting per IP
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function login(req, res) {
  const { username, password } = req.body;
  const ip = req.ip;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check lockout
  const attempts = LOGIN_ATTEMPTS.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS && Date.now() - attempts.lastAttempt < LOCKOUT_DURATION) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, role, client_id, is_active FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      recordFailedAttempt(ip);
      await auditLog({ action: 'LOGIN_FAILED', ipAddress: ip, newValue: { username } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      recordFailedAttempt(ip);
      await auditLog({ userId: user.id, action: 'LOGIN_FAILED', ipAddress: ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Clear failed attempts on success
    LOGIN_ATTEMPTS.delete(ip);

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        clientId: user.client_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await auditLog({ userId: user.id, action: 'LOGIN_SUCCESS', ipAddress: ip });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        clientId: user.client_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function generateOneTimeLink(req, res) {
  const { clientId, userId } = req.body;

  if (!clientId || !userId) {
    return res.status(400).json({ error: 'clientId and userId required' });
  }

  try {
    // Verify client and user exist
    const clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND client_id = $2',
      [userId, clientId]
    );

    if (!clientCheck.rows[0] || !userCheck.rows[0]) {
      return res.status(404).json({ error: 'Client or user not found' });
    }

    // Invalidate any existing unused links for this user
    await pool.query(
      'UPDATE one_time_links SET used = true WHERE user_id = $1 AND used = false',
      [userId]
    );

    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    await pool.query(
      'INSERT INTO one_time_links (token, client_id, user_id, expires_at) VALUES ($1, $2, $3, $4)',
      [token, clientId, userId, expiresAt]
    );

    await auditLog({
      userId: req.user.userId,
      action: 'ONE_TIME_LINK_GENERATED',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip
    });

    const link = `${process.env.FRONTEND_URL}/activate?token=${token}`;
    return res.json({ link, expiresAt });
  } catch (err) {
    console.error('Generate link error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function activateAccount(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }

  try {
    const result = await pool.query(
      `SELECT otl.*, u.username FROM one_time_links otl
       JOIN users u ON u.id = otl.user_id
       WHERE otl.token = $1 AND otl.used = false AND otl.expires_at > NOW()`,
      [token]
    );

    const link = result.rows[0];
    if (!link) {
      return res.status(400).json({ error: 'Invalid or expired activation link' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password_hash = $1, is_active = true WHERE id = $2', [
      passwordHash,
      link.user_id
    ]);

    await pool.query('UPDATE one_time_links SET used = true WHERE id = $1', [link.id]);

    await auditLog({
      userId: link.user_id,
      action: 'ACCOUNT_ACTIVATED',
      entityType: 'user',
      entityId: link.user_id,
      ipAddress: req.ip
    });

    return res.json({ message: 'Account activated successfully' });
  } catch (err) {
    console.error('Activate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function recordFailedAttempt(ip) {
  const existing = LOGIN_ATTEMPTS.get(ip) || { count: 0, lastAttempt: 0 };
  LOGIN_ATTEMPTS.set(ip, {
    count: existing.count + 1,
    lastAttempt: Date.now()
  });
}

module.exports = { login, generateOneTimeLink, activateAccount };
