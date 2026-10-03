const mongoose = require('mongoose');
const User = require('../models/User');

async function authenticate(req, res, next) {
  try {
    // 1. Check for explicit user ID passed via header (allows multi-actor concurrent testing in UI)
    const headerUserId = req.headers['x-user-id'];
    let user = null;

    if (headerUserId && mongoose.Types.ObjectId.isValid(headerUserId)) {
      user = await User.findById(headerUserId);
    }

    // 2. If no valid user header provided, fallback to first active user in system
    if (!user) {
      user = await User.findOne({ isActive: true }).sort({ createdAt: 1 });
    }

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: No active user found. Please seed the database.' 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Resource-level authorization: ensure user has required team role or is global admin
function requireTeamRole(allowedRoles = ['MEMBER', 'TEAM_LEAD', 'ADMIN']) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Global Admin bypasses team-level checks
    if (user.globalRole === 'ADMIN') {
      return next();
    }

    const teamId = req.params.teamId || req.body.teamId;
    if (!teamId) {
      return next(); // Checked in controller if dynamic
    }

    const membership = user.teams.find(t => t.teamId.toString() === teamId.toString());
    if (!membership || !allowedRoles.includes(membership.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Action requires one of [${allowedRoles.join(', ')}] in this team.`
      });
    }

    next();
  };
}

module.exports = { authenticate, requireTeamRole };

