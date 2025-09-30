const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { pickRandom, formatTemplate } = require('../../lib/utils');

const DEFAULT_GIFS = [
    'https://media.giphy.com/media/109ltuoSQT212w/giphy.gif',
    'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif',
    'https://media.giphy.com/media/4HP0ddZnNVvKU/giphy.gif',
    'https://media.giphy.com/media/L2z7dnOduqEow/giphy.gif'
];

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('Pat another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to pat')
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
        const config = interaction.client.config;
        const patConfig = config.commands.pat || {};
        const patMessages = patConfig.messages || {};

        if (sender.id === receiver.id) {
            return interaction.reply({ content: patMessages.self_pat || 'You cannot pat yourself! 🫶', flags: MessageFlags.Ephemeral });
        }

        const gifs = Array.isArray(patConfig.gifs) && patConfig.gifs.length ? patConfig.gifs : DEFAULT_GIFS;
        const randomGif = pickRandom(gifs);

        const patEmbed = new EmbedBuilder()
            .setColor(patConfig.color || '#add8e6')
            .setTitle(patMessages.success_title || '🫶 Pat Time!')
            .setDescription(
                (patMessages.success_desc || '**{sender}** gently pats **{receiver}**!')
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`)
            )
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();
        if (note) {
            patEmbed.addFields({ name: patMessages.note_label || 'Note', value: `> ${note}` });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pat_return').setLabel('Pat back').setStyle(ButtonStyle.Secondary).setEmoji('🫶'),
            new ButtonBuilder().setCustomId('pat_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.reply({ embeds: [patEmbed], components: [row], ...(isPrivate ? { flags: MessageFlags.Ephemeral } : {}) });

        if (!receiver.bot) {
            const guildName = interaction.guild?.name || 'Direct Message';
            const channel = interaction.channel;
            const channelLabel = interaction.guild && channel && typeof channel.name === 'string'
                ? `#${channel.name}`
                : interaction.guild
                    ? 'this channel'
                    : 'this conversation';
            const channelMention = interaction.guild ? `<#${interaction.channelId}>` : channelLabel;

            const dmTemplate = patMessages.dm || '{sender} sent you a pat from {guild} in {channelMention}!';
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

            const dmEmbed = EmbedBuilder.from(patEmbed)
                .setFooter({ text: contextFooter.join(' • '), iconURL: sender.displayAvatarURL() });

            try {
                await receiver.send({ content: dmContent, embeds: [dmEmbed] });
            } catch (error) {
                if (!patConfig.silent_dm_failures) {
                    console.warn('Unable to DM pat target:', error?.message || error);
                }
            }
        }

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.customId === 'pat_close') {
                if (i.user.id !== sender.id && i.user.id !== receiver.id) {
                    await i.reply({ content: 'Only the sender or receiver can close this.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }

            if (i.customId === 'pat_return') {
                if (i.user.id !== receiver.id) {
                    await i.reply({ content: 'Only the mentioned member can pat back.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('returned');
                const newGif = pickRandom(gifs);
                const returned = new EmbedBuilder()
                    .setColor(patConfig.color || '#add8e6')
                    .setTitle('🫶 Pat Returned!')
                    .setDescription(`**${receiver.username}** gently pats **${sender.username}** back!`)
                    .setImage(newGif)
                    .setFooter({ text: `Started by ${sender.username}`, iconURL: sender.displayAvatarURL() })
                    .setTimestamp();
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [returned], components: [disabled] });
                return;
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
