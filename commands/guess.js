const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
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
                .setRequired(true)),

    async execute(interaction) {
        const remaining = ratelimit(interaction.user.id, 5000);
        if (remaining) {
            return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
        }

        // Access config from the client object, assuming it's attached in your main bot file
        const config = interaction.client.config;
        const guessConfig = config.commands.guess; // Shorthand for guess command config

        const min = interaction.options.getInteger('min');
        const max = interaction.options.getInteger('max');
        let chances = interaction.options.getInteger('chances');

        if (min >= max) {
            return interaction.reply({
                content: guessConfig.messages.invalid_range,
                ephemeral: true
            });
        }
        if (chances <= 0) {
            return interaction.reply({
                content: guessConfig.messages.invalid_chances,
                ephemeral: true
            });
        }

        const secretNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        const player = interaction.user;

        const gameEmbed = new EmbedBuilder()
            .setColor(guessConfig.color)
            .setTitle(guessConfig.messages.title)
            .setDescription(
                guessConfig.messages.description
                    .replace('{user}', player.username)
                    .replace('{min}', min)
                    .replace('{max}', max)
                    .replace('{chances}', chances)
            )
            .addFields({ name: guessConfig.messages.prompt, value: guessConfig.messages.prompt_value })
            .setFooter({ text: guessConfig.messages.footer.replace('{userTag}', player.tag) })
            .setTimestamp();

        await interaction.reply({ embeds: [gameEmbed] });

        const filter = m => m.author.id === player.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 120000 }); // 2-minute timer

        collector.on('collect', m => {
            const guess = parseInt(m.content);

            if (isNaN(guess)) {
                interaction.followUp({ 
                    content: guessConfig.messages.invalid_guess.replace('{guess}', m.content), 
                    ephemeral: true 
                });
                return;
            }
            
            chances--;

            if (guess === secretNumber) {
                const winEmbed = new EmbedBuilder()
                    .setColor(config.colors.success) // Use global success color
                    .setTitle(guessConfig.messages.win_title)
                    .setDescription(guessConfig.messages.win_description.replace('{secretNumber}', secretNumber));
                
                interaction.followUp({ embeds: [winEmbed] });
                collector.stop('guessed');
                return;
            } else if (guess < secretNumber) {
                interaction.followUp(guessConfig.messages.hint_higher.replace('{chances}', chances));
            } else {
                interaction.followUp(guessConfig.messages.hint_lower.replace('{chances}', chances));
            }

            if (chances <= 0) {
                const loseEmbed = new EmbedBuilder()
                    .setColor(config.colors.error) // Use global error color
                    .setTitle(guessConfig.messages.lose_title)
                    .setDescription(guessConfig.messages.lose_description.replace('{secretNumber}', secretNumber));

                interaction.followUp({ embeds: [loseEmbed] });
                collector.stop('depleted');
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.followUp({ content: guessConfig.messages.timeout });
            }
        });
    },
};