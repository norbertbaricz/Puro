const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Displays user avatar')
        .addUserOption(option => 
            option.setName('user').setDescription('The user').setRequired(true))
        .addBooleanOption(option =>
            option.setName('server').setDescription('Show server avatar').setRequired(false)),
    
    async execute(interaction) {
        const config = interaction.client.config.commands.avatar;
        try {
            const user = interaction.options.getUser('user');
            const showServerAvatar = interaction.options.getBoolean('server') ?? false;
            
            const member = showServerAvatar && interaction.guild 
                ? await interaction.guild.members.fetch(user.id)
                : null;

            const avatarUrl = member?.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }) 
                || user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });

            const avatarEmbed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`${user.username}'s ${showServerAvatar && member?.avatar ? 'Server ' : ''}Avatar`)
                .setImage(avatarUrl)
                .setFooter({ text: `Requested by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [avatarEmbed] });
        } catch (error) {
            console.error('Avatar error:', error);
            await interaction.reply({ content: config.messages.error, ephemeral: true });
        }
    },
};