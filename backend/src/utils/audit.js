const pool = require('../config/database');

async function auditLog({ userId, action, entityType, entityId, oldValue, newValue, ipAddress }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        action,
        entityType || null,
        entityId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress || null
      ]
    );
  } catch (err) {
    // Audit logging should never crash the app
    console.error('Audit log error:', err.message);
  }
}

module.exports = { auditLog };
