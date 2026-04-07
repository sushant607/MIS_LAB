const jwt = require('jsonwebtoken');

module.exports = function authenticate(req, res, next) {
  try {
    const bearer = req.header('Authorization');
    const fromBearer = bearer && bearer.startsWith('Bearer ') ? bearer.split(' ')[1] : null;
    const token = fromBearer || req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_placeholder');

    if (!decoded || !decoded.user || !decoded.user.id) {
      return res.status(401).json({ msg: 'Invalid token structure' });
    }

    // console.log(decoded);
    req.user = {
      id: decoded.user.id,
      name: decoded.user.name || null,
      email: decoded.user.email || null,
      role: decoded.user.role || 'employee',
      department: decoded.user.department || null,
    };

    // Convenience for routes that look at req.body.userId (create ticket, etc.)
    req.body = req.body || {};
    req.body.userId = decoded.user.id;

    return next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};
