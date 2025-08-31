const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('divorce')
        .setDescription('Role-play a divorce with another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to divorce')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Optional reason for the divorce')
                .setMaxLength(200)
                .setRequired(false)
        ),
    async execute(interaction) {
        const initiator = interaction.user;
        const target = interaction.options.getUser('member');
        const reason = interaction.options.getString('reason') || null;
        const config = interaction.client.config;
        const divorceConfig = config.commands.divorce;

        if (initiator.id === target.id) {
            return interaction.reply({ content: divorceConfig.messages.self_divorce, ephemeral: true });
        }
        if (target.bot) {
            return interaction.reply({ content: 'You cannot divorce a bot. 🤖', ephemeral: true });
        }

        const responses = divorceConfig.messages.responses;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
            .replace('{initiator}', initiator.username)
            .replace('{target}', target.username);

        const baseEmbed = new EmbedBuilder()
            .setColor(divorceConfig.color)
            .setTitle(divorceConfig.messages.title)
            .setDescription(randomResponse + (reason ? `\n\nReason: ${reason}` : ''))
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: `Divorce initiated by ${initiator.tag}`, iconURL: initiator.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('divorce_confirm').setLabel('Confirm Divorce').setStyle(ButtonStyle.Danger).setEmoji('💔'),
            new ButtonBuilder().setCustomId('divorce_cancel').setLabel('Stay Together').setStyle(ButtonStyle.Success).setEmoji('💞')
        );

        const message = await interaction.reply({ embeds: [baseEmbed], components: [row], fetchReply: true });

        const collector = message.createMessageComponentCollector({ time: 30_000 });

        collector.on('collect', async i => {
            if (i.user.id !== target.id) {
                await i.reply({ content: 'Only the mentioned member can respond to this.', ephemeral: true });
                return;
            }

            if (i.customId === 'divorce_confirm') {
                collector.stop('confirmed');
                const confirmed = EmbedBuilder.from(baseEmbed)
                    .setColor('#808080')
                    .setDescription(`💔 ${target} agreed to the divorce from ${initiator}.${reason ? `\n\nReason: ${reason}` : ''}`)
                    .setThumbnail(null);
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [confirmed], components: [disabled] });
                return;
            }

            if (i.customId === 'divorce_cancel') {
                collector.stop('cancelled');
                const cancelled = EmbedBuilder.from(baseEmbed)
                    .setColor('#00ff7f')
                    .setDescription(`💞 ${target} chose to stay with ${initiator}. Love prevails!`)
                    .setThumbnail(null);
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [cancelled], components: [disabled] });
                return;
            }
        });

        collector.on('end', async (_c, reasonEnd) => {
            if (reasonEnd === 'time') {
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                const timeoutEmbed = EmbedBuilder.from(baseEmbed)
                    .setColor('#ffd700')
                    .setDescription(`⏳ ${target} did not respond in time. The divorce is pending.`);
                await interaction.editReply({ embeds: [timeoutEmbed], components: [disabled] }).catch(() => {});
            }
        });
    }
};
