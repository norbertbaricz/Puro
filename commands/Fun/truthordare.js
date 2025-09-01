const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('truthordare')
        .setDescription('Get a random truth or dare!')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Choose Truth, Dare or Random')
                .addChoices(
                    { name: 'Random', value: 'random' },
                    { name: 'Truth', value: 'truth' },
                    { name: 'Dare', value: 'dare' }
                )
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('Optionally tag someone to answer/do the dare')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('Only you see the prompt')
                .setRequired(false)
        ),
    async execute(interaction) {
        const config = interaction.client.config;
        const todConfig = config.commands.truthordare;

        const mode = interaction.options.getString('mode') || 'random';
        const target = interaction.options.getUser('target') || interaction.user;
        const isPrivate = interaction.options.getBoolean('private') || false;

        const pick = (truth) => truth
            ? todConfig.truths[Math.floor(Math.random() * todConfig.truths.length)]
            : todConfig.dares[Math.floor(Math.random() * todConfig.dares.length)];

        const build = (truth, rerolls) => new EmbedBuilder()
            .setColor(truth ? todConfig.color_truth : todConfig.color_dare)
            .setTitle(truth ? todConfig.messages.truth_title : todConfig.messages.dare_title)
            .setDescription(`${target}: ${pick(truth)}`)
            .setFooter({ text: `${todConfig.messages.footer.replace('{user}', interaction.user.tag)}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        let truth = mode === 'random' ? Math.random() < 0.5 : mode === 'truth';
        let rerolls = 0;

        const row = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tod_switch').setLabel(truth ? 'Switch to Dare' : 'Switch to Truth').setStyle(ButtonStyle.Primary).setEmoji('🔁'),
            new ButtonBuilder().setCustomId('tod_another').setLabel('Another').setStyle(ButtonStyle.Secondary).setEmoji('🎲').setDisabled(rerolls >= 3),
            new ButtonBuilder().setCustomId('tod_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        await interaction.editReply({ embeds: [build(truth, rerolls)], components: [row()] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'tod_close') {
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(row().components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }
            if (i.customId === 'tod_switch') {
                truth = !truth;
                await i.update({ embeds: [build(truth, rerolls)], components: [row()] });
                return;
            }
            if (i.customId === 'tod_another') {
                rerolls += 1;
                await i.update({ embeds: [build(truth, rerolls)], components: [row()] });
                return;
            }
        });

        collector.on('end', async (_c, reason) => {
            if (reason === 'time') {
                const disabled = new ActionRowBuilder().addComponents(row().components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ components: [disabled] }).catch(() => {});
            }
        });
    }
};
