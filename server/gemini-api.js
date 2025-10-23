const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Store conversation history per session (in memory for now, consider Redis/DB for production)
const conversationHistories = new Map();

// Cleanup old sessions every hour (to prevent memory leaks)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, data] of conversationHistories.entries()) {
    if (data.lastAccessed < oneHourAgo) {
      conversationHistories.delete(sessionId);
      console.log(`🗑️ Cleaned up old session: ${sessionId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Helper function to get/create session data
function getSessionData(sessionId) {
  if (!conversationHistories.has(sessionId)) {
    conversationHistories.set(sessionId, {
      history: [],
      lastAccessed: Date.now()
    });
  }
  const data = conversationHistories.get(sessionId);
  data.lastAccessed = Date.now(); // Update last access time
  return data;
}

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
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('📨 Received message:', message);
    console.log('🆔 Session ID:', sessionId);

    // Get or create conversation history for this session
    const sessionData = getSessionData(sessionId);
    const conversationHistory = sessionData.history;

    // Check for hardcoded response first (only for first message or simple greetings)
    if (conversationHistory.length === 0) {
      const hardcoded = getHardcodedResponse(message);
      if (hardcoded) {
        console.log('✅ Using hardcoded response');
        conversationHistory.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: hardcoded }] }
        );
        return res.json({ reply: hardcoded });
      }
    }

    // Try Gemini API if available
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ 
        reply: "I'm currently working with my basic knowledge base. For more specific questions, the AI integration is being set up. In the meantime, try asking about:\n\n• Talking to family about diagnosis\n• Rest during treatment\n• Managing side effects\n• Nutrition during treatment"
      });
    }

    // Try to use Gemini with multiple model fallbacks
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Trying model: ${modelName}...`);
        
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        });
        
        // Build the conversation with system instructions at the start
        let fullHistory = [];
        
        // If this is a new conversation, add system instructions
        if (conversationHistory.length === 0) {
          fullHistory = [
            {
              role: 'user',
              parts: [{ text: 'Please confirm you understand your role and limitations.' }]
            },
            {
              role: 'model',
              parts: [{ text: 'I understand. I am OncoChat AI, a specialized cancer care support assistant. I will ONLY discuss cancer and related health topics including: cancer types, stages, diagnosis, treatments (chemotherapy, radiation, immunotherapy, surgery, targeted therapy), side effects management, nutrition, lifestyle during treatment, mental health support for patients and caregivers, and medical terminology related to oncology.\n\nI will NOT discuss: non-cancer medical conditions (unless directly related to cancer care), non-medical topics (politics, entertainment, general conversation, poems, stories, etc.), financial or legal advice, or provide specific medical diagnoses.\n\nIf asked about non-cancer topics, I will politely redirect users back to cancer care topics. I will be professional, warm, empathetic, and use clear language while formatting responses with markdown (bold for emphasis, bullet points for lists).\n\nI will only include medical disclaimers when discussing specific medical advice, treatment decisions, or emergency situations - not in general educational responses or follow-up questions.' }]
            }
          ];
        }
        
        // Add conversation history
        fullHistory = [...fullHistory, ...conversationHistory];
        
        // Create the prompt that reinforces instructions for every message
        const enhancedMessage = `Remember: You are OncoChat AI. You ONLY discuss cancer and related health topics. If this question is about non-cancer/non-medical topics, politely redirect.

User question: ${message}`;
        
        // Start chat with full history
        const chat = model.startChat({
          history: fullHistory,
        });
        
        console.log(`💬 Sending message with ${fullHistory.length} previous messages...`);
        const result = await chat.sendMessage(enhancedMessage);
        const response = await result.response;
        const reply = response.text();

        // Add to conversation history (store the original message, not the enhanced one)
        conversationHistory.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: reply }] }
        );

        // Keep only last 20 messages (10 exchanges) to prevent token overflow
        if (conversationHistory.length > 20) {
          conversationHistory.splice(0, conversationHistory.length - 20);
        }

        console.log(`✅ Success with model: ${modelName}`);
        return res.json({ reply });
        
      } catch (modelError) {
        console.log(`❌ Model ${modelName} failed:`, modelError.message);
        lastError = modelError;
        continue;
      }
    }

    // If all models failed, use fallback
    console.log('❌ All Gemini models failed, using fallback');
    console.error('Last error:', lastError?.message);
    
    return res.json({ 
      reply: `I understand you're asking about "${message}". While I'm experiencing some technical difficulties with my AI capabilities right now, I can help with common cancer care topics like:\n\n• Discussing diagnosis with family\n• Rest during treatment\n• Managing side effects\n• Nutrition during treatment\n\nPlease try the quick prompts above or ask about these topics! 💜`
    });
    
  } catch (error) {
    console.error('❌ General error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText
    });
    
    res.json({ 
      reply: "I'm having some technical difficulties right now. Please try one of the quick prompt buttons or ask about common cancer care topics like nutrition, rest, or talking with family. 💜"
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

// Test endpoint to verify model access
router.get('/test-models', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ error: 'No API key configured' });
    }

    const modelsToTest = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    const results = [];

    for (const modelName of modelsToTest) {
      try {
        console.log(`Testing model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "Hello"');
        const response = await result.response;
        
        results.push({
          model: modelName,
          status: 'success',
          response: response.text()
        });
        
        // If we found a working model, break
        console.log(`✅ SUCCESS! Model ${modelName} works!`);
        break;
      } catch (error) {
        console.log(`❌ Model ${modelName} failed: ${error.message}`);
        results.push({
          model: modelName,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.json({ results });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Get conversation history endpoint
router.post('/get-history', (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    const sessionData = getSessionData(sessionId);
    const history = sessionData.history;
    
    // Convert history to user-friendly format
    const messages = [];
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      // Skip the system instruction messages
      if (i < 2 && msg.parts[0].text.includes('confirm you understand your role')) {
        continue;
      }
      messages.push({
        role: msg.role === 'user' ? 'user' : 'bot',
        content: msg.parts[0].text
      });
    }
    
    res.json({ success: true, messages });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Clear conversation history endpoint
router.post('/clear-history', (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    if (conversationHistories.has(sessionId)) {
      conversationHistories.delete(sessionId);
      console.log(`🗑️ Cleared history for session: ${sessionId}`);
    }
    
    res.json({ success: true, message: 'Conversation history cleared' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;