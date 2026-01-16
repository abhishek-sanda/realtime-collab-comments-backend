const express = require('express');
const router = express.Router();
const ai = require('../controllers/aiController');
const Message = require('../models/Message');

/**
 * Test endpoint to check if Gemini API is working
 * GET /ai/health
 */
router.get('/health', (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const isConfigured = !!geminiKey;
  const keyPreview = isConfigured ? `${geminiKey.substring(0, 10)}...${geminiKey.substring(geminiKey.length - 5)}` : 'NOT SET';
  
  res.json({
    ok: true,
    geminiConfigured: isConfigured,
    geminiKeyPreview: keyPreview,
    nodeEnv: process.env.NODE_ENV
  });
});

/**
 * POST /ai/smart-replies
 * body: { conversation: [{role, content}, ...] or [{text, user}, ...] }
 */
router.post('/smart-replies', async (req, res) => {
  try {
    let conv = req.body.conversation || [];
    
    console.log('📨 Smart replies request received with conversation length:', conv.length);
    
    if (!Array.isArray(conv) || conv.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Conversation must be a non-empty array' 
      });
    }

    // Normalize conversation data structure
    conv = conv.map(msg => ({
      content: msg.content || msg.text || '',
      user: msg.user || msg.sender || 'User',
      timestamp: msg.timestamp,
      role: msg.role || 'user'
    })).filter(msg => msg.content.trim().length > 0);

    if (conv.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No valid conversation content after normalization' 
      });
    }
    
    const replies = await ai.getSmartReplies(conv);
    console.log('✅ Smart replies generated:', replies.length);
    res.json({ ok: true, replies });
  } catch (err) {
    console.error('❌ Smart replies error:', err.message);
    console.error('   Stack:', err.stack);
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

/**
 * POST /ai/summarize
 * body: { conversation: [{sender, content, text, user}, ...] }
 */
router.post('/summarize', async (req, res) => {
  try {
    let conv = req.body.conversation || [];
    
    // Log what we receive
    console.log('📨 Summarize request received');
    console.log('   Conversation length:', conv.length);
    console.log('   Sample item:', JSON.stringify(conv[0], null, 2));
    
    if (!Array.isArray(conv) || conv.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Conversation must be a non-empty array' 
      });
    }

    // Normalize conversation data structure
    // Frontend might send: [{text, user}, ...] 
    // Backend expects: [{content, user}, ...]
    conv = conv.map(msg => ({
      content: msg.content || msg.text || '',
      user: msg.user || msg.sender || 'User',
      timestamp: msg.timestamp,
      role: msg.role || 'user'
    })).filter(msg => msg.content.trim().length > 0);

    console.log('   Normalized items:', conv.length);
    
    if (conv.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No valid conversation content after normalization' 
      });
    }

    const summary = await ai.summarizeConversation(conv);
    console.log('✅ Summary generated successfully');
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('❌ Summarize error:', err.message);
    console.error('   Stack:', err.stack);
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

/**
 * POST /ai/moderate
 * body: { messageId } or { content }
 */
router.post('/moderate', async (req, res) => {
  try {
    if (req.body.messageId) {
      const saved = await ai.moderateAndSaveMessage(req.body.messageId);
      return res.json({ ok: true, message: saved });
    }
    const content = req.body.content || '';
    const result = await ai.moderateAndTagMessage(content);
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

module.exports = router;