const { Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const CHANNEL_ID = '1229630651536375899';
const MODEL = 'gemma3:4b'; // You can change the model if you wish
const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.channel.id !== CHANNEL_ID || !message.content.trim()) {
            return;
        }

        try {
            // Linia pentru "typing..." a fost eliminată de aici

            // This is the specialized prompt for moderation, now targeting English.
            // We give the AI clear instructions to reply only with "true" or "false".
            const prompt = `You are a strict content moderation expert. Your task is to analyze the following text written in English and determine if it contains any profanity, insults, hate speech, or toxicity.
You must respond with only one single word: 'true' if the text contains such content, or 'false' if it does not. Do not add any explanation, punctuation, or any other words.

Text to analyze: "${message.content}"

Answer (only 'true' or 'false'):`;

            const response = await axios.post(OLLAMA_API_URL, {
                model: MODEL,
                prompt: prompt,
                stream: false, // We don't need a stream for a short response
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000 // 30-second timeout
            });

            // Process the response from the AI
            const aiResponse = response.data?.response?.trim().toLowerCase();

            const embed = new EmbedBuilder();
            if (aiResponse === 'true') {
                embed.setTitle('Moderation Result: True')
                     .setDescription('The AI has detected content that may violate moderation guidelines.')
                     .setColor('Red'); // Red for true/violation
            } else {
                embed.setTitle('Moderation Result: False')
                     .setDescription('The AI has not detected any content violating moderation guidelines.')
                     .setColor('Green'); // Green for false/no violation
            }
            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error communicating with Ollama:', error.message);
            let replyMessage = 'Oh no! My moderation AI is not working correctly.';
            if (error.code === 'ECONNREFUSED') {
                replyMessage += ' Is the Ollama server running?';
            } else if (error.response) {
                console.error('Ollama API Response Error:', error.response.data);
                replyMessage += ' I received an error from the API.';
            }
            
            try {
                // Send an error message to Discord if something went wrong
                await message.reply(replyMessage);
            } catch (replyError) {
                console.error("Failed to send error reply:", replyError);
            }
        }
    },
};