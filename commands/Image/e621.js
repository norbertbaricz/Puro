const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    category: 'Image',
    data: new SlashCommandBuilder()
        .setName('e621')
        .setDescription('Search e621 images')
        .addStringOption(option =>
            option.setName('search').setDescription('Search terms').setRequired(false))
        .addBooleanOption(option =>
            option.setName('explicit').setDescription('Include explicit').setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.e621;
        try {
            if (!interaction.channel) {
                return interaction.reply({ content: "❌ This command can only be used in a server channel.", flags: 64 });
            }
            const isExplicit = interaction.options.getBoolean('explicit') ?? false;
            if (isExplicit && !interaction.channel.nsfw) {
                return interaction.reply({ content: config.messages.nsfw_required, flags: 64 });
            }

            await interaction.deferReply();

            const searchQuery = interaction.options.getString('search') || 'werewolf';
            const rating = isExplicit ? 'explicit' : 'safe';
            const apiUrl = `https://e621.net/posts.json?tags=${encodeURIComponent(searchQuery)}+rating:${rating}&limit=${interaction.client.config.limits.e621_results}`;

            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': `E621Bot/1.0 (by ${process.env.E621_USERNAME})`,
                    'Authorization': 'Basic ' + Buffer.from(`${process.env.E621_USERNAME}:${process.env.E621_API_KEY}`).toString('base64')
                },
                timeout: 10000 // Increased timeout
            });

            if (!response.data.posts || response.data.posts.length === 0) {
                return interaction.editReply(config.messages.no_results);
            }

            // Filter valid posts with multiple fallback image options
            const validPosts = response.data.posts.filter(post => {
                const hasValidFile = post.file && 
                    (post.file.ext === 'png' || post.file.ext === 'jpg' || post.file.ext === 'gif' || post.file.ext === 'webm') &&
                    post.file.size < 8388608;
                
                // Check for alternative image URLs
                const hasValidUrls = post.sample?.url || post.preview?.url;
                
                return hasValidFile && hasValidUrls;
            });

            if (validPosts.length === 0) {
                return interaction.editReply(config.messages.no_valid_images);
            }

            const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];

            // Use sample URL if available (usually smaller), otherwise fall back to full file URL
            const imageUrl = randomPost.sample?.url || randomPost.file.url;
            
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setImage(imageUrl)
                .setFooter({ text: `Score: ${randomPost.score.total} | Rating: ${randomPost.rating}` })
                .setTimestamp();

            // Add artist information if available
            if (randomPost.tags.artist && randomPost.tags.artist.length > 0) {
                embed.setAuthor({ name: `Artist: ${randomPost.tags.artist.join(', ')}` });
            }

            // Try to edit the reply, if it fails due to image issues, send a new message
            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (editError) {
                console.error('Failed to edit reply, trying new message:', editError);
                await interaction.followUp({ embeds: [embed] });
            }
            
        } catch (error) {
            console.error('e621 error:', error);
            const errorMessage = error.response?.status === 404 ? 
                config.messages.no_results : 
                config.messages.error;
            await interaction.editReply({ content: errorMessage, ephemeral: true });
        }
    },
};