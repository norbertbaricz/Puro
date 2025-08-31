const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const axios = require('axios');

module.exports = {
    category: 'Image',
    data: new SlashCommandBuilder()
        .setName('e621')
        .setDescription('Search e621 images')
        .addStringOption(option =>
            option.setName('search').setDescription('Search terms (space/comma separated)').setRequired(false))
        .addStringOption(option =>
            option.setName('rating').setDescription('Content rating filter').addChoices(
                { name: 'Safe', value: 's' },
                { name: 'Questionable', value: 'q' },
                { name: 'Explicit', value: 'e' }
            ).setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('limit').setDescription('How many results to sample from (1-100)').setMinValue(1).setMaxValue(100).setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private').setDescription('Reply only to you').setRequired(false)
        ),

    async execute(interaction) {
        const config = interaction.client.config.commands.e621;
        try {
            if (!interaction.channel) {
                return interaction.reply({ content: "❌ This command can only be used in a server channel.", flags: MessageFlags.Ephemeral });
            }
            const ratingOpt = interaction.options.getString('rating');
            const isPrivate = interaction.options.getBoolean('private') || false;
            if ((ratingOpt === 'e') && !interaction.channel.nsfw) {
                return interaction.reply({ content: config.messages.nsfw_required, flags: MessageFlags.Ephemeral });
            }

            if (isPrivate) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } else {
                await interaction.deferReply();
            }

            const rawQuery = interaction.options.getString('search') || '';
            const searchTags = rawQuery
                .split(/[\s,]+/)
                .filter(Boolean)
                .map(t => t.replace(/\s+/g, '_'));
            const ratingTag = ratingOpt ? `rating:${ratingOpt}` : 'rating:safe';
            const limit = interaction.options.getInteger('limit') || interaction.client.config.limits.e621_results || 20;
            const tags = [...searchTags, ratingTag].join(' ');
            const apiUrl = `https://e621.net/posts.json?tags=${encodeURIComponent(tags)}&limit=${limit}`;

            const headers = {
                'User-Agent': `PuroBot/1.0 (Discord bot)`
            };
            if (process.env.E621_USERNAME && process.env.E621_API_KEY) {
                headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.E621_USERNAME}:${process.env.E621_API_KEY}`).toString('base64');
                headers['User-Agent'] = `PuroBot/1.0 (by ${process.env.E621_USERNAME})`;
            }

            const response = await axios.get(apiUrl, { headers, timeout: 12000 });
            const posts = response.data?.posts || [];
            if (!posts.length) return interaction.editReply(config.messages.no_results);

            const candidates = posts.filter(p => !p.is_banned && !p.is_deleted && p.file && p.file.url && ['png','jpg','jpeg','gif'].includes(p.file.ext));
            if (!candidates.length) return interaction.editReply(config.messages.no_valid_images);

            const pick = () => candidates[Math.floor(Math.random() * candidates.length)];

            const render = async (rerolls = 0) => {
                const post = pick();
                const imageUrl = post.sample?.url || post.file.url;
                const artists = (post.tags?.artist || []).join(', ') || 'Unknown';
                const ratingMap = { s: 'Safe', q: 'Questionable', e: 'Explicit' };
                const postUrl = `https://e621.net/posts/${post.id}`;

                const embed = new EmbedBuilder()
                    .setColor(config.color)
                    .setTitle(`e621: ${artists}`)
                    .setURL(postUrl)
                    .setImage(imageUrl)
                    .addFields(
                        { name: 'Score', value: String(post.score?.total ?? 0), inline: true },
                        { name: 'Rating', value: ratingMap[post.rating] || post.rating, inline: true },
                        { name: 'Tags', value: (post.tags?.general || []).slice(0, 8).join(', ') || 'None', inline: false }
                    )
                    .setFooter({ text: `ID: ${post.id} • Rerolls: ${rerolls}` })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('e621_next').setLabel('Another').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(rerolls >= 5),
                    new ButtonBuilder().setLabel('Open').setStyle(ButtonStyle.Link).setURL(postUrl),
                    new ButtonBuilder().setCustomId('e621_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [embed], components: [row] });

                const msg = await interaction.fetchReply();
                const collector = msg.createMessageComponentCollector({ time: 30000 });
                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                        return;
                    }
                    if (i.customId === 'e621_close') {
                        collector.stop('closed');
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await i.update({ components: [disabled] });
                        return;
                    }
                    if (i.customId === 'e621_next') {
                        collector.stop('reroll');
                        await i.deferUpdate();
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ components: [disabled] });
                        setTimeout(() => render(rerolls + 1), 600);
                    }
                });
                collector.on('end', async (c, reason) => {
                    if (reason === 'time') {
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ components: [disabled] }).catch(() => {});
                    }
                });
            };

            await render(0);

        } catch (error) {
            console.error('e621 error:', error);
            const errorMessage = error.response?.status === 404 ? config.messages.no_results : config.messages.error;
            const already = interaction.deferred || interaction.replied;
            const payload = { content: errorMessage, flags: MessageFlags.Ephemeral };
            already ? await interaction.editReply(payload) : await interaction.reply(payload);
        }
    },
};
