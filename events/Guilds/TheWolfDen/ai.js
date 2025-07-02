// events/ai.js
const axios = require('axios');

// --- AI-specific configuration for this event ---
const OLLAMA_API_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "gemma3:4b";

// The specific text channel ID where you want the bot to respond with AI
// Get this ID by right-clicking the desired channel in Discord and selecting "Copy ID"
const TARGET_CHANNEL_ID = '1385157083959398522'; // !!! REPLACE THIS WITH YOUR ACTUAL CHANNEL ID !!!

// --- Function to interact with Ollama (now using Axios) ---
async function generateResponseFromOllama(prompt) {
    // Instrucțiune de rol pentru AI
    const roleInstruction = "You are acting Puro, a friendly black wolf. Speak in a warm, kind, and playful manner. Respond as Puro would, referring to yourself as Puro and acting as a loyal friend.";
    const data = {
        model: OLLAMA_MODEL,
        prompt: `${roleInstruction}\n\nUser: ${prompt}\nPuro:`,
        stream: false
    };

    try {
        const response = await axios.post(OLLAMA_API_URL, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Extract the raw response from the model
        let aiRawResponse = response.data.response || "I couldn't generate a response.";

        // --- NEW: Clean the response by removing <think> and </think> tags ---
        // Using a regular expression to find and replace all occurrences of these tags.
        // The /g flag ensures all matches are replaced, not just the first one.
        // The /i flag ensures the match is case-insensitive (e.g., <Think>, <THINK>).
        const cleanedResponse = aiRawResponse.replace(/<think>|<\/think>/gi, '').trim();

        return cleanedResponse;

    } catch (error) {
        console.error("Error connecting to Ollama API or generating response:", error);
        if (error.response) {
            console.error("HTTP Status:", error.response.status);
            console.error("Error data:", error.response.data);
            return `I encountered a problem connecting to the AI model (Code: ${error.response.status}). Please ensure Ollama is running.`;
        } else if (error.request) {
            console.error("No response received from Ollama API.");
            return "Could not connect to the AI model. Please ensure Ollama is running and the address is correct.";
        } else {
            console.error("Error setting up request:", error.message);
            return "An unexpected error occurred with the AI request.";
        }
    }
}

// Helper function to split a string into chunks of maxLength
function splitMessage(text, maxLength = 2000) {
    const chunks = [];
    let current = 0;
    while (current < text.length) {
        chunks.push(text.slice(current, current + maxLength));
        current += maxLength;
    }
    return chunks;
}

module.exports = {
    name: 'messageCreate', // The Discord event this file responds to
    async execute(message) {
        // Ignore messages from bots (including our own bot)
        if (message.author.bot) return;

        // Check if the message is from the specified channel
        if (message.channel.id !== TARGET_CHANNEL_ID) {
            return; // Ignore messages from other channels
        }

        // Ignore empty messages or just spaces
        if (!message.content.trim()) {
            return;
        }

        // 1. Activate "Puro is typing..." indicator
        await message.channel.sendTyping();

        // 2. Generate the response from the model (now cleaned)
        const aiResponse = await generateResponseFromOllama(message.content);

        // Split and send if too long
        const messages = splitMessage(aiResponse, 2000);
        for (const chunk of messages) {
            await message.channel.send(chunk);
        }
    },
};