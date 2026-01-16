const { GoogleGenAI } = require("@google/genai");
const Message = require('../models/Message');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set — AI endpoints will fail until provided.');
}

// Initialize Google GenAI client
const client = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// HELPER: Detect topic from conversation content
function detectTopic(text) {
  const topicKeywords = {
    'bug': /bug|error|crash|broken|fail|issue|problem|not working/i,
    'feature': /feature|add|implement|new|enhancement|request/i,
    'question': /what|how|why|when|where|can|could|would/i,
    'decision': /decide|agree|should|must|require|mandate/i,
    'feedback': /feedback|opinion|thought|suggest|idea|input|review/i,
    'discussion': /discuss|talk|conversation|about|regarding/i,
    'urgent': /urgent|asap|critical|emergency|immediately|now/i,
  };
  
  for (const [topic, regex] of Object.entries(topicKeywords)) {
    if (regex.test(text)) return topic;
  }
  return 'general';
}

// HELPER: Detect sentiment
function detectSentiment(text) {
  const positive = /good|great|awesome|excellent|happy|love|perfect|amazing|thank|yes/i.test(text) ? 1 : 0;
  const negative = /bad|terrible|awful|hate|angry|disappointed|fail|error|problem|no/i.test(text) ? -1 : 0;
  const sentiment = positive + negative;
  if (sentiment > 0) return 'positive';
  if (sentiment < 0) return 'negative';
  return 'neutral';
}

// HELPER: Detect urgency
function detectUrgency(text) {
  if (/urgent|asap|critical|emergency|immediately|now|deadline|today/i.test(text)) return 'high';
  if (/soon|next week|coming|upcoming/i.test(text)) return 'medium';
  return 'low';
}

/**
 * Call Gemini API with proper error handling using @google/genai SDK
 */
async function callGemini(messages, options = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is empty or invalid');
  }

  // Build conversation history in correct format
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(msg.content || msg.text) }]
  }));

  const lastMessage = messages[messages.length - 1];
  const lastContent = String(lastMessage.content || lastMessage.text);

  try {
    console.log('🔄 Calling Gemini API with', messages.length, 'message(s)');
    console.log('   Last message:', lastContent.substring(0, 100) + '...');
    
    // Use the correct API: client.chats.create()
    const chat = client.chats.create({
      model: "gemini-2.5-flash",
      history: history
    });

    // Send the last message with correct format
    // sendMessage expects: { message: "text" } or just pass content directly
    const response = await chat.sendMessage({
      message: lastContent
    });
    
    console.log('✅ Gemini API response received');
    const responseText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || '';
    
    return {
      candidates: [{
        content: {
          parts: [{
            text: responseText
          }]
        }
      }]
    };
  } catch (error) {
    console.error('❌ Gemini API Error:', error.message);
    console.error('❌ Error details:', error);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

/**
 * Get 3-4 smart replies that are contextually aware of the conversation.
 * conversation: [{role: 'user'|'assistant', content, user?, timestamp?}]
 */
async function getSmartReplies(conversation = []) {
  // Validate conversation
  if (!Array.isArray(conversation)) {
    throw new Error('Conversation must be an array');
  }

  if (conversation.length === 0) {
    // Return default replies if no conversation
    return [
      { label: 'That sounds good!', tone: 'friendly' },
      { label: 'I agree.', tone: 'formal' },
      { label: 'Let me know.', tone: 'direct' }
    ];
  }

  // Build a rich conversation context with user names and content
  const conversationText = conversation
    .map((msg, idx) => {
      const sender = msg.user || (msg.role === 'assistant' ? 'Assistant' : 'User');
      const timestamp = msg.timestamp ? ` (${new Date(msg.timestamp).toLocaleTimeString()})` : '';
      return `${idx + 1}. ${sender}${timestamp}:\n   ${msg.content}`;
    })
    .join('\n\n');

  // Get the last message to understand what to reply to
  const lastMsg = conversation[conversation.length - 1];
  const lastSender = lastMsg.user || (lastMsg.role === 'assistant' ? 'Assistant' : 'User');

  // DYNAMIC: Analyze conversation to detect topic, sentiment, urgency
  const conversationLower = conversationText.toLowerCase();
  const sentiment = detectSentiment(conversationLower);
  const topic = detectTopic(conversationLower);
  const urgency = detectUrgency(conversationLower);
  const participants = [...new Set(conversation.map(m => m.user || (m.role === 'assistant' ? 'Assistant' : 'User')))];
  const msgCount = conversation.length;

  // DYNAMIC: Build a completely context-aware prompt (NOT static template)
  const contextDesc = `${topic} discussion (${msgCount} messages, ${sentiment} sentiment, ${urgency} urgency)`;
  
  const userPrompt = `You are helping reply to a ${contextDesc} with participants: ${participants.join(', ')}.

CONVERSATION:

${conversationText}

---

${lastSender} just said: "${lastMsg.content}"

Generate 3-4 smart, contextually appropriate replies that:
1. Directly respond to THIS specific ${topic} message
2. Match the ${sentiment} tone and ${urgency} urgency level
3. Show deep understanding (NOT generic "That sounds good" type replies)
4. Vary in perspective (address different aspects of the message)
5. Are specific to THIS discussion, NOT generic suggestions

Return ONLY valid JSON array, NO markdown or explanation:
[
  { "label": "specific reply text", "tone": "tone" },
  { "label": "different specific reply", "tone": "tone" },
  { "label": "another specific reply", "tone": "tone" }
]`;

  const prompt = [
    { role: 'user', content: userPrompt }
  ];

  const data = await callGemini(prompt, { max_tokens: 300 });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // try to parse JSON safely
  try {
    // Clean up the response (remove markdown code blocks if present)
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse smart replies JSON:', e.message, 'Response was:', text);
    // fallback: return heuristic split by newlines
    const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 4);
    return lines.map((l, i) => ({ label: l.trim(), tone: 'neutral', index: i }));
  }
}

/**
 * Summarize a conversation into a short summary with action items.
 * conversation: array of messages (ordered oldest -> newest)
 * FULLY DYNAMIC: Analysis adapts based on conversation content, length, and complexity
 */
async function summarizeConversation(conversation = []) {
  // Validate conversation
  if (!Array.isArray(conversation)) {
    throw new Error('Conversation must be an array');
  }

  if (conversation.length === 0) {
    return { summary: 'No conversation to summarize.', action_items: [] };
  }

  // Build rich conversation context
  const conversationText = conversation
    .map((msg, idx) => {
      const sender = msg.user || msg.sender || (msg.role === 'assistant' ? 'Assistant' : 'User');
      const timestamp = msg.timestamp ? ` (${new Date(msg.timestamp).toLocaleTimeString()})` : '';
      return `${idx + 1}. ${sender}${timestamp}:\n   ${msg.content}`;
    })
    .join('\n\n');

  // DYNAMIC: Analyze conversation structure and content
  const conversationLower = conversationText.toLowerCase();
  const msgCount = conversation.length;
  const topic = detectTopic(conversationLower);
  const sentiment = detectSentiment(conversationLower);
  const hasDeadlines = /deadline|by|due|date|when|time/.test(conversationLower);
  const hasDecisions = /decide|agree|decided|agreed|agreed to|will/.test(conversationLower);
  const hasQuestions = conversation.some(msg => msg.content.includes('?'));
  const participants = [...new Set(conversation.map(m => m.user || (m.role === 'assistant' ? 'Assistant' : 'User')))];
  
  // DYNAMIC: Create context-aware prompt
  const focusAreas = [];
  if (hasDecisions) focusAreas.push('decisions and agreements');
  if (hasDeadlines) focusAreas.push('deadlines and timelines');
  if (hasQuestions) focusAreas.push('unanswered questions');
  
  const userPrompt = `Summarize this ${topic} discussion (${msgCount} messages, ${sentiment} sentiment) between ${participants.join(', ')}:

${conversationText}

---

Extract SPECIFIC information from THIS conversation:
1. Summary of THIS exact ${topic} discussion (what was specifically discussed)
2. Key points ACTUALLY mentioned (not generic suggestions)
3. Action items that were mentioned or implied in THIS conversation
4. Decisions/agreements that were made
${focusAreas.length > 0 ? `5. Focus on: ${focusAreas.join(', ')}` : ''}

Return ONLY valid JSON (no markdown or code blocks):
{
  "summary": "Specific summary of THIS discussion",
  "key_points": ["point1", "point2", "point3"],
  "action_items": ["specific action1", "specific action2"],
  "decisions": ["specific decision1", "specific decision2"]
}`;

  const prompt = [
    { role: 'user', content: userPrompt }
  ];

  const data = await callGemini(prompt, { max_tokens: 300 });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('Failed to parse summary JSON:', e.message, 'Response was:', text);
    return { summary: text.slice(0, 800), action_items: [] };
  }
}

/**
 * Basic moderation + auto-tagging + priority routing.
 * Uses the model to classify message, returns tags and priority.
 * FULLY DYNAMIC: Moderation based on specific message content
 */
async function moderateAndTagMessage(messageText) {
  if (!messageText || typeof messageText !== 'string') {
    throw new Error('Message text must be a non-empty string');
  }

  // DYNAMIC: Detect what type of message this is
  const msgLower = messageText.toLowerCase();
  const msgType = detectTopic(msgLower);
  const msgLength = messageText.length;
  const hasLinks = /http|www|\.com|\.org/.test(messageText);
  const hasNumbers = /\d+/.test(messageText);
  const hasCaps = /[A-Z]{3,}/.test(messageText); // Multiple caps

  // DYNAMIC: Build context-aware moderation prompt
  const userPrompt = `Classify this ${msgType} message (${msgLength} chars) for moderation:

"${messageText}"

Analyze for:
1. Appropriate tags (e.g., billing, bug, feature, spam, abusive, etc.)
2. Priority level based on content urgency
3. Recommended action (allow, flag for review, escalate)
4. Brief explanation

Return ONLY valid JSON (no markdown):
{
  "tags": ["specific-tag1", "specific-tag2"],
  "priority": "low|normal|high",
  "action": "allow|flag|escalate",
  "notes": "explanation"
}`;

  const prompt = [
    { role: 'user', content: userPrompt }
  ];

  const data = await callGemini(prompt, { max_tokens: 200 });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (e) {
    console.warn('Failed to parse moderation JSON, using fallback:', e.message);
    // fallback heuristic
    const lower = messageText.toLowerCase();
    const tags = [];
    if (lower.includes('refund') || lower.includes('charge')) tags.push('billing');
    if (lower.includes('error') || lower.includes('bug')) tags.push('bug');
    if (/(hate|kill|die|abuse)/.test(lower)) tags.push('abusive');
    const priority = tags.includes('abusive') ? 'high' : tags.includes('billing') ? 'high' : 'normal';
    const action = tags.includes('abusive') ? 'escalate' : 'allow';
    return { tags, priority, action, notes: 'heuristic fallback' };
  }
}

/**
 * Endpoint helpers that persist moderation result to Message document.
 */
async function moderateAndSaveMessage(messageId) {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error('Message not found');

  const result = await moderateAndTagMessage(msg.content);
  msg.moderated = true;
  msg.moderation = result;
  if (Array.isArray(result.tags)) msg.tags = Array.from(new Set([...(msg.tags||[]), ...result.tags]));
  if (result.priority) msg.priority = result.priority;
  await msg.save();
  return msg;
}

module.exports = {
  getSmartReplies,
  summarizeConversation,
  moderateAndTagMessage,
  moderateAndSaveMessage
};