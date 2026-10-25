const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, MessageFlags } = require('discord.js');

// Enable User Install in the Developer Portal BEFORE copying this to commands/.
const COMMAND_NAME = 'personal-hello';

module.exports = {
    category: 'Examples',
    data: new SlashCommandBuilder()
        .setName(COMMAND_NAME)
        .setDescription('A command for a user-installed app.')
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
    async execute(interaction) {
        await interaction.reply({
            content: 'This command also works with user-installed Puro.',
            flags: MessageFlags.Ephemeral,
        });
    },
};
