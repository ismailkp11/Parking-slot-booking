const express = require('express');
const { getDailyAvailability, getSlotAvailability } = require('../controllers/availabilityController');
const router = express.Router();
router.get('/', getDailyAvailability);
router.get('/:slotId', getSlotAvailability);
module.exports = router;
