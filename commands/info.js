const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

const systemInfo = {
    os: `${os.type()} ${os.release()}`,
    cpu: `${os.cpus()[0].model}`,
    nodeVersion: process.version,
    discordJsVersion: require('discord.js').version
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Bot information'),

    async execute(interaction) {
        const config = interaction.client.config.commands.info;
        try {
            await interaction.deferReply();

            const guilds = interaction.client.guilds.cache;
            let totalMembers = 0;
            const uniqueMembers = new Set();
            for (const guild of guilds.values()) {
                totalMembers += guild.memberCount;
                guild.members.cache.forEach(member => uniqueMembers.add(member.id));
            }

            const uptime = process.uptime();
            const days = Math.floor(uptime / (3600 * 24));
            const hours = Math.floor((uptime % (3600 * 24)) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            const memoryUsage = process.memoryUsage();
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('🤖 Bot Information')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Creator', value: 'MaxUltimat3', inline: true },
                    { name: '📅 Creation Date', value: '<t:1715299200:D>', inline: true },
                    { 
                        name: '📊 Statistics', 
                        value: [
                            `📝 Commands: \`${interaction.client.commands.size}\``,
                            `🌐 Servers: \`${guilds.size}\``,
                            `👥 Total Members: \`${totalMembers}\``,
                            `👤 Unique Members: \`${uniqueMembers.size}\``,
                            `⏱️ Uptime: \`${days}d ${hours}h ${minutes}m ${seconds}s\``,
                            `📶 Latency: \`${interaction.client.ws.ping}ms\``
                        ].join('\n'),
                        inline: false 
                    },
                    { 
                        name: '💻 System Information', 
                        value: [
                            `🖥️ OS: \`${systemInfo.os}\``,
                            `⚙️ CPU: \`${systemInfo.cpu}\``,
                            `📊 Memory Usage: \`${Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100} MB\``,
                            `💾 Total Memory: \`${Math.round(os.totalmem() / 1024 / 1024 * 100) / 100} MB\``,
                            `📦 Node.js: \`${systemInfo.nodeVersion}\``,
                            `🔧 Discord.js: \`v${systemInfo.discordJsVersion}\``
                        ].join('\n'),
                        inline: false 
                    }
                )
                .setFooter({ text: `Bot ID: ${interaction.client.user.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Info error:', error);
            await interaction.editReply({ content: config.messages.error, ephemeral: true });
        }
    },
};