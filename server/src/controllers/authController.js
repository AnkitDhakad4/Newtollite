const User = require('../models/User');

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id).populate('teams.teamId', 'name slug');
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function getAllUsers(req, res, next) {
  try {
    const users = await User.find({ isActive: true }).populate('teams.teamId', 'name slug');
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  getAllUsers
};

