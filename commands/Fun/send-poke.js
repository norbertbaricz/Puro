const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { pickRandom, formatTemplate } = require('../../lib/utils');

const DEFAULT_GIFS = [
    'https://media.tenor.com/8xDEVy0S3nAAAAAC/flaik-fox.gif',
    'https://media.tenor.com/zAwceKZ5To8AAAAC/boy-kisser-boop.gif',
    'https://media.tenor.com/luKSDbafAKIAAAAC/ollie-boop-paws-boop.gif',
    'https://media.tenor.com/eOoQ_YB2IF8AAAAC/protogen-boop.gif',
    'https://media.tenor.com/n997o-na714AAAAC/protogen-moose.gif',
    'https://media.tenor.com/oRoczsrjl9EAAAAC/wolf-boop.gif'
];

const DEFAULT_TEMPLATES = [
    '**{sender}** gives **{receiver}** a little poke! 👈',
    'Poke poke! **{sender}** taps **{receiver}** on the shoulder.',
    '**{sender}** pokes **{receiver}** to get their attention!',
    '**{receiver}**, you\'ve been poked by **{sender}**!'
];

const DEFAULT_RETURN_TEMPLATES = [
    '**{receiver}** pokes back at **{sender}**! 👈',
    '**{receiver}** laughs and returns the poke to **{sender}**.',
    'Counter poke! **{receiver}** taps **{sender}** right back.'
];

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('poke')
        .setDescription('Send a playful poke to another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Who do you want to poke?')
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
        const pokeConfig = interaction.client.config.commands.poke || {};
        const pokeMessages = pokeConfig.messages || {};

        if (sender.id === receiver.id) {
            return interaction.reply({ content: pokeMessages.self_poke || 'You cannot poke yourself! 😅', flags: MessageFlags.Ephemeral });
        }

        const gifs = Array.isArray(pokeConfig.gifs) && pokeConfig.gifs.length ? pokeConfig.gifs : DEFAULT_GIFS;
        const templates = Array.isArray(pokeMessages.templates) && pokeMessages.templates.length ? pokeMessages.templates : DEFAULT_TEMPLATES;
        const returnTemplates = Array.isArray(pokeMessages.return_templates) && pokeMessages.return_templates.length ? pokeMessages.return_templates : DEFAULT_RETURN_TEMPLATES;

        const randomGif = pickRandom(gifs);
        const template = pickRandom(templates);
        const description = template
            .replace('{sender}', `**${sender.username}**`)
            .replace('{receiver}', `**${receiver.username}**`);

        const embed = new EmbedBuilder()
            .setColor(pokeConfig.color || '#ffcc66')
            .setTitle(pokeMessages.success_title || '👈 Poke!')
            .setDescription(description)
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();

        if (note) {
            embed.addFields({ name: pokeMessages.note_label || 'Note', value: `> ${note}` });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('poke_return').setLabel(pokeMessages.return_button || 'Poke back').setStyle(ButtonStyle.Secondary).setEmoji('👈'),
            new ButtonBuilder().setCustomId('poke_close').setLabel(pokeMessages.close_button || 'Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
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

            const dmTemplate = pokeMessages.dm || '{sender} poked you in {guild} at {channelMention}!';
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
                if (!pokeConfig.silent_dm_failures) {
                    console.warn('Unable to DM poke target:', error?.message || error);
                }
            }
        }

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'poke_close') {
                if (i.user.id !== sender.id && i.user.id !== receiver.id) {
                    await i.reply({ content: pokeMessages.close_denied || 'Only the sender or receiver can close this.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }

            if (i.customId === 'poke_return') {
                if (i.user.id !== receiver.id) {
                    await i.reply({ content: pokeMessages.return_denied || 'Only the mentioned member can return the poke.', flags: MessageFlags.Ephemeral });
                    return;
                }
                collector.stop('returned');
                const newGif = pickRandom(gifs);
                const returnTemplate = pickRandom(returnTemplates)
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`);
                const returned = new EmbedBuilder()
                    .setColor(pokeConfig.color || '#ffcc66')
                    .setTitle(pokeMessages.return_title || '👈 Poke Returned!')
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
