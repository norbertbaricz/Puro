const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the Magic 8-Ball a question and receive a mysterious answer.')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The yes/no question you want to ask.')
                .setRequired(true)),

    async execute(interaction) {
        const config = interaction.client.config.commands.eightball;

        try {
            const question = interaction.options.getString('question');

            const allAnswers = [
                ...config.answers.affirmative,
                ...config.answers.non_committal,
                ...config.answers.negative
            ];
            
            const randomAnswer = allAnswers[Math.floor(Math.random() * allAnswers.length)];

            // Creăm embed-ul cu designul recomandat (minimalist și modern)
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(config.messages.title)
                .setThumbnail(config.image_url) // Imaginea va apărea ca un thumbnail
                .setDescription(
                    `**❓ ${config.messages.question_field}:**\n*${question}*\n\n` + // \n\n adaugă un rând gol pentru spațiere
                    `**🎱 ${config.messages.answer_field}:**\n# ${randomAnswer}` // '#' face textul mare (Markdown H1)
                )
                .setFooter({
                    text: `Asked by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('8ball command error:', error);
            await interaction.reply({ content: config.messages.error, ephemeral: true });
        }
    },
};