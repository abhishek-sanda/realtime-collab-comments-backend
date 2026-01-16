const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  content: String,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', DocumentSchema);