require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listAvailableModels() {
    try {
        console.log('🔍 Checking available models...');
        console.log('API Key:', process.env.GEMINI_API_KEY ? '✅ Present' : '❌ Missing');
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // List all available models
        const models = await genAI.listModels();
        
        console.log('\n📋 AVAILABLE MODELS:');
        console.log('===================');
        
        models.models.forEach((model, index) => {
            console.log(`${index + 1}. ${model.name}`);
            console.log(`   Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
            console.log(`   Description: ${model.description}`);
            console.log('---');
        });

        // Test if any model supports generateContent
        const generateContentModels = models.models.filter(model => 
            model.supportedGenerationMethods.includes('generateContent')
        );
        
        console.log('\n🎯 MODELS THAT SUPPORT generateContent:');
        console.log('===================================');
        generateContentModels.forEach((model, index) => {
            console.log(`${index + 1}. ${model.name}`);
        });

        if (generateContentModels.length > 0) {
            console.log('\n✅ Use one of these models in your gemini-api.js file!');
        } else {
            console.log('\n❌ No models support generateContent method');
        }

    } catch (error) {
        console.error('❌ Error listing models:', error.message);
        console.log('\n💡 Possible issues:');
        console.log('1. API key is invalid');
        console.log('2. API key has no permissions');
        console.log('3. Regional restrictions');
    }
}

listAvailableModels();