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
        .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),

    async execute(interaction) {
        const config = interaction.client.config.commands.kick || {};
        const messages = config.messages || {};

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: messages.no_permission || 'You do not have permission to use this command.', ephemeral: true });
        }
        
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: messages.bot_no_permission || 'I do not have permission to kick members.', ephemeral: true });
        }

        const member = interaction.options.getMember('member');
        const reason = interaction.options.getString('reason') || messages.no_reason || 'No reason provided';

        if (!member) {
            return interaction.reply({ content: messages.user_not_found || 'That user is not in this server.', ephemeral: true });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({ content: messages.cannot_kick_self || 'You cannot kick yourself.', ephemeral: true });
        }
        
        if (member.id === interaction.client.user.id) {
            return interaction.reply({ content: messages.cannot_kick_bot || 'I cannot kick myself.', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({ content: messages.cannot_kick_member || 'I cannot kick this member.', ephemeral: true });
        }

        try {
            await member.kick(reason);

            const embed = new EmbedBuilder()
                .setTitle(messages.success_title || 'Member Kicked')
                .setColor(config.color || 0xff0000)
                .addFields(
                    { name: messages.field_user || 'User', value: `${member.user.tag} (${member.id})`, inline: true },
                    { name: messages.field_kicked_by || 'Kicked by', value: `${interaction.user.tag}`, inline: true },
                    { name: messages.field_reason || 'Reason', value: reason, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: (messages.footer || 'Guild: {guildName}').replace('{guildName}', interaction.guild.name) });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(`Failed to kick member ${member.user.tag}:`, error);
            await interaction.reply({ content: (messages.error || 'An error occurred: {error}').replace('{error}', error.message), ephemeral: true });
        }
    }
};