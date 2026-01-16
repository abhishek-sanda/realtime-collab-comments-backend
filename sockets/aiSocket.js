// Attach AI socket handlers to existing io instance.
// Usage: const { attachAISockets } = require('./sockets/aiSocket'); attachAISockets(io);
const ai = require('../controllers/aiController');
const Message = require('../models/Message');

function attachAISockets(io) {
  io.on('connection', (socket) => {
    // Expect events: 'request-smart-replies', 'request-summary', 'submit-message'
    socket.on('request-smart-replies', async ({ conversation, correlationId }) => {
      try {
        const replies = await ai.getSmartReplies(conversation || []);
        socket.emit('smart-replies', { correlationId, replies });
      } catch (err) {
        socket.emit('smart-replies', { correlationId, replies: [], error: String(err) });
      }
    });

    socket.on('request-summary', async ({ conversation, correlationId }) => {
      try {
        const summary = await ai.summarizeConversation(conversation || []);
        socket.emit('conversation-summary', { correlationId, summary });
      } catch (err) {
        socket.emit('conversation-summary', { correlationId, error: String(err) });
      }
    });

    // New message arrives from a client; run moderation and broadcast routing decision
    socket.on('submit-message', async ({ conversationId, senderId, senderName, content }) => {
      try {
        const msg = await Message.create({ conversationId, senderId, senderName, content });
        // Run moderation / tagging async (don't block broadcasting)
        ai.moderateAndTagMessage(content)
          .then(result => {
            // update DB when ready
            msg.moderated = true;
            msg.moderation = result;
            if (result.tags) msg.tags = Array.from(new Set([...(msg.tags||[]), ...result.tags]));
            if (result.priority) msg.priority = result.priority;
            msg.save().catch(console.error);
            // inform moderators or routing channel if escalation
            if (result.action === 'escalate' || result.priority === 'high') {
              io.to('moderators').emit('escalation', { messageId: msg._id, result });
            }
          })
          .catch(e => console.error('Moderation error', e));

        // broadcast message to room participants immediately
        io.to(conversationId).emit('message', msg);
      } catch (err) {
        console.error(err);
        socket.emit('error', { error: 'Message failed' });
      }
    });
  });
}

module.exports = { attachAISockets };