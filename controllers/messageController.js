const Message = require('../models/Message');

/**
 * GET /messages/:conversationId
 * query: ?limit=50
 */
async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit || '100', 10);
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    res.json({ ok: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}

module.exports = { getMessages };