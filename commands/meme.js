const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const ratelimit = require('../ratelimit');

const memeCache = {
    memes: [],
    lastUpdate: 0,
    CACHE_DURATION: 5 * 60 * 1000
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme')
        .addStringOption(option =>
            option.setName('subreddit').setDescription('Specific subreddit').setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.meme;
        try {
            const remaining = ratelimit(interaction.user.id, 5000);
            if (remaining) {
                return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
            }

            await interaction.deferReply();

            let meme;
            const subreddit = interaction.options.getString('subreddit');
            const apiUrl = subreddit ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}` : 'https://meme-api.com/gimme';

            const now = Date.now();
            if (!subreddit && memeCache.memes.length > 0 && now - memeCache.lastUpdate < memeCache.CACHE_DURATION) {
                meme = memeCache.memes.shift();
            } else {
                const response = await axios.get(apiUrl, { timeout: 5000, headers: { 'User-Agent': 'Discord-Bot/1.0' } });
                if (!response.data || !response.data.url) throw new Error('Invalid meme data');
                meme = response.data;

                if (!subreddit) {
                    try {
                        const cacheResponse = await axios.get(`https://meme-api.com/gimme/${interaction.client.config.limits.meme_cache}`, 
                            { timeout: 5000, headers: { 'User-Agent': 'Discord-Bot/1.0' } });
                        memeCache.memes = (cacheResponse.data.memes || []).slice(0, interaction.client.config.limits.meme_cache);
                        memeCache.lastUpdate = now;
                    } catch (error) {
                        console.error('Meme cache error:', error);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(meme.title || 'Random Meme')
                .setURL(meme.postLink || meme.url)
                .setImage(meme.url)
                .addFields(
                    { name: '📊 Stats', value: `👍 ${meme.ups || 0} upvotes`, inline: true },
                    { name: '🎯 Source', value: `r/${meme.subreddit || 'unknown'}`, inline: true }
                )
                .setFooter({ text: `Posted by u/${meme.author || 'unknown'}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Meme error:', error);
            await interaction.editReply({ content: config.messages.error, ephemeral: true });
        }
    },
};