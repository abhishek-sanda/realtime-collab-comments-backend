const express = require('express');
const router = express.Router();
const controller = require('../controllers/messageController');

router.get('/:conversationId', controller.getMessages);

module.exports = router;