const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Special',
    data: new SlashCommandBuilder()
        .setName('cave-briefing')
        .setDescription('Generate a mission briefing.')
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
            .setDescription(`Mission dossier unlocked for **${mission}**. Gear up.`)
            .setFooter({ text: 'Stay sharp' })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: isPrivate ? MessageFlags.Ephemeral : undefined,
        });
    },
};
