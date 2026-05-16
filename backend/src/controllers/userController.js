const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { auditLog } = require('../utils/audit');

async function createClientUser(req, res) {
  const { clientId, username } = req.body;

  if (!clientId || !username) {
    return res.status(400).json({ error: 'clientId and username required' });
  }

  try {
    // Verify client exists and is active
    const clientCheck = await pool.query(
      'SELECT id, organization_name FROM clients WHERE id = $1 AND status = $2',
      [clientId, 'active']
    );
    if (!clientCheck.rows[0]) {
      return res.status(404).json({ error: 'Active client not found' });
    }

    // Check username uniqueness
    const usernameCheck = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );
    if (usernameCheck.rows[0]) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Create with placeholder password - will be set via one-time link
    const placeholderHash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, client_id, is_active)
       VALUES ($1, $2, 'client', $3, false)
       RETURNING id, username`,
      [username.toLowerCase().trim(), placeholderHash, clientId]
    );

    const newUser = result.rows[0];

    await auditLog({
      userId: req.user.userId,
      action: 'CLIENT_USER_CREATED',
      entityType: 'user',
      entityId: newUser.id,
      newValue: { username: newUser.username, clientId },
      ipAddress: req.ip
    });

    return res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      clientId,
      message: 'User created. Generate a one-time activation link to send credentials.'
    });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getClientUsers(req, res) {
  const { clientId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, username, is_active, last_login, created_at
       FROM users WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deactivateUser(req, res) {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 AND role = $2 RETURNING id, username',
      [userId, 'client']
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Client user not found' });
    }

    await auditLog({
      userId: req.user.userId,
      action: 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip
    });

    return res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    console.error('Deactivate user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteUser(req, res) {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id, username',
      [userId, 'client']
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Client user not found' });
    }

    await auditLog({
      userId: req.user.userId,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip
    });

    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createClientUser, getClientUsers, deactivateUser, deleteUser };
