const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Premium',
    data: new SlashCommandBuilder()
        .setName('howl-greeting')
        .setDescription('Premium greeting for The Wolf Den pack members.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Optional member to highlight in the howl')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Send the howl privately (ephemeral reply)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('member') || interaction.user;
        const isPrivate = interaction.options.getBoolean('private') || false;

        const embed = new EmbedBuilder()
            .setColor('#ff1493')
            .setTitle('🐺 Premium Howl')
            .setDescription(`The pack gathers and howls for ${target}!`)
            .setFooter({ text: 'The Wolf Den • Premium vibes only' })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: isPrivate ? MessageFlags.Ephemeral : undefined,
        });
    },
};
