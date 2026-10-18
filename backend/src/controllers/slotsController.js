const slotModel = require('../models/slotModel');
async function listSlots(_req, res, next) {
  try { res.json(await slotModel.findAll()); } catch (err) { next(err); }
}
module.exports = { listSlots };
