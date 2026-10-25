const { accentColor } = require('../../src/core/ui/theme');
const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    InteractionContextType,
} = require('discord.js');

// Tune the cooldown here; colors come from ui.accent or config/commands/ping.yml.
const COOLDOWN_SECONDS = 2;

module.exports = {
    category: 'Info',
    cooldown: COOLDOWN_SECONDS,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check Puro latency and hot-reload status.')
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
        .addBooleanOption((option) => option.setName('private').setDescription('Show the response only to you.')),
    async execute(interaction) {
        const { client } = interaction;
        const gateway = client.ws.ping >= 0 ? `${Math.round(client.ws.ping)} ms` : 'Warming up';
        const latency = Math.max(0, Date.now() - interaction.createdTimestamp);
        const container = new ContainerBuilder()
            .setAccentColor(accentColor(client, client.config.commands?.ping?.color))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Pong!\n**Gateway:** ${gateway}\n**Interaction age:** ${latency} ms\n**Active modules:** ${client.plugins.records.size}\n**Hot reload:** ${client.plugins.watcher ? 'Enabled' : 'Disabled'}`,
                ),
            );
        await interaction.reply({
            components: [container],
            flags:
                MessageFlags.IsComponentsV2 | (interaction.options.getBoolean('private') ? MessageFlags.Ephemeral : 0),
        });
    },
};
