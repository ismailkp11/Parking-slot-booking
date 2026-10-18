const express = require('express');
const { listSlots } = require('../controllers/slotsController');
const router = express.Router();
router.get('/', listSlots);
module.exports = router;
