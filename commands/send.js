const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send a DM to a user')
        .addUserOption(option =>
            option.setName('user')
            .setDescription('The user to DM')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
            .setDescription('The message to send')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Permission required to use the command

    async execute(interaction) {
        const remaining = ratelimit(interaction.user.id, 5000);
        if (remaining) {
            return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
        }

        // Assumes config.yml is loaded into interaction.client.config
        const configPath = interaction.client.config.commands.send;
        const configMessages = configPath && configPath.messages ? configPath.messages : {};

        // Define messages with English defaults, which will be overridden by config.yml if keys exist
        const messages = {
            no_permission: configMessages.no_permission || "You do not have permission to use this command.",
            success: configMessages.success || "Successfully sent a DM to {user}.",
            error: configMessages.error || "Could not process the send command for {user}.", // General command error for a user
            error_generic: configMessages.error_generic || "An unexpected error occurred.", // Generic fallback
            cannot_dm_user: configMessages.cannot_dm_user || "Could not send a DM to {user}. They may have DMs disabled, server privacy settings, or the bot is blocked.",
            dm_fail: configMessages.dm_fail || "Failed to send the DM to {user} due to an unknown issue.",
            user_not_found: configMessages.user_not_found || "The specified user could not be found.",
        };

        let targetUser;

        try {
            // Check if the interaction is in a server
            if (!interaction.inGuild()) {
                return interaction.reply({ content: "This command can only be used within a server.", ephemeral: true });
            }

            // Permission check (redundant if setDefaultMemberPermissions works correctly, but good for safety)
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: messages.no_permission, ephemeral: true });
            }

            targetUser = interaction.options.getUser('user');
            const messageContent = interaction.options.getString('message');

            if (!targetUser) {
                // Should be prevented by .setRequired(true)
                return interaction.reply({ content: messages.user_not_found, ephemeral: true });
            }

            try {
                // Attempt to send the DM
                await targetUser.send(messageContent);
                // Confirm success to the command initiator
                await interaction.reply({
                    content: messages.success.replace('{user}', targetUser.tag),
                    ephemeral: true
                });
            } catch (dmError) {
                // This block is entered if targetUser.send() fails
                console.error(`Error sending DM to ${targetUser.tag} (ID: ${targetUser.id}):`, dmError); // Logs the full error to console

                let dmErrorMessage;
                if (dmError.code === 50007) { // Specific code for "Cannot send messages to this user"
                    dmErrorMessage = messages.cannot_dm_user.replace('{user}', targetUser.tag);
                } else {
                    // For other types of errors when sending DM
                    dmErrorMessage = messages.dm_fail.replace('{user}', targetUser.tag);
                }

                // Send feedback to the command initiator
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: dmErrorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: dmErrorMessage, ephemeral: true });
                }
            }

        } catch (error) {
            // This block is for other errors (e.g., issues reading options, permissions, etc.)
            console.error('Error in send command execution:', error); // Logs the full error to console

            let finalErrorMessage = messages.error_generic; // Default generic message
            const attemptedTargetUser = interaction.options.getUser('user'); // Try to get the user for the error message

            if (attemptedTargetUser) {
                // Uses messages.error (which will take your YAML value if attemptedTargetUser is valid)
                finalErrorMessage = messages.error.replace('{user}', attemptedTargetUser.tag);
            }

            // Send feedback to the command initiator
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: finalErrorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: finalErrorMessage, ephemeral: true });
            }
        }
    },
};