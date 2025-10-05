const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Premium',
    data: new SlashCommandBuilder()
        .setName('directors-cut')
        .setDescription("Premium spotlight for Mastera's Animation Empire.")
        .addStringOption(option =>
            option.setName('scene')
                .setDescription('Name of the scene or project to feature')
                .setMaxLength(100)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const scene = interaction.options.getString('scene') || 'today\'s masterpiece';
        const isPrivate = interaction.options.getBoolean('private') || false;

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle("🎬 Director's Cut")
            .setDescription(`Exclusive preview for ${scene} — available only to Mastera's Animation Empire premium members.`)
            .setFooter({ text: "Mastera's Animation Empire • Premium" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: isPrivate ? MessageFlags.Ephemeral : undefined,
        });
    },
};
