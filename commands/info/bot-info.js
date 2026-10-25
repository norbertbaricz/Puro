const { getSystemHardwareInfo } = require('../../src/features/system/hardware');
const { onCollect, onEnd } = require('../../src/shared/collectors');
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');
const os = require('os');

module.exports = {
    guildOnly: true,
    category: 'Info',
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Displays various information about the bot.')
        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription('Which information to display?')
                .setRequired(false)
                .addChoices(
                    { name: 'Creator', value: 'creator' },
                    { name: 'Status', value: 'status' },
                    { name: 'System', value: 'system' },
                    { name: 'Uptime', value: 'uptime' },
                ),
        )
        .addBooleanOption((option) =>
            option.setName('private').setDescription('Reply privately (only you can see)').setRequired(false),
        ),

    async execute(interaction) {
        const selected = interaction.options.getString('type') || null;
        const isPrivate = interaction.options.getBoolean('private') || false;
        const client = interaction.client;
        const cfg = client.config?.commands?.info || {};
        const content = cfg.content || {};

        try {
            if (isPrivate) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } else {
                await interaction.deferReply();
            }

            const build = async (type) => {
                const { cpuTemperature, batteryPercentage } =
                    !type || type === 'system'
                        ? await getSystemHardwareInfo()
                        : { cpuTemperature: 'N/A', batteryPercentage: 'N/A' };
                const base = new EmbedBuilder()
                    .setColor(cfg.color || '#0099ff')
                    .setFooter({ text: `Bot ID: ${client.user.id}` })
                    .setTimestamp()
                    .setThumbnail(client.user.displayAvatarURL());

                const guilds = client.guilds.cache;
                const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
                const eventsCount = Array.isArray(client.eventLoadDetails)
                    ? client.eventLoadDetails.filter((x) => x && x.status === 'success' && !x.type).length
                    : 0;
                const globalCommandsCount = client.commands?.size || 0;
                const guildScopedCount = Array.from(
                    client.guildCommands instanceof Map ? client.guildCommands.values() : [],
                ).reduce((sum, col) => sum + (col?.size || 0), 0);
                const totalCommandCount = globalCommandsCount + guildScopedCount;

                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);

                const botCreated = Math.floor((client.user.createdTimestamp || Date.now()) / 1000);

                if (!type) {
                    base.setTitle(cfg.all?.title || 'Bot Information');
                    const creatorContent = content.creator || {};
                    const creatorName = creatorContent.creator_name_value || 'MaxUltimat3';
                    const companyName = creatorContent.company_name_value || 'Skypixel';
                    const creationDate = creatorContent.creation_date_value || String(botCreated);
                    base.addFields({
                        name: creatorContent.title || '👤 Creator & 🏢 Company',
                        value: `${creatorContent.creator_name_label || '👤 Creator'}: \`${creatorName}\`\n${creatorContent.company_name_label || '🏢 Company'}: \`${companyName}\`\n${creatorContent.creation_date_label || '📅 Creation Date'}: <t:${creationDate}:D>`,
                        inline: false,
                    });
                    const statusContent = content.status || {};
                    base.addFields({
                        name: statusContent.title || '📊 Bot Status & Statistics',
                        value: `${statusContent.servers_label || '🏠 Servers'}: \`${guilds.size}\`\n${statusContent.members_label || '👥 Members'}: \`${totalMembers}\`\n${statusContent.commands_label || '⚙ Commands'}: \`${totalCommandCount}\`\n${statusContent.latency_label || '⏱ Latency'}: \`${client.ws.ping}ms\`\n${statusContent.events_label || '🎯 Events'}: \`${eventsCount}\``,
                        inline: false,
                    });
                    const systemContent = content.system || {};
                    const mem = process.memoryUsage();
                    base.addFields({
                        name: systemContent.title || '💻 System Information',
                        value: `${systemContent.os_label || '💻 Operating System'}: \`${os.type()} ${os.release()}\`\n${systemContent.cpu_label || '🧠 CPU'}: \`${os.cpus()[0]?.model || 'Unknown'}\`\n${systemContent.mem_usage_label || '📈 Memory Usage'}: \`${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\`\n${systemContent.total_mem_label || '💾 Total Memory'}: \`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\`\n${systemContent.node_label || 'Node.js Version'}: \`${process.version}\`\n${systemContent.djs_label || 'discord.js Version'}: \`v${require('discord.js').version}\`\n${systemContent.cpu_temp_label || '🌡 CPU Temperature'}: \`${cpuTemperature}\`\n${systemContent.battery_label || '🔋 Battery'}: \`${batteryPercentage}\``,
                        inline: false,
                    });
                    const uptimeContent = content.uptime || {};
                    const upStr = (uptimeContent.time_format || '{days}d {hours}h {minutes}m {seconds}s')
                        .replace('{days}', days)
                        .replace('{hours}', hours)
                        .replace('{minutes}', minutes)
                        .replace('{seconds}', seconds);
                    const desc = (uptimeContent.description || 'The bot has been online for {uptimeString}.').replace(
                        '{uptimeString}',
                        upStr,
                    );
                    base.addFields({ name: uptimeContent.title || 'Uptime', value: desc, inline: false });
                } else if (type === 'creator') {
                    const c = content.creator || {};
                    const creatorName = c.creator_name_value || 'MaxUltimat3';
                    const companyName = c.company_name_value || 'Skypixel';
                    const creationDate = c.creation_date_value || String(botCreated);
                    base.setTitle(c.title || 'Creator Information').addFields(
                        { name: c.creator_name_label || '👤 Creator', value: `\`${creatorName}\``, inline: true },
                        { name: c.company_name_label || '🏢 Company', value: `\`${companyName}\``, inline: true },
                        {
                            name: c.creation_date_label || '📅 Bot Created',
                            value: `<t:${creationDate}:D>`,
                            inline: true,
                        },
                    );
                } else if (type === 'status') {
                    const s = content.status || {};
                    base.setTitle(s.title || '📊 Bot Status').addFields(
                        { name: s.servers_label || '🏠 Servers', value: `\`${guilds.size}\``, inline: true },
                        { name: s.members_label || '👥 Members', value: `\`${totalMembers}\``, inline: true },
                        { name: s.commands_label || '⚙ Commands', value: `\`${totalCommandCount}\``, inline: true },
                        { name: s.events_label || '🎯 Events', value: `\`${eventsCount}\``, inline: true },
                        { name: s.latency_label || '⏱ Latency', value: `\`${client.ws.ping}ms\``, inline: true },
                    );
                } else if (type === 'system') {
                    const s = content.system || {};
                    const mem = process.memoryUsage();
                    base.setTitle(s.title || '💻 System Information').addFields(
                        {
                            name: s.os_label || '💻 Operating System',
                            value: `\`${os.type()} ${os.release()}\``,
                            inline: false,
                        },
                        {
                            name: s.cpu_label || '🧠 CPU',
                            value: `\`${os.cpus()[0]?.model || 'Unknown'}\``,
                            inline: false,
                        },
                        {
                            name: s.mem_usage_label || '📈 Memory Usage',
                            value: `\`${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\``,
                            inline: true,
                        },
                        {
                            name: s.total_mem_label || '💾 Total Memory',
                            value: `\`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\``,
                            inline: true,
                        },
                        { name: s.node_label || 'Node.js Version', value: `\`${process.version}\``, inline: true },
                        {
                            name: s.djs_label || 'discord.js Version',
                            value: `\`v${require('discord.js').version}\``,
                            inline: true,
                        },
                        { name: s.cpu_temp_label || '🌡 CPU Temperature', value: `\`${cpuTemperature}\``, inline: true },
                        { name: s.battery_label || '🔋 Battery', value: `\`${batteryPercentage}\``, inline: true },
                    );
                } else if (type === 'uptime') {
                    const u = content.uptime || {};
                    const upStr = (u.time_format || '{days}d {hours}h {minutes}m {seconds}s')
                        .replace('{days}', days)
                        .replace('{hours}', hours)
                        .replace('{minutes}', minutes)
                        .replace('{seconds}', seconds);
                    const desc = (u.description || 'The bot has been online for {uptimeString}.').replace(
                        '{uptimeString}',
                        upStr,
                    );
                    base.setTitle(u.title || 'Bot Uptime').setDescription(desc);
                }
                return base;
            };

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('info_all')
                    .setLabel('All')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📚'),
                new ButtonBuilder()
                    .setCustomId('info_creator')
                    .setLabel('Creator')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👤'),
                new ButtonBuilder()
                    .setCustomId('info_status')
                    .setLabel('Status')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('info_system')
                    .setLabel('System')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💻'),
                new ButtonBuilder()
                    .setCustomId('info_uptime')
                    .setLabel('Uptime')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏱️'),
            );

            let current = selected;
            const first = await build(current);
            await interaction.editReply({ embeds: [first], components: [buttons] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });
            onCollect(collector, async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: 'Only the command invoker can use these buttons.',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                if (i.customId === 'info_all') current = null;
                if (i.customId === 'info_creator') current = 'creator';
                if (i.customId === 'info_status') current = 'status';
                if (i.customId === 'info_system') current = 'system';
                if (i.customId === 'info_uptime') current = 'uptime';
                const fresh = await build(current);
                await i.update({ embeds: [fresh] });
            });
            onEnd(collector, async () => {
                const disabled = new ActionRowBuilder().addComponents(
                    buttons.components.map((b) => ButtonBuilder.from(b).setDisabled(true)),
                );
                await interaction.editReply({ components: [disabled] }).catch(() => {});
            });
        } catch (error) {
            console.error(`Error executing /info command (type: ${selected || 'all'}):`, error);
            const payload = {
                content: cfg.messages?.error || 'An error occurred while executing the command.',
                flags: MessageFlags.Ephemeral,
            };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
            else await interaction.reply(payload);
        }
    },
};
