const Team = require('../models/Team');

async function getTeams(req, res, next) {
  try {
    const teams = await Team.find().populate('leadUserId', 'name email');
    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
}

async function getTeamById(req, res, next) {
  try {
    const team = await Team.findById(req.params.id).populate('leadUserId', 'name email');
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    res.json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTeams,
  getTeamById
};

