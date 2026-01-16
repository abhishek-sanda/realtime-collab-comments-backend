const mongoose = require('mongoose');


const StatusSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });


const MessageSchema = new mongoose.Schema({
  conversationId: { type: String, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  senderName: { type: String, required: false },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  tags: [String], // auto-tags from AI (e.g., "billing", "abusive", "feature-request")
  priority: { type: String, enum: ['low','normal','high'], default: 'normal' },
  moderated: { type: Boolean, default: false },
  moderation: { type: Object, default: null } // store moderation details
});

module.exports = mongoose.model('Message', MessageSchema);