const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers), // Permisiune corectă

    async execute(interaction) {
        // Verifică permisiunile utilizatorului
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        
        // Verifică permisiunile bot-ului
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'I do not have permission to kick members.', ephemeral: true });
        }

        const member = interaction.options.getMember('member');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member) {
            return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
        }
        
        if (member.id === interaction.client.user.id) {
            return interaction.reply({ content: 'I cannot kick myself.', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this member. They may have a higher role than me or I lack permissions.', ephemeral: true });
        }

        try {
            await member.kick(reason);

            const embed = new EmbedBuilder()
                .setTitle('Member Kicked')
                .setColor(0xff0000) // Red
                .addFields(
                    { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
                    { name: 'Kicked by', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Guild: ${interaction.guild.name}` });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(`Failed to kick member ${member.user.tag}:`, error);
            await interaction.reply({ content: `An error occurred while trying to kick the member: ${error.message}`, ephemeral: true });
        }
    }
};