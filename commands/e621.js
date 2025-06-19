const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const ratelimit = require('../ratelimit');

module.exports = {
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
            const remaining = ratelimit(interaction.user.id, 5000);
            if (remaining) {
                return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
            }

            const isExplicit = interaction.options.getBoolean('explicit') ?? false;
            if (isExplicit && !interaction.channel.nsfw) {
                return interaction.reply({ content: config.messages.nsfw_required, ephemeral: true });
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
                timeout: 5000
            });

            if (!response.data.posts || response.data.posts.length === 0) {
                return interaction.editReply(config.messages.no_results);
            }

            const validPosts = response.data.posts.filter(post => 
                post.file?.url && 
                (post.file.ext === 'png' || post.file.ext === 'jpg' || post.file.ext === 'gif') &&
                post.file.size < 8388608
            );

            if (validPosts.length === 0) {
                return interaction.editReply(config.messages.no_valid_images);
            }

            const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setImage(randomPost.file.url)
                .setFooter({ text: `Score: ${randomPost.score.total} | Rating: ${randomPost.rating}` })
                .setTimestamp()
                .setDescription(`[Open image](${randomPost.file.url})`);

            if (randomPost.tags.artist.length > 0) {
                embed.setAuthor({ name: `Artist: ${randomPost.tags.artist.join(', ')}` });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('e621 error:', error);
            await interaction.editReply({ content: config.messages.error, ephemeral: true });
        }
    },
};