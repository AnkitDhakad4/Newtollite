const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

router.get('/', teamController.getTeams);
router.get('/:id', teamController.getTeamById);

module.exports = router;

