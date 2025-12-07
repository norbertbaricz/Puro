const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Flip a coin')
        .addIntegerOption(option =>
            option.setName('flips').setDescription('Number of flips (max 10)').setMinValue(1).setMaxValue(10).setRequired(false))
        .addStringOption(option =>
            option
                .setName('call')
                .setDescription('Call the result (optional)')
                .addChoices(
                    { name: 'Heads', value: 'Heads' },
                    { name: 'Tails', value: 'Tails' }
                )
                .setRequired(false))
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('If enabled, only you will see the result')
                .setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.coinflip;
        try {
            const flipsRequested = interaction.options.getInteger('flips') || 1;
            const flips = Math.min(flipsRequested, interaction.client.config.limits.flips);
            const call = interaction.options.getString('call');
            const isPrivate = interaction.options.getBoolean('private') || false;

            const doFlips = (n) => Array(n).fill(0).map(() => Math.random() < 0.5 ? 'Heads' : 'Tails');

            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            const suspense = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('🪙 Flipping...')
                .setDescription('The coin spins in the air!')
                .setTimestamp();
            await interaction.editReply({ embeds: [suspense], components: [] });

            const handleInteractionError = async (error, componentInteraction) => {
                if (error?.code === 10062 || error?.rawError?.code === 10062) {
                    return;
                }
                console.error('Coinflip interaction error:', error);
                if (componentInteraction && !componentInteraction.replied && !componentInteraction.deferred) {
                    await componentInteraction.reply({ content: config.messages.error, flags: MessageFlags.Ephemeral }).catch(() => {});
                }
            };

            const scheduleRender = (nextRerolls) => {
                setTimeout(async () => {
                    try {
                        await render(nextRerolls);
                    } catch (error) {
                        await handleInteractionError(error);
                    }
                }, 800);
            };

            const render = async (rerolls = 0) => {
                const results = doFlips(flips);
                const heads = results.filter(r => r === 'Heads').length;
                const tails = flips - heads;
                const resultLines = results.map((r, idx) => `${idx + 1}. ${config.emojis?.[r.toLowerCase()] || ''} ${r}`).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(config.color)
                    .setTitle(`🪙 Coin Flip ${flips > 1 ? 'Results' : 'Result'}`)
                    .setDescription(resultLines)
                    .setFooter({ text: `${interaction.user.tag}${rerolls ? ` • Rerolls: ${rerolls}` : ''}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp();

                if (flips > 1) {
                    embed.addFields({
                        name: 'Statistics',
                        value: `Heads: ${heads} (${((heads / flips) * 100).toFixed(1)}%)\nTails: ${tails} (${((tails / flips) * 100).toFixed(1)}%)`,
                        inline: true
                    });
                }

                if (call) {
                    const normalized = call === 'Heads' ? 'Heads' : 'Tails';
                    const matches = results.filter(r => r === normalized).length;
                    if (flips === 1) {
                        const won = results[0] === normalized;
                        embed.addFields({
                            name: 'Your Call',
                            value: `${config.emojis?.[normalized.toLowerCase()] || ''} ${normalized} — ${won ? 'You win! ✅' : 'You lose. ❌'}`,
                            inline: true
                        });
                    } else {
                        embed.addFields(
                            { name: 'Your Call', value: `${config.emojis?.[normalized.toLowerCase()] || ''} ${normalized}`, inline: true },
                            { name: 'Matches', value: `${matches} / ${flips}`, inline: true }
                        );
                    }
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('coin_reroll').setLabel('Flip again').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(rerolls >= 3),
                    new ButtonBuilder().setCustomId('coin_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                await interaction.editReply({ embeds: [embed], components: [row] });

                const msg = await interaction.fetchReply();
                const collector = msg.createMessageComponentCollector({ time: 30000 });

                collector.on('collect', async i => {
                    try {
                        if (i.user.id !== interaction.user.id) {
                            await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        if (i.customId === 'coin_close') {
                            collector.stop('closed');
                            const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                            await i.deferUpdate();
                            await interaction.editReply({ components: [disabled] });
                            return;
                        }
                        if (i.customId === 'coin_reroll') {
                            collector.stop('reroll');
                            await i.deferUpdate();
                            const rolling = new EmbedBuilder()
                                .setColor(config.color)
                                .setTitle('🪙 Flipping again...')
                                .setDescription('The coin spins once more!')
                                .setTimestamp();
                            const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                            await interaction.editReply({ embeds: [rolling], components: [disabled] });
                            scheduleRender(rerolls + 1);
                            return;
                        }
                    } catch (error) {
                        await handleInteractionError(error, i);
                    }
                });

                collector.on('end', async (_c, reason) => {
                    if (reason === 'time') {
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ components: [disabled] }).catch(() => {});
                    }
                });
            };

            scheduleRender(0);
        } catch (error) {
            console.error('Coinflip error:', error);
            await interaction.reply({ content: config.messages.error, flags: MessageFlags.Ephemeral });
        }
    },
};
