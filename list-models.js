require('dotenv').config();
const axios = require('axios');

const geminiKey = process.env.GEMINI_API_KEY;

(async () => {
  if (!geminiKey) {
    console.log('❌ GEMINI_API_KEY not set');
    return;
  }

  console.log('Checking available Gemini models...\n');
  
  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
    );
    
    const models = response.data.models || [];
    console.log(`Found ${models.length} available models:\n`);
    
    models.forEach(model => {
      const name = model.name.split('/').pop(); // Get just the model name
      const methods = model.supportedGenerationMethods || [];
      const hasGenerateContent = methods.includes('generateContent');
      const status = hasGenerateContent ? '✅' : '❌';
      console.log(`${status} ${name}`);
      if (hasGenerateContent) {
        console.log(`   └─ generateContent: supported`);
      }
    });
  } catch (error) {
    console.log('❌ Failed to list models');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data?.error?.message || error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
})();
