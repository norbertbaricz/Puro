const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

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
        const hugConfig = config.commands.hug;

        if (sender.id === receiver.id) {
            return interaction.reply({ content: hugConfig.messages.self_hug, flags: MessageFlags.Ephemeral });
        }

        // Random hug GIFs
        const hugGifs = [
            'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
            'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif',
            'https://media.giphy.com/media/143v0Z4767T15e/giphy.gif',
            'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif'
        ];
        const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        const hugEmbed = new EmbedBuilder()
            .setColor(hugConfig.color)
            .setTitle(hugConfig.messages.success_title + ' 🤗')
            .setDescription(
                hugConfig.messages.success_desc
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`)
            )
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();

        if (note) {
            hugEmbed.addFields({ name: 'Note', value: `> ${note}` });
        }
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hug_return').setLabel('Return hug').setStyle(ButtonStyle.Secondary).setEmoji('🤗'),
            new ButtonBuilder().setCustomId('hug_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.reply({ embeds: [hugEmbed], components: [row], ...(isPrivate ? { flags: MessageFlags.Ephemeral } : {}) });
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
                const newGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];
                const returned = new EmbedBuilder()
                    .setColor(hugConfig.color)
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
