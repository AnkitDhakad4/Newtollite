const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/me', authController.getMe);
router.get('/users', authController.getAllUsers);

module.exports = router;

