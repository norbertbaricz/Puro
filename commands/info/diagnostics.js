const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');

// Diagnostics are always private and restricted to runtime.owner_ids.
const MAX_ERRORS_SHOWN = 8;
const MAX_LINE_LENGTH = 220;

module.exports = {
    category: 'Info',
    ownerOnly: true,
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('diagnostics')
        .setDescription('Bot owner: inspect loaded modules and command synchronization.'),
    async execute(interaction) {
        const client = interaction.client;
        const details = [...client.plugins.details.values()];
        const failures = details.filter((detail) => detail.status === 'error');
        const lines = failures
            .slice(-MAX_ERRORS_SHOWN)
            .map((detail) => `- ${detail.file}: ${detail.message}`.slice(0, MAX_LINE_LENGTH));
        const sync = client.registrationStatus;
        const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const text = [
            '## Puro diagnostics',
            `**Modules:** ${client.plugins.records.size} active · ${failures.length} load errors`,
            `**Commands executed:** ${client.healthMonitor?.metrics.commandsExecuted || 0}`,
            `**Memory:** ${memory} MiB heap · **Uptime:** ${Math.floor(process.uptime())}s`,
            `**Hot reload:** ${client.plugins.watcher ? 'Enabled' : 'Disabled'}`,
            `**Discord synchronization:** ${sync?.status || 'pending'}`,
            ...(sync?.errors || []).slice(0, 3).map((error) => `- ${error}`.slice(0, MAX_LINE_LENGTH)),
            '',
            '**Load errors:**',
            ...(lines.length ? lines : ['None.']),
            '',
            'Full diagnostics, including file paths and stack traces, are available in the console and logs/puro.log.',
        ].join('\n');
        await interaction.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0xff1493)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
};
