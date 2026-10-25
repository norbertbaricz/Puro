const { ContextMenuCommandBuilder, ApplicationCommandType, MessageFlags } = require('discord.js');

// Copy to commands/Examples/inspect-user.js. User and message menus are supported.
const COMMAND_NAME = 'Inspect user';

module.exports = {
    category: 'Examples',
    data: new ContextMenuCommandBuilder().setName(COMMAND_NAME).setType(ApplicationCommandType.User),
    async execute(interaction) {
        await interaction.reply({
            content: `User: ${interaction.targetUser.tag}\nID: ${interaction.targetUser.id}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
