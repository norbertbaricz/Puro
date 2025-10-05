const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Premium',
    data: new SlashCommandBuilder()
        .setName('cave-briefing')
        .setDescription("Premium mission briefing for Spencer's Cave.")
        .addStringOption(option =>
            option.setName('mission')
                .setDescription('Name or code of the mission')
                .setMaxLength(100)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const mission = interaction.options.getString('mission') || 'Operation Stalactite';
        const isPrivate = interaction.options.getBoolean('private') || false;

        const embed = new EmbedBuilder()
            .setColor('#1abc9c')
            .setTitle('🕳️ Cave Briefing')
            .setDescription(`Premium dossier unlocked for **${mission}**. Gear up, Spencer's Cave!`)
            .setFooter({ text: "Spencer's Cave • Premium" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: isPrivate ? MessageFlags.Ephemeral : undefined,
        });
    },
};
