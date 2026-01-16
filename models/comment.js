const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  documentId: String,
  user: String,
  text: String,
  range: {
    start: Number,
    end: Number
  },
  mentions: [{ username: String, userId: String }],
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  voters: [{ userId: String, vote: String }],
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', CommentSchema);
