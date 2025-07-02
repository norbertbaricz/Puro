const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send a DM to a user or everyone in the server')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to DM')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const configPath = interaction.client.config.commands.send;
        const configMessages = configPath && configPath.messages ? configPath.messages : {};

        const messages = {
            no_permission: configMessages.no_permission || "You do not have permission to use this command.",
            success: configMessages.success || "Successfully sent a DM to {user}.",
            success_all: configMessages.success_all || "Successfully sent a DM to {count} users.",
            error: configMessages.error || "Could not process the send command for {user}.",
            error_generic: configMessages.error_generic || "An unexpected error occurred.",
            cannot_dm_user: configMessages.cannot_dm_user || "Could not send a DM to {user}. They may have DMs disabled, server privacy settings, or the bot is blocked.",
            dm_fail: configMessages.dm_fail || "Failed to send the DM to {user} due to an unknown issue.",
            user_not_found: configMessages.user_not_found || "The specified user could not be found.",
        };

        try {
            if (!interaction.inGuild()) {
                return interaction.reply({ content: "This command can only be used within a server.", flags: 64 });
            }

            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: messages.no_permission, flags: 64 });
            }

            const targetUser = interaction.options.getUser('user');
            const messageContent = interaction.options.getString('message');

            if (targetUser) {
                try {
                    await targetUser.send(messageContent);
                    const embed = new EmbedBuilder()
                        .setTitle('DM Sent')
                        .setDescription(messages.success.replace('{user}', targetUser.tag))
                        .setColor(0x00b300);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                } catch (dmError) {
                    let dmErrorMessage;
                    if (dmError.code === 50007) {
                        dmErrorMessage = messages.cannot_dm_user.replace('{user}', targetUser.tag);
                    } else {
                        dmErrorMessage = messages.dm_fail.replace('{user}', targetUser.tag);
                    }
                    const embed = new EmbedBuilder()
                        .setTitle('DM Failed')
                        .setDescription(dmErrorMessage)
                        .setColor(0xff0000);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
            } else {
                await interaction.deferReply({ flags: 64 });
                const members = await interaction.guild.members.fetch();
                let sentCount = 0;
                let failedCount = 0;
                for (const member of members.values()) {
                    if (member.user.bot) continue;
                    try {
                        await member.send(messageContent);
                        sentCount++;
                    } catch {
                        failedCount++;
                    }
                }
                const embed = new EmbedBuilder()
                    .setTitle('DM Broadcast')
                    .setDescription(messages.success_all.replace('{count}', sentCount))
                    .setColor(0x00b300)
                    .addFields(
                        { name: 'Success', value: `${sentCount}`, inline: true },
                        { name: 'Failed', value: `${failedCount}`, inline: true }
                    );
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in send command execution:', error);
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription(messages.error_generic)
                .setColor(0xff0000);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], flags: 64 });
            } else {
                await interaction.reply({ embeds: [embed], flags: 64 });
            }
        }
    },
};