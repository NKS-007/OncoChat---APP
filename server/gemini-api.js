const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// EXPANDED Hardcoded responses for common queries
const hardcodedResponses = {
  'hi': "Hello! 👋 I'm OncoChat AI, your compassionate cancer care companion. I'm here to provide support, answer your questions, and help you navigate your cancer journey. How can I assist you today?",
  
  'hello': "Hello! 👋 I'm OncoChat AI, your compassionate cancer care companion. I'm here to provide support, answer your questions, and help you navigate your cancer journey. How can I assist you today?",
  
  'hey': "Hey there! 👋 I'm OncoChat AI, your compassionate cancer care companion. I'm here to provide support, answer your questions, and help you navigate your cancer journey. How can I assist you today?",
  
  'how do i talk to my family about my diagnosis': "Talking to your family about a cancer diagnosis can feel overwhelming. 💜 Here are some compassionate ways to approach this conversation:\n\n• Choose a quiet, comfortable setting where everyone can sit down without distractions\n• Be honest and clear about what you know - it's okay to say 'I don't know yet' about some things\n• Allow space for emotions - everyone processes news differently\n• Share your needs and how they can support you\n• Remember you don't have to be strong all the time - it's okay to be vulnerable with loved ones\n\nWould you like more specific guidance on any aspect of this conversation?",
  
  'what are best practices for rest during treatment': "Rest is crucial during cancer treatment! 😴 Here are evidence-based practices:\n\n• Listen to your body - fatigue is real and valid\n• Maintain a consistent sleep schedule (7-9 hours)\n• Create a restful environment (cool, dark, quiet)\n• Balance rest with gentle activity like short walks\n• Try relaxation techniques: deep breathing, meditation\n• Remember: Rest is not laziness - it's healing! 💜",
  
  'how can i manage treatment side effects': "Managing side effects is so important! 💊 Here are key strategies:\n\n🤢 Nausea: Small frequent meals, ginger tea, anti-nausea meds\n😴 Fatigue: Balance rest with light activity, prioritize important tasks\n🍽️ Appetite: Eat small nutrient-dense meals, stay hydrated\n🦷 Mouth sores: Salt water rinses, soft foods, gentle brushing\n\nAlways discuss severe symptoms with your care team immediately!",
  
  'what foods should i eat during treatment': "Nutrition during treatment is vital! 🥗 Focus on:\n\n💪 Protein: Lean meats, eggs, Greek yogurt, beans for healing\n🌈 Fruits & Veggies: Berries, leafy greens, colorful vegetables for nutrients\n🌾 Whole Grains: Brown rice, oatmeal, whole wheat for energy\n💧 Hydration: 8-10 glasses of water, broths, herbal teas\n\nEat small frequent meals and work with a dietitian for personalized advice!",
  
  'what can you do': "I'm here to support you in many ways! 💜\n\n✅ Answer questions about cancer types and stages\n✅ Explain treatment options (chemo, radiation, immunotherapy)\n✅ Provide nutrition and lifestyle tips\n✅ Help manage treatment side effects\n✅ Offer emotional support and guidance\n✅ Explain medical terms in simple language\n✅ Support caregivers and family members\n\nFeel free to ask me anything related to cancer care!",
  
  'what are you': "I'm OncoChat AI, an AI-powered cancer care assistant designed to provide emotional support and reliable information. I can help you with understanding cancer symptoms, treatments, managing side effects, nutrition guidance, and emotional support for patients and caregivers.\n\nRemember - I'm not a replacement for professional medical advice. Always consult with your healthcare team for medical decisions."
};

function normalizeText(text) {
  return text.toLowerCase().trim().replace(/[?!.]/g, '');
}

function getHardcodedResponse(message) {
  const normalized = normalizeText(message);
  return hardcodedResponses[normalized] || null;
}

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('📨 Received message:', message);

    // Check for hardcoded response first
    const hardcoded = getHardcodedResponse(message);
    if (hardcoded) {
      console.log('✅ Using hardcoded response');
      return res.json({ reply: hardcoded });
    }

    // Try Gemini API if available
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ 
        reply: "I'm currently working with my basic knowledge base. For more specific questions, the AI integration is being set up. In the meantime, try asking about:\n\n• Talking to family about diagnosis\n• Rest during treatment\n• Managing side effects\n• Nutrition during treatment"
      });
    }

    // Try to use Gemini with fallback
    try {
      // We'll update this once we know the correct model name
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      const prompt = `As a cancer care assistant, provide a helpful response to: ${message}`;
      
      console.log('🤖 Calling Gemini API...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const reply = response.text();

      console.log('✅ Gemini response received!');
      return res.json({ reply });
      
    } catch (geminiError) {
      console.log('❌ Gemini failed, using fallback response');
      return res.json({ 
        reply: `I understand you're asking about "${message}". While I'm setting up my advanced AI capabilities, I can help with common cancer care topics like discussing diagnosis with family, rest during treatment, managing side effects, and nutrition. Could you try one of those topics, or use the quick prompts above? 💜`
      });
    }
    
  } catch (error) {
    console.error('❌ General error:', error.message);
    res.json({ 
      reply: "I'm having some technical difficulties right now. Please try one of the quick prompt buttons or ask about common cancer care topics like nutrition, rest, or talking with family."
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    gemini_configured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;