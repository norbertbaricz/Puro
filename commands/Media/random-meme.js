const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const axios = require('axios');

const memeCache = {
    memes: [],
    lastUpdate: 0,
    CACHE_DURATION: 5 * 60 * 1000
};

module.exports = {
    category: 'Media',
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme')
        .addStringOption(option =>
            option.setName('subreddit').setDescription('Specific subreddit').setRequired(false))
        .addBooleanOption(option =>
            option.setName('private').setDescription('Reply only to you').setRequired(false)
        ),

    async execute(interaction) {
        const config = interaction.client.config.commands.meme;
        try {
            const isPrivate = interaction.options.getBoolean('private') || false;
            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            let meme;
            const subreddit = interaction.options.getString('subreddit');
            const apiUrl = subreddit ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}` : 'https://meme-api.com/gimme';

            const now = Date.now();
            if (!subreddit && memeCache.memes.length > 0 && now - memeCache.lastUpdate < memeCache.CACHE_DURATION) {
                meme = memeCache.memes.shift();
            } else {
                const response = await axios.get(apiUrl, { timeout: 7000, headers: { 'User-Agent': 'PuroBot/1.0' } });
                if (!response.data || !response.data.url) throw new Error('Invalid meme data');
                meme = response.data;

                if (!subreddit) {
                    try {
                        const cacheResponse = await axios.get(`https://meme-api.com/gimme/${interaction.client.config.limits.meme_cache}`,
                            { timeout: 7000, headers: { 'User-Agent': 'PuroBot/1.0' } });
                        memeCache.memes = (cacheResponse.data.memes || []).slice(0, interaction.client.config.limits.meme_cache);
                        memeCache.lastUpdate = now;
                    } catch (error) {
                        console.error('Meme cache error:', error);
                    }
                }
            }

            const build = (m) => new EmbedBuilder()
                .setColor(config.color)
                .setTitle(m.title || 'Random Meme')
                .setURL(m.postLink || m.url)
                .setImage(m.url)
                .addFields(
                    { name: '📊 Stats', value: `👍 ${m.ups || 0} upvotes`, inline: true },
                    { name: '🎯 Source', value: `r/${m.subreddit || 'unknown'}`, inline: true }
                )
                .setFooter({ text: `Posted by u/${m.author || 'unknown'}` })
                .setTimestamp();

            const rowFor = (rerolls) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('meme_next').setLabel('Another').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(rerolls >= 5),
                new ButtonBuilder().setLabel('Open').setStyle(ButtonStyle.Link).setURL(meme.postLink || meme.url),
                new ButtonBuilder().setCustomId('meme_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            let rerolls = 0;
            await interaction.editReply({ embeds: [build(meme)], components: [rowFor(rerolls)] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'meme_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(rowFor(rerolls).components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'meme_next') {
                    rerolls += 1;
                    // use cache for general subreddit, otherwise fetch fresh
                    if (!subreddit && memeCache.memes.length > 0) {
                        meme = memeCache.memes.shift();
                    } else {
                        try {
                            const resp = await axios.get(apiUrl, { timeout: 7000, headers: { 'User-Agent': 'PuroBot/1.0' } });
                            meme = resp.data;
                        } catch {
                            // ignore
                        }
                    }
                    await i.update({ embeds: [build(meme)], components: [rowFor(rerolls)] });
                }
            });
            collector.on('end', async (_c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(rowFor(rerolls).components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Meme error:', error);
            const payload = { content: config.messages.error, flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) await interaction.editReply(payload); else await interaction.reply(payload);
        }
    },
};
