require('dotenv').config();
const axios = require('axios');

console.log('\n====== DIAGNOSTIC CHECK ======\n');

// 1. Check env var
const geminiKey = process.env.GEMINI_API_KEY;
console.log('✓ GEMINI_API_KEY loaded:', geminiKey ? '✅ YES' : '❌ NO');
if (geminiKey) {
  console.log('  Preview:', geminiKey.substring(0, 10) + '...' + geminiKey.substring(geminiKey.length - 5));
}

// 2. Check if it's valid format
if (geminiKey && !geminiKey.startsWith('AIza')) {
  console.log('⚠️  WARNING: Key doesn\'t start with "AIza" - might be invalid');
}

// 3. Test a simple request
(async () => {
  if (!geminiKey) {
    console.log('\n❌ GEMINI_API_KEY is not set. Cannot test API.');
    return;
  }

  console.log('\nTesting Gemini API...');
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        contents: [{
          role: 'user',
          parts: [{ text: 'Hello' }]
        }]
      },
      { timeout: 10000 }
    );
    console.log('✅ API Test PASSED - Response status:', response.status);
    console.log('   Response has candidates:', !!response.data.candidates);
  } catch (error) {
    console.log('❌ API Test FAILED');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', error.response.data?.error?.message || JSON.stringify(error.response.data));
      
      if (error.response.status === 401) {
        console.log('\n🔑 401 = Invalid API Key');
        console.log('   → Get a new key from: https://makersuite.google.com/app/apikey');
      } else if (error.response.status === 403) {
        console.log('\n🔒 403 = Forbidden');
        console.log('   → API might not be enabled for this project');
      } else if (error.response.status === 429) {
        console.log('\n⏱️  429 = Rate limited');
        console.log('   → Wait a minute and try again');
      }
    } else {
      console.log('   Network error:', error.message);
    }
  }
})();
