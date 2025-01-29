const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#FF4500' } }; // Reddit orange as fallback
}

// Simple cache implementation
const memeCache = {
    memes: [],
    lastUpdate: 0,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    MAX_CACHE_SIZE: 50
};

// Rate limiting
const userCooldowns = new Map();
const COOLDOWN_DURATION = 3000; // 3 seconds

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme from Reddit!')
        .addStringOption(option =>
            option.setName('subreddit')
                .setDescription('Specific subreddit to fetch from (default: random)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Check cooldown
            const now = Date.now();
            const cooldownEnd = userCooldowns.get(interaction.user.id);
            if (cooldownEnd && now < cooldownEnd) {
                const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
                return interaction.reply({
                    content: `⏳ Please wait ${remainingTime} seconds before requesting another meme.`,
                    ephemeral: true
                });
            }

            // Set cooldown
            userCooldowns.set(interaction.user.id, now + COOLDOWN_DURATION);

            // Defer reply as API request might take time
            await interaction.deferReply();

            let meme;
            const subreddit = interaction.options.getString('subreddit');
            const apiUrl = subreddit 
                ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}`
                : 'https://meme-api.com/gimme';

            // Check cache first if no specific subreddit is requested
            if (!subreddit && memeCache.memes.length > 0 && now - memeCache.lastUpdate < memeCache.CACHE_DURATION) {
                meme = memeCache.memes.shift();
            } else {
                // Fetch new meme
                const response = await axios.get(apiUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Discord-Bot/1.0'
                    }
                });

                if (!response.data || !response.data.url) {
                    throw new Error('Invalid meme data received');
                }

                meme = response.data;

                // Update cache if no specific subreddit
                if (!subreddit) {
                    // Fetch multiple memes for cache
                    try {
                        const cacheResponse = await axios.get('https://meme-api.com/gimme/50', {
                            timeout: 5000,
                            headers: {
                                'User-Agent': 'Discord-Bot/1.0'
                            }
                        });
                        memeCache.memes = cacheResponse.data.memes || [];
                        memeCache.lastUpdate = now;
                    } catch (error) {
                        console.error('Error updating meme cache:', error);
                    }
                }
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(config.commands?.meme || config.colors?.default || '#FF4500')
                .setTitle(meme.title || 'Random Meme')
                .setURL(meme.postLink || meme.url)
                .setImage(meme.url)
                .addFields(
                    { 
                        name: '📊 Stats', 
                        value: `👍 ${meme.ups || 0} upvotes`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 Source', 
                        value: `r/${meme.subreddit || 'unknown'}`, 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: `Posted by u/${meme.author || 'unknown'}` 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            let errorMessage = '❌ Failed to fetch a meme.';
            if (error.response) {
                switch (error.response.status) {
                    case 404:
                        errorMessage = '❌ Subreddit not found or no memes available.';
                        break;
                    case 429:
                        errorMessage = '❌ Rate limit reached. Please try again later.';
                        break;
                    case 503:
                        errorMessage = '❌ Meme service is currently unavailable.';
                        break;
                }
            }

            await interaction.editReply({
                content: errorMessage,
                ephemeral: true
            });
        }
    },
};
