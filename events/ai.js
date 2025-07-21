const { Events } = require('discord.js');
const axios = require('axios');

const CHANNEL_ID = '1385157083959398522';
const MODEL = 'gemma3:4b';
const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

function splitMessage(text, { maxLength = 2000 } = {}) {
    if (text.length <= maxLength) return [text];
    const chunks = [];
    let currentChunk = "";
    const sentences = text.match(/[^.!?]+[.!?]+|\S+/g) || [];

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 <= maxLength) {
            currentChunk += sentence + " ";
        } else {
            chunks.push(currentChunk.trim());
            currentChunk = sentence + " ";
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.channel.id !== CHANNEL_ID || !message.content.trim()) {
            return;
        }

        let typingInterval;
        try {
            await message.channel.sendTyping();
            typingInterval = setInterval(() => {
                message.channel.sendTyping().catch(console.error);
            }, 8000); // Send typing status every 8 seconds

            const prompt = `You are Puro, a friendly black latex wolf from the game "Changed". Your personality is innocent, curious, and sometimes a bit naive. You are very friendly and kind. You often refer to humans as "hooman". Avoid complex sentences. User: ${message.content}\nPuro:`;

            const response = await axios.post(OLLAMA_API_URL, {
                model: MODEL,
                prompt: prompt,
                stream: false,
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000 // 30 second timeout
            });

            const puroResponse = response.data?.response?.trim();

            if (!puroResponse) {
                await message.reply("I... I'm not sure what to say, hooman. Can you ask again?");
                return;
            }

            const messages = splitMessage(puroResponse, { maxLength: 2000 });
            for (const chunk of messages) {
                await message.reply(chunk);
            }

        } catch (error) {
            console.error('Error communicating with Ollama:', error.message);
            let replyMessage = 'Oh no, my brain-fluff isn\'t working! I had a problem thinking of a response.';
            if (error.code === 'ECONNREFUSED') {
                replyMessage += ' Is the Ollama server running, hooman?';
            } else if (error.response) {
                console.error('Ollama API Response Error:', error.response.data);
                replyMessage += ' The thinking-machine gave me an error.';
            }
            
            try {
                await message.reply(replyMessage);
            } catch (replyError) {
                console.error("Failed to send error reply:", replyError);
            }
        } finally {
            if (typingInterval) {
                clearInterval(typingInterval);
            }
        }
    },
};