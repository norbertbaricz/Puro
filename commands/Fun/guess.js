const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('guess')
        .setDescription('Starts a number guessing minigame.')
        .addIntegerOption(option =>
            option.setName('min')
                .setDescription('The minimum value of the range.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('max')
                .setDescription('The maximum value of the range.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('chances')
                .setDescription('The number of attempts you have.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('If enabled, only you will see the game')
                .setRequired(false)
        ),

    async execute(interaction) {
        const config = interaction.client.config;
        const guessConfig = config.commands.guess;

        const min = interaction.options.getInteger('min');
        const max = interaction.options.getInteger('max');
        let chances = interaction.options.getInteger('chances');
        const isPrivate = interaction.options.getBoolean('private') || false;

        if (min >= max) {
            return interaction.reply({
                content: guessConfig.messages.invalid_range,
                flags: MessageFlags.Ephemeral
            });
        }
        if (chances <= 0) {
            return interaction.reply({
                content: guessConfig.messages.invalid_chances,
                flags: MessageFlags.Ephemeral
            });
        }

        const secretNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        const player = interaction.user;

        // State for dynamic range and hints
        let rangeMin = min;
        let rangeMax = max;
        let hintsUsed = 0;
        const maxHints = 2;

        const bar = (left, total) => {
            const blocks = 10;
            const filled = Math.max(0, Math.min(blocks, Math.round((left / total) * blocks)));
            return '█'.repeat(filled) + '░'.repeat(blocks - filled) + ` ${left}/${total}`;
        };

        const buildEmbed = (feedback = null, rerolls = 0) => new EmbedBuilder()
            .setColor(guessConfig.color)
            .setTitle(guessConfig.messages.title)
            .setDescription(
                guessConfig.messages.description
                    .replace('{user}', player.username)
                    .replace('{min}', rangeMin)
                    .replace('{max}', rangeMax)
                    .replace('{chances}', chances)
            )
            .addFields(
                { name: 'Attempts', value: bar(chances, interaction.options.getInteger('chances')), inline: false },
                { name: guessConfig.messages.prompt, value: guessConfig.messages.prompt_value, inline: false },
                ...(feedback ? [{ name: 'Hint', value: feedback, inline: false }] : []),
                { name: 'Hints used', value: `\`${hintsUsed}/${maxHints}\``, inline: true }
            )
            .setFooter({ text: guessConfig.messages.footer.replace('{userTag}', player.tag) })
            .setTimestamp();

        const row = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('guess_hint').setLabel('Hint (-1 attempt)').setStyle(ButtonStyle.Secondary).setEmoji('💡').setDisabled(hintsUsed >= maxHints || chances <= 1),
            new ButtonBuilder().setCustomId('guess_giveup').setLabel('Give up').setStyle(ButtonStyle.Danger).setEmoji('🏳️')
        );

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });
        let gameEmbed = buildEmbed();
        const reply = await interaction.editReply({ embeds: [gameEmbed], components: [row()] });

        const filter = m => m.author.id === player.id;
        const collector = reply.channel.createMessageCollector({ filter, time: 120000 });

        const updateGame = async (feedback = null) => {
            gameEmbed = buildEmbed(feedback);
            await interaction.editReply({ embeds: [gameEmbed], components: [row()] });
        };

        // Button collector
        const btnCollector = (await interaction.fetchReply()).createMessageComponentCollector({ time: 120000 });
        btnCollector.on('collect', async i => {
            if (i.user.id !== player.id) {
                await i.reply({ content: 'Only the game owner can use these buttons.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'guess_giveup') {
                collector.stop('giveup');
                btnCollector.stop('giveup');
                const loseEmbed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle(guessConfig.messages.lose_title)
                    .setDescription(guessConfig.messages.lose_description.replace('{secretNumber}', secretNumber));
                await i.update({ embeds: [loseEmbed], components: [] });
                return;
            }
            if (i.customId === 'guess_hint') {
                if (hintsUsed >= maxHints || chances <= 1) {
                    await i.deferUpdate();
                    return;
                }
                hintsUsed += 1;
                chances -= 1;
                const mid = Math.floor((rangeMin + rangeMax) / 2);
                let feedback;
                if (secretNumber > mid) {
                    rangeMin = mid + 1;
                    feedback = `Try higher than ${mid}.`;
                } else {
                    rangeMax = mid;
                    feedback = `Try lower than ${mid + 1}.`;
                }
                await i.deferUpdate();
                await updateGame(feedback);
                if (chances <= 0) {
                    collector.stop('depleted');
                    btnCollector.stop('depleted');
                }
            }
        });

        collector.on('collect', async m => {
            const guess = parseInt(m.content);
            await m.delete().catch(() => {});

            if (isNaN(guess)) {
                const msg = await interaction.followUp({ 
                    content: guessConfig.messages.invalid_guess.replace('{guess}', m.content), 
                    flags: MessageFlags.Ephemeral 
                });
                setTimeout(() => msg.delete?.().catch(() => {}), 2500);
                return;
            }

            chances--;

            if (guess === secretNumber) {
                const winEmbed = new EmbedBuilder()
                    .setColor(config.colors.success)
                    .setTitle(guessConfig.messages.win_title)
                    .setDescription(guessConfig.messages.win_description.replace('{secretNumber}', secretNumber));
                await interaction.editReply({ embeds: [winEmbed], components: [] });
                collector.stop('guessed');
                btnCollector.stop('guessed');
                return;
            } else if (guess < secretNumber) {
                rangeMin = Math.max(rangeMin, guess + 1);
                await updateGame(guessConfig.messages.hint_higher.replace('{chances}', chances));
            } else {
                rangeMax = Math.min(rangeMax, guess - 1);
                await updateGame(guessConfig.messages.hint_lower.replace('{chances}', chances));
            }

            if (chances <= 0) {
                const loseEmbed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle(guessConfig.messages.lose_title)
                    .setDescription(guessConfig.messages.lose_description.replace('{secretNumber}', secretNumber));
                await interaction.editReply({ embeds: [loseEmbed], components: [] });
                collector.stop('depleted');
                btnCollector.stop('depleted');
            }
        });

        const endGameTimeout = async () => {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle(guessConfig.messages.timeout)
                .setDescription(`The number was: **${secretNumber}**`);
            await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        };

        collector.on('end', async (_collected, reason) => {
            if (reason === 'time') await endGameTimeout();
        });
        btnCollector.on('end', async (_c, reason) => {
            if (reason === 'time') await endGameTimeout();
        });
    },
};
