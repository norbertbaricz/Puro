const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Propose marriage to another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to marry')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Add a short proposal note (optional)')
                .setMaxLength(200)
                .setRequired(false)
        ),
    async execute(interaction) {
        const proposer = interaction.user;
        const target = interaction.options.getUser('member');
        const config = interaction.client.config;
        const marryConfig = config.commands.marry;
        const globalColors = interaction.client.config.colors || {};
        const note = (interaction.options.getString('note') || '').trim();

        if (proposer.id === target.id) {
            return interaction.reply({ content: marryConfig.messages.self_marry, ephemeral: true });
        }
        if (target.bot) {
            return interaction.reply({ content: 'You cannot marry a bot. 🤖', ephemeral: true });
        }

        const responses = marryConfig.messages.responses;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
            .replace('{proposer}', proposer.username)
            .replace('{target}', target.username);

        const baseEmbed = new EmbedBuilder()
            .setColor(marryConfig.color)
            .setTitle(marryConfig.messages.title)
            .setDescription(randomResponse + (note ? `\n\nNote: ${note}` : ''))
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: `Proposal by ${proposer.tag}`, iconURL: proposer.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('marry_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('💍'),
            new ButtonBuilder().setCustomId('marry_decline').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('💔')
        );

        const msg = await interaction.reply({ embeds: [baseEmbed], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 30_000 });

        collector.on('collect', async i => {
            if (i.user.id !== target.id) {
                await i.reply({ content: 'Only the proposed member can respond to this.', ephemeral: true });
                return;
            }

            if (i.customId === 'marry_accept') {
                collector.stop('accepted');
                const accepted = EmbedBuilder.from(baseEmbed)
                    .setColor(globalColors.success || '#00ff00')
                    .setDescription(`💍 ${target} said YES to ${proposer}! Congratulations!` + (note ? `\n\nNote: ${note}` : ''))
                    .setThumbnail(null);
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [accepted], components: [disabled] });
                return;
            }

            if (i.customId === 'marry_decline') {
                collector.stop('declined');
                const declined = EmbedBuilder.from(baseEmbed)
                    .setColor(globalColors.error || '#ff0000')
                    .setDescription(`💔 ${target} declined the proposal from ${proposer}.`)
                    .setThumbnail(null);
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [declined], components: [disabled] });
                return;
            }
        });

        collector.on('end', async (_c, reason) => {
            if (reason === 'time') {
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                const timeoutEmbed = EmbedBuilder.from(baseEmbed)
                    .setColor('#ffd700')
                    .setDescription(`⏳ ${target} did not respond in time. Proposal pending.`);
                await interaction.editReply({ embeds: [timeoutEmbed], components: [disabled] }).catch(() => {});
            }
        });
    }
};
