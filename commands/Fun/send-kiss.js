const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { pickRandom, formatTemplate } = require('../../lib/utils');

const DEFAULT_GIFS = [
    'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
    'https://media.giphy.com/media/FqBTvSNjNzeZG/giphy.gif',
    'https://media.giphy.com/media/11rWoZNpAKw8w/giphy.gif',
    'https://media.giphy.com/media/Z21HJj2kz9uBG/giphy.gif'
];

const DEFAULT_TEMPLATES = [
    '**{sender}** kisses **{receiver}**! 💋',
    '**{sender}** plants a sweet kiss on **{receiver}**.',
    'Smack! **{receiver}** just got a kiss from **{sender}**.',
    '**{sender}** leans in and kisses **{receiver}** romantically.'
];

const DEFAULT_RETURN_TEMPLATES = [
    '**{receiver}** kisses **{sender}** back! 💞',
    '**{receiver}** responds with an even sweeter kiss!',
    '**{receiver}** blushes and kisses **{sender}** in return.'
];

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('Send a loving kiss to another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Who do you want to kiss?')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Add a short note (optional)')
                .setMaxLength(100)
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('If enabled, only you will see the message')
                .setRequired(false)
        ),

    async execute(interaction) {
        const sender = interaction.user;
        const receiver = interaction.options.getUser('member');
        const note = (interaction.options.getString('note') || '').trim();
        const isPrivate = interaction.options.getBoolean('private') || false;
        const kissConfig = interaction.client.config.commands.kiss || {};
        const kissMessages = kissConfig.messages || {};

        if (sender.id === receiver.id) {
            return interaction.reply({ content: kissMessages.self_kiss || 'You cannot kiss yourself! 😳', flags: MessageFlags.Ephemeral });
        }

        const gifs = Array.isArray(kissConfig.gifs) && kissConfig.gifs.length ? kissConfig.gifs : DEFAULT_GIFS;
        const templates = Array.isArray(kissMessages.templates) && kissMessages.templates.length ? kissMessages.templates : DEFAULT_TEMPLATES;
        const returnTemplates = Array.isArray(kissMessages.return_templates) && kissMessages.return_templates.length ? kissMessages.return_templates : DEFAULT_RETURN_TEMPLATES;

        const randomGif = pickRandom(gifs);
        const template = pickRandom(templates)
            .replace('{sender}', `**${sender.username}**`)
            .replace('{receiver}', `**${receiver.username}**`);

        const embed = new EmbedBuilder()
            .setColor(kissConfig.color || '#ff6699')
            .setTitle(kissMessages.success_title || '💋 Kiss!')
            .setDescription(template)
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();

        if (note) {
            embed.addFields({ name: kissMessages.note_label || 'Note', value: `> ${note}` });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('kiss_return').setLabel(kissMessages.return_button || 'Kiss back').setStyle(ButtonStyle.Secondary).setEmoji('💋'),
            new ButtonBuilder().setCustomId('kiss_close').setLabel(kissMessages.close_button || 'Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.reply({ embeds: [embed], components: [row], ...(isPrivate ? { flags: MessageFlags.Ephemeral } : {}) });

        if (!receiver.bot) {
            const guildName = interaction.guild?.name || 'Direct Message';
            const channel = interaction.channel;
            const channelLabel = interaction.guild && channel && typeof channel.name === 'string'
                ? `#${channel.name}`
                : interaction.guild
                    ? 'this channel'
                    : 'this conversation';
            const channelMention = interaction.guild ? `<#${interaction.channelId}>` : channelLabel;

            const dmTemplate = kissMessages.dm || '{sender} sent you a kiss from {guild} in {channelMention}!';
            const dmContent = formatTemplate(dmTemplate, {
                sender: sender.tag,
                receiver: receiver.tag,
                guild: guildName,
                channel: channelLabel,
                channelMention
            });

            const contextFooter = [sender.tag];
            if (interaction.guild) {
                contextFooter.push(guildName, channelLabel);
            } else {
                contextFooter.push('Direct Message');
            }

            const dmEmbed = EmbedBuilder.from(embed)
                .setFooter({ text: contextFooter.join(' • '), iconURL: sender.displayAvatarURL() });

            try {
                await receiver.send({ content: dmContent, embeds: [dmEmbed] });
            } catch (error) {
                if (!kissConfig.silent_dm_failures) {
                    console.warn('Unable to DM kiss target:', error?.message || error);
                }
            }
        }

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'kiss_close') {
                if (i.user.id !== sender.id && i.user.id !== receiver.id) {
                    await i.reply({ content: kissMessages.close_denied || 'Only the sender or receiver can close this.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }

            if (i.customId === 'kiss_return') {
                if (i.user.id !== receiver.id) {
                    await i.reply({ content: kissMessages.return_denied || 'Only the mentioned member can return the kiss.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('returned');
                const newGif = pickRandom(gifs);
                const returnTemplate = pickRandom(returnTemplates)
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`);
                const returned = new EmbedBuilder()
                    .setColor(kissConfig.color || '#ff6699')
                    .setTitle(kissMessages.return_title || '💞 Kiss Returned!')
                    .setDescription(returnTemplate)
                    .setImage(newGif)
                    .setFooter({ text: `Started by ${sender.username}`, iconURL: sender.displayAvatarURL() })
                    .setTimestamp();

                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [returned], components: [disabled] });
            }
        });

        collector.on('end', async (_c, reason) => {
            if (reason === 'time') {
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ components: [disabled] }).catch(() => {});
            }
        });
    }
};
