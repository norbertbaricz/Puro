const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#FF69B4' } }; // Fallback config
}

// Rate limiting map
const userCooldowns = new Map();
const COOLDOWN_DURATION = 5000; // 5 seconds

module.exports = {
    data: new SlashCommandBuilder()
        .setName('e621')
        .setDescription('Search for images on e621')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search terms (space-separated)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('explicit')
                .setDescription('Include explicit content')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Check cooldown
            const now = Date.now();
            const cooldownEnd = userCooldowns.get(interaction.user.id);
            if (cooldownEnd && now < cooldownEnd) {
                const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
                return interaction.reply({
                    content: `⏳ Please wait ${remainingTime} seconds before searching again.`,
                    ephemeral: true
                });
            }

            // Set cooldown
            userCooldowns.set(interaction.user.id, now + COOLDOWN_DURATION);

            // Defer reply as API request might take time
            await interaction.deferReply();

            const searchQuery = interaction.options.getString('search') || 'werewolf';
            const isExplicit = interaction.options.getBoolean('explicit') ?? false;
            const rating = isExplicit ? 'explicit' : 'safe';

            // Construct API URL with proper encoding and rating
            const apiUrl = `https://e621.net/posts.json?tags=${encodeURIComponent(searchQuery)}+rating:${rating}&limit=100`;

            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': `E621Bot/1.0 (by ${process.env.E621_USERNAME})`,
                    'Authorization': 'Basic ' + Buffer.from(`${process.env.E621_USERNAME}:${process.env.E621_API_KEY}`).toString('base64')
                },
                timeout: 5000 // 5 second timeout
            });

            if (!response.data.posts || response.data.posts.length === 0) {
                return interaction.editReply('No results found for your search.');
            }

            // Filter valid images and check for supported formats
            const validPosts = response.data.posts.filter(post => 
                post.file?.url && 
                (post.file.ext === 'png' || post.file.ext === 'jpg' || post.file.ext === 'gif') &&
                post.file.size < 8388608 // 8MB Discord limit
            );

            if (validPosts.length === 0) {
                return interaction.editReply('No suitable images found. Try different search terms.');
            }

            // Select random post from valid posts
            const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];

            const embed = new EmbedBuilder()
                .setColor(config.commands?.e621 || config.colors?.default || '#FF69B4')
                .setImage(randomPost.file.url)
                .setFooter({ text: `Score: ${randomPost.score.total} | Rating: ${randomPost.rating}` })
                .setTimestamp();

            if (randomPost.tags.artist.length > 0) {
                embed.setAuthor({ name: `Artist: ${randomPost.tags.artist.join(', ')}` });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            let errorMessage = 'An error occurred while fetching the image.';
            if (error.response) {
                switch (error.response.status) {
                    case 403:
                        errorMessage = 'Authentication failed. Please check API credentials.';
                        break;
                    case 429:
                        errorMessage = 'Rate limit reached. Please try again later.';
                        break;
                    case 404:
                        errorMessage = 'No results found for your search.';
                        break;
                }
            }

            await interaction.editReply({
                content: `❌ ${errorMessage}`,
                ephemeral: true
            });
        }
    },
};
