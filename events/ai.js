const { Events } = require('discord.js');
const axios = require('axios'); // Import Axios

const CHANNEL_ID = '1385157083959398522';
const MODEL = 'gemma3:4b';
const OLLAMA_API_URL = 'http://localhost:11434/api/generate'; // Default Ollama API endpoint

// Helper to split long messages for Discord
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
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        if (message.channel.id !== CHANNEL_ID) return;
        if (!message.content.trim()) return;

        // Start typing and keep sending while waiting for response
        let typing = true;
        const typingInterval = setInterval(() => {
            if (typing) message.channel.sendTyping();
        }, 7000); // every 7 seconds

        // Send first typing immediately
        await message.channel.sendTyping();

        // Prompt for Puro's personality
        const prompt = `You are Puro, a friendly black wolf. Speak warmly and kindly. User: ${message.content}\nPuro:`;

        try {
            const response = await axios.post(OLLAMA_API_URL, {
                model: MODEL,
                prompt: prompt,
                stream: false, // Set to false to get the full response at once
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Ollama's /api/generate endpoint returns the response in `response.data.response`
            let puroResponse = response.data.response.trim();

            // If the response is empty, send a default message
            if (!puroResponse) {
                typing = false;
                clearInterval(typingInterval);
                await message.reply("I couldn't generate a coherent response this time. Please try again!");
                return;
            }

            typing = false;
            clearInterval(typingInterval);

            // Split and send if too long
            const messages = splitMessage(puroResponse, 2000);
            for (const chunk of messages) {
                await message.reply(chunk);
            }

        } catch (error) {
            typing = false;
            clearInterval(typingInterval);
            console.error('Error communicating with Ollama:', error.message);
            if (error.response) {
                console.error('Ollama API Response Error:', error.response.data);
                console.error('Status:', error.response.status);
            } else if (error.request) {
                console.error('No response received from Ollama API. Is Ollama running?');
            }
            await message.reply('Sorry, I had a problem generating a response. Please check if Ollama is running and the model is available.');
        }
    },
};