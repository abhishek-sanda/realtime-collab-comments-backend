const express = require('express');
const router = express.Router();
const Document = require('../models/Document'); // Assuming you move model to separate folder too

// Get the document
router.get('/document', async (req, res) => {
  try {
    const doc = await Document.findOne({});
    res.json(doc);
  } catch (err) {
    console.error('Failed to fetch document:', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Update the document
router.put('/document', async (req, res) => {
  try {
    const { content } = req.body;
    const updatedDoc = await Document.findOneAndUpdate({}, { content }, { upsert: true, new: true });
    res.json(updatedDoc);
  } catch (err) {
    console.error('Failed to update document:', err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

module.exports = router;
