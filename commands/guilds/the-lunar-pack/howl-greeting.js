const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Special',
    data: new SlashCommandBuilder()
        .setName('howl-greeting')
        .setDescription('Send a dramatic howl greeting.')
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
            .setTitle('🐺 Howl Greeting')
            .setDescription(`The pack gathers and howls for ${target}!`)
            .setFooter({ text: 'Pack energy activated' })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: isPrivate ? MessageFlags.Ephemeral : undefined,
        });
    },
};
