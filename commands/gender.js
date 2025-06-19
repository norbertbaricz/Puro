const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gender')
        .setDescription('Randomly shows what gender/sexuality a member is and the percentage (for fun)!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to check')
                .setRequired(true)),
    async execute(interaction) {
        const config = interaction.client.config;
        const genderConfig = config.commands.gender;

        const member = interaction.options.getMember('member');
        if (!member) {
            return interaction.reply({ content: genderConfig.messages.not_found, ephemeral: true });
        }

        const identities = genderConfig.identities;
        const identity = identities[Math.floor(Math.random() * identities.length)];
        const percentage = Math.floor(Math.random() * 101);

        const embed = new EmbedBuilder()
            .setTitle(genderConfig.title)
            .setDescription(
                genderConfig.description
                    .replace('{member}', member)
                    .replace('{percentage}', percentage)
                    .replace('{identity}', identity.label)
            )
            .setColor(identity.color)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};