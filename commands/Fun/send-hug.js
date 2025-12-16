const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { pickRandom, formatTemplate } = require('../../lib/utils');

const DEFAULT_GIFS = [
    'https://media.tenor.com/P9YD49mfnxkAAAAC/furry-hug.gif',
    'https://media.tenor.com/sUoIQyxhHdsAAAAC/furry-anti-furry.gif',
    'https://media.tenor.com/OrJiTqPixtYAAAAC/hugs-love.gif',
    'https://media.tenor.com/LEJdSFuAe-UAAAAC/pokemon-cuddle.gif',
    'https://media.tenor.com/30l78d5MMF4AAAAC/furry-meme.gif',
    'https://media.tenor.com/9dZVO_VXGjcAAAAC/hugs-fox.gif'
];

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Give a virtual hug to another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to hug')
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
        const hugConfig = config.commands.hug || {};
        const hugMessages = hugConfig.messages || {};

        if (sender.id === receiver.id) {
            return interaction.reply({ content: hugMessages.self_hug || "You can't hug yourself! 🤗", flags: MessageFlags.Ephemeral });
        }

        const gifs = Array.isArray(hugConfig.gifs) && hugConfig.gifs.length ? hugConfig.gifs : DEFAULT_GIFS;
        const randomGif = pickRandom(gifs);

        const hugEmbed = new EmbedBuilder()
            .setColor(hugConfig.color || '#ffb6c1')
            .setTitle(hugMessages.success_title || '🤗 Hug Time!')
            .setDescription(
                (hugMessages.success_desc || '**{sender}** gives a warm hug to **{receiver}**! How sweet!')
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`)
            )
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();

        if (note) {
            hugEmbed.addFields({ name: hugMessages.note_label || 'Note', value: `> ${note}` });
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hug_return').setLabel('Return hug').setStyle(ButtonStyle.Secondary).setEmoji('🤗'),
            new ButtonBuilder().setCustomId('hug_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.reply({ embeds: [hugEmbed], components: [row], ...(isPrivate ? { flags: MessageFlags.Ephemeral } : {}) });

        let dmNoticeSent = false;
        const notifyDmFailure = async () => {
            if (dmNoticeSent) {
                return;
            }
            dmNoticeSent = true;
            const dmFailedMessage = hugMessages.dm_failed || 'I could not send them a DM. They might have DMs disabled.';
            await interaction.followUp({ content: dmFailedMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
        };

        if (!receiver.bot) {
            const guildName = interaction.guild?.name || 'Direct Message';
            const channel = interaction.channel;
            const channelLabel = interaction.guild && channel && typeof channel.name === 'string'
                ? `#${channel.name}`
                : interaction.guild
                    ? 'this channel'
                    : 'this conversation';
            const channelMention = interaction.guild ? `<#${interaction.channelId}>` : channelLabel;

            const dmTemplate = hugMessages.dm || '{sender} sent you a hug from {guild} in {channelMention}!';
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

            const dmEmbed = EmbedBuilder.from(hugEmbed)
                .setFooter({ text: contextFooter.join(' • '), iconURL: sender.displayAvatarURL() });

            try {
                await receiver.send({ content: dmContent, embeds: [dmEmbed] });
            } catch (error) {
                if (!hugConfig.silent_dm_failures) {
                    const logger = interaction.client.logger?.warn ? interaction.client.logger : console;
                    (logger.warn || console.warn).call(logger, 'Unable to DM hug target:', error?.message || error);
                }
                await notifyDmFailure();
            }
        }

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.customId === 'hug_close') {
                if (i.user.id !== sender.id && i.user.id !== receiver.id) {
                    await i.reply({ content: 'Only the sender or receiver can close this.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }

            if (i.customId === 'hug_return') {
                if (i.user.id !== receiver.id) {
                    await i.reply({ content: 'Only the mentioned member can return the hug.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('returned');
                const newGif = pickRandom(gifs) || randomGif;
                const returned = new EmbedBuilder()
                    .setColor(hugConfig.color || '#ffb6c1')
                    .setTitle('🤗 Hug Returned!')
                    .setDescription(`**${receiver.username}** returns a warm hug to **${sender.username}**!`)
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
