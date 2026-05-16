const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireClient(req, res, next) {
  if (req.user?.role !== 'client' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// Ensure client users can only access their own data
function requireClientOwnership(req, res, next) {
  if (req.user?.role === 'admin') return next();
  
  const requestedClientId = req.params.clientId || req.body.clientId;
  if (req.user?.clientId !== requestedClientId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, requireClient, requireClientOwnership };
