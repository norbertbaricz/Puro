const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { exec } = require('child_process');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Displays various information about the bot.')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Which information to display?')
                .setRequired(false)
                .addChoices(
                    { name: 'Creator', value: 'creator' },
                    { name: 'Status', value: 'status' },
                    { name: 'System', value: 'system' },
                    { name: 'Uptime', value: 'uptime' }
                )
        ),

    async execute(interaction) {
        const infoType = interaction.options.getString('type', false);
        const client = interaction.client;
        const config = client.config?.commands?.info || {};
        const content = config.content || {};

        try {
            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setColor(config.color || '#0099ff')
                .setFooter({ text: `Bot ID: ${client.user.id}` })
                .setTimestamp()
                .setThumbnail(client.user.displayAvatarURL());

            if (!infoType) {
                embed.setTitle(config.all?.title || 'Bot Information');

                const creatorContent = content.creator || {};
                embed.addFields({
                    name: creatorContent.title || 'Creator Information',
                    value: `${creatorContent.creator_name_label || 'Creator'}: \`${creatorContent.creator_name_value || 'Unknown'}\`\n${creatorContent.creation_date_label || 'Creation Date'}: <t:${creatorContent.creation_date_value || '0'}:D>`,
                    inline: false
                });

                const statusContent = content.status || {};
                const guilds = client.guilds.cache;
                const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
                embed.addFields({
                    name: statusContent.title || 'Bot Status',
                    value: `${statusContent.servers_label || 'Servers'}: \`${guilds.size}\`\n${statusContent.members_label || 'Members'}: \`${totalMembers}\`\n${statusContent.commands_label || 'Commands'}: \`${client.commands?.size || 0}\`\n${statusContent.latency_label || 'Latency'}: \`${client.ws.ping}ms\``,
                    inline: false
                });

                const systemContent = content.system || {};
                const memoryUsage = process.memoryUsage();
                embed.addFields({
                    name: systemContent.title || 'System Information',
                    value: `${systemContent.os_label || 'Operating System'}: \`${os.type()} ${os.release()}\`\n${systemContent.cpu_label || 'CPU'}: \`${os.cpus()[0]?.model || 'Unknown'}\`\n${systemContent.mem_usage_label || 'Memory Usage'}: \`${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\`\n${systemContent.total_mem_label || 'Total Memory'}: \`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\`\n${systemContent.node_label || 'Node.js Version'}: \`${process.version}\`\n${systemContent.djs_label || 'Discord.js Version'}: \`v${require('discord.js').version}\``,
                    inline: false
                });

                const uptimeContent = content.uptime || {};
                const uptime = process.uptime();
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                const uptimeString = (uptimeContent.time_format || '{days}d {hours}h {minutes}m {seconds}s')
                    .replace('{days}', days)
                    .replace('{hours}', hours)
                    .replace('{minutes}', minutes)
                    .replace('{seconds}', seconds);
                const description = (uptimeContent.description || 'The bot has been online for {uptimeString}.').replace('{uptimeString}', uptimeString);
                embed.addFields({
                    name: uptimeContent.title || 'Bot Uptime',
                    value: description,
                    inline: false
                });
            } else {
                if (infoType === 'creator') {
                    const creatorContent = content.creator || {};
                    embed
                        .setTitle(creatorContent.title || 'Creator Information')
                        .addFields(
                            { name: creatorContent.creator_name_label || 'Creator', value: `\`${creatorContent.creator_name_value || 'Unknown'}\``, inline: true },
                            { name: creatorContent.creation_date_label || 'Creation Date', value: `<t:${creatorContent.creation_date_value || '0'}:D>`, inline: true }
                        );
                } else if (infoType === 'status') {
                    const statusContent = content.status || {};
                    const guilds = client.guilds.cache;
                    const totalMembers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
                    embed
                        .setTitle(statusContent.title || 'Bot Status')
                        .addFields(
                            { name: statusContent.servers_label || 'Servers', value: `\`${guilds.size}\``, inline: true },
                            { name: statusContent.members_label || 'Members', value: `\`${totalMembers}\``, inline: true },
                            { name: statusContent.commands_label || 'Commands', value: `\`${client.commands?.size || 0}\``, inline: true },
                            { name: statusContent.latency_label || 'Latency', value: `\`${client.ws.ping}ms\``, inline: true }
                        );
                } else if (infoType === 'system') {
                    const systemContent = content.system || {};
                    const memoryUsage = process.memoryUsage();
                    embed
                        .setTitle(systemContent.title || 'System Information')
                        .addFields(
                            { name: systemContent.os_label || 'Operating System', value: `\`${os.type()} ${os.release()}\``, inline: false },
                            { name: systemContent.cpu_label || 'CPU', value: `\`${os.cpus()[0]?.model || 'Unknown'}\``, inline: false },
                            { name: systemContent.mem_usage_label || 'Memory Usage', value: `\`${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\``, inline: true },
                            { name: systemContent.total_mem_label || 'Total Memory', value: `\`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\``, inline: true },
                            { name: systemContent.node_label || 'Node.js Version', value: `\`${process.version}\``, inline: true },
                            { name: systemContent.djs_label || 'Discord.js Version', value: `\`v${require('discord.js').version}\``, inline: true }
                        );
                } else if (infoType === 'uptime') {
                    const uptimeContent = content.uptime || {};
                    const uptime = process.uptime();
                    const days = Math.floor(uptime / 86400);
                    const hours = Math.floor((uptime % 86400) / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    const uptimeString = (uptimeContent.time_format || '{days}d {hours}h {minutes}m {seconds}s')
                        .replace('{days}', days)
                        .replace('{hours}', hours)
                        .replace('{minutes}', minutes)
                        .replace('{seconds}', seconds);
                    const description = (uptimeContent.description || 'The bot has been online for {uptimeString}.').replace('{uptimeString}', uptimeString);

                    embed
                        .setTitle(uptimeContent.title || 'Bot Uptime')
                        .setDescription(description);

                    // --- Adding System Temperature (for Linux with `sensors` only) ---
                    exec('sensors | grep "Core 0" | awk \'{print $3}\'', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error getting temperature: ${error.message}`);
                            // You can add an error description to the embed if you wish
                            // embed.addField('Temperature', 'Could not retrieve temperature.');
                            return;
                        }
                        if (stderr) {
                            console.error(`Stderr error getting temperature: ${stderr}`);
                            return;
                        }

                        const temperatureMatch = stdout.match(/\+([\d.]+)°C/); // Look for a format like "+XX.X°C"
                        const temperature = temperatureMatch ? temperatureMatch[1] : 'N/A';

                        embed.addFields(
                            { name: 'CPU Temperature', value: `${temperature}°C`, inline: true }
                        );

                        // This is where you would typically send the embed.
                        // Make sure your embed sending function is called *after* all information is added.
                        // For example: message.channel.send({ embeds: [embed] });
                    });
                    // --- End adding temperature ---
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(`Error executing /info command (type: ${infoType || 'all'}):`, error);
            const errorMessage = { content: config.messages?.error || 'An error occurred while executing the command.' };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ ...errorMessage, flags: 64 });
            } else {
                await interaction.reply({ ...errorMessage, flags: 64 });
            }
        }
    },
};