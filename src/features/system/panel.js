const { accentColor } = require('../../core/ui/theme');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { redact } = require('../../core/logging/logger');

const MAX_ROWS = 15;
const MAX_LINE_LENGTH = 200;

function systemPanel(client) {
    const details = [...client.plugins.details.values()];
    const errors = details.filter((item) => item.status === 'error');
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const lines = [
        '## Puro · System',
        `**Modules:** ${client.plugins.records.size} active · ${errors.length} load errors`,
        `**Memory:** ${memory} MiB heap · **Uptime:** ${Math.floor(process.uptime())}s`,
        `**Hot reload:** ${client.plugins.watcher ? 'Enabled' : 'Disabled'} · **Command sync:** ${client.registrationStatus?.status || 'pending'}`,
        '',
        '**Recent module errors**',
        ...(errors.length
            ? errors.slice(-MAX_ROWS).map((item) => redact(`- ${item.file}: ${item.message}`).slice(0, MAX_LINE_LENGTH))
            : ['No module errors.']),
        '',
        '-# /system reload scans plugins. /system sync synchronizes command definitions.',
    ];
    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(accentColor(client))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n'))),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

module.exports = { systemPanel };
