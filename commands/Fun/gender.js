const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('gender')
        .setDescription('Randomly shows what gender/sexuality a member is and the percentage (for fun)!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to check (optional, defaults to you)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('If enabled, only you will see the result')
                .setRequired(false)
        ),
    async execute(interaction) {
        const config = interaction.client.config;
        const genderConfig = config.commands.gender;

        const targetMember = interaction.options.getMember('member') || interaction.member;
        const isPrivate = interaction.options.getBoolean('private') || false;

        if (!targetMember || !targetMember.user) {
            return interaction.reply({ content: genderConfig.messages.not_found, flags: MessageFlags.Ephemeral });
        }

        const identities = genderConfig.identities;
        const pick = () => identities[Math.floor(Math.random() * identities.length)];
        const randomPercent = () => Math.floor(Math.random() * 101);
        const bar = (pct) => {
            const blocks = 10;
            const filled = Math.round((pct / 100) * blocks);
            return '█'.repeat(filled) + '░'.repeat(blocks - filled) + ` ${pct}%`;
        };

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const render = async (rerolls = 0) => {
            const identity = pick();
            const percentage = randomPercent();
            const embed = new EmbedBuilder()
                .setTitle(genderConfig.title)
                .setDescription(
                    genderConfig.description
                        .replace('{member}', targetMember)
                        .replace('{percentage}', percentage)
                        .replace('{identity}', identity.label)
                )
                .setColor(identity.color)
                .addFields({ name: 'Meter', value: bar(percentage), inline: false })
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true, size: 4096 }))
                .setFooter({ text: `Requested by ${interaction.user.tag}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('gender_reroll').setLabel('Reroll').setStyle(ButtonStyle.Secondary).setEmoji('🎲').setDisabled(rerolls >= 3),
                new ButtonBuilder().setCustomId('gender_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'gender_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'gender_reroll') {
                    collector.stop('reroll');
                    await i.deferUpdate();
                    const rolling = new EmbedBuilder()
                        .setColor(identity.color)
                        .setTitle('🎲 Recalculating...')
                        .setDescription('Consulting the rainbow spirits...')
                        .setTimestamp();
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ embeds: [rolling], components: [disabled] });
                    setTimeout(() => render(rerolls + 1), 800);
                }
            });

            collector.on('end', async (_c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        };

        setTimeout(() => render(0), 300);
    }
};
