const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
        const patConfig = config.commands.pat;

        if (sender.id === receiver.id) {
            return interaction.reply({ content: patConfig.messages.self_pat, ephemeral: true });
        }

        // Poți adăuga un GIF random dintr-o listă pentru efect vizual
        const patGifs = [
            'https://media.giphy.com/media/109ltuoSQT212w/giphy.gif',
            'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif',
            'https://media.giphy.com/media/4HP0ddZnNVvKU/giphy.gif',
            'https://media.giphy.com/media/L2z7dnOduqEow/giphy.gif'
        ];
        const randomGif = patGifs[Math.floor(Math.random() * patGifs.length)];

        const patEmbed = new EmbedBuilder()
            .setColor(patConfig.color)
            .setTitle(patConfig.messages.success_title + ' 🫶')
            .setDescription(
                patConfig.messages.success_desc
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`)
            )
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();
        if (note) {
            patEmbed.addFields({ name: 'Note', value: `> ${note}` });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pat_return').setLabel('Pat back').setStyle(ButtonStyle.Secondary).setEmoji('🫶'),
            new ButtonBuilder().setCustomId('pat_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        const message = await interaction.reply({ embeds: [patEmbed], components: [row], ephemeral: isPrivate, fetchReply: true });

        const collector = message.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.customId === 'pat_close') {
                if (i.user.id !== sender.id && i.user.id !== receiver.id) {
                    await i.reply({ content: 'Only the sender or receiver can close this.', ephemeral: true });
                    return;
                }
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }

            if (i.customId === 'pat_return') {
                if (i.user.id !== receiver.id) {
                    await i.reply({ content: 'Only the mentioned member can pat back.', ephemeral: true });
                    return;
                }
                collector.stop('returned');
                const newGif = patGifs[Math.floor(Math.random() * patGifs.length)];
                const returned = new EmbedBuilder()
                    .setColor(patConfig.color)
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
