const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
                .setRequired(true)),

    async execute(interaction) {
        const config = interaction.client.config;
        const guessConfig = config.commands.guess;

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

        // MODIFICARE AICI: Am adăugat fetchReply: true și am stocat răspunsul
        const gameMessage = await interaction.reply({ embeds: [gameEmbed], fetchReply: true });

        const filter = m => m.author.id === player.id;
        // MODIFICARE AICI: Am folosit canalul din mesajul obținut
        const collector = gameMessage.channel.createMessageCollector({ filter, time: 120000 });

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
                    .setColor(config.colors.success)
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
                    .setColor(config.colors.error)
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