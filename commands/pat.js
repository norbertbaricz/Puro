const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('Pat another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to pat')
                .setRequired(true)),
    async execute(interaction) {
        const remaining = ratelimit(interaction.user.id, 5000);
        if (remaining) {
            return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
        }
        
        const sender = interaction.user;
        const receiver = interaction.options.getUser('member');
        const config = interaction.client.config;
        const patConfig = config.commands.pat;

        if (sender.id === receiver.id) {
            return interaction.reply({ content: patConfig.messages.self_pat, ephemeral: true });
        }

        // Poți adăuga un GIF random dintr-o listă pentru efect vizual
        const patGifs = [
            'https://media.giphy.com/media/109ltuoSQT212w/giphy.gif',
            'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif',
            'https://media.giphy.com/media/4HP0ddZnNVvKU/giphy.gif',
            'https://media.giphy.com/media/L2z7dnOduqEow/giphy.gif'
        ];
        const randomGif = patGifs[Math.floor(Math.random() * patGifs.length)];

        const patEmbed = new EmbedBuilder()
            .setColor(patConfig.color)
            .setTitle(patConfig.messages.success_title + ' 🫶')
            .setDescription(
                patConfig.messages.success_desc
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`)
            )
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [patEmbed] });
    }
};