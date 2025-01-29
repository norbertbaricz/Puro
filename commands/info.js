const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, version: discordVersion } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#5865F2' } }; // Discord blue as fallback
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Shows detailed information about the bot'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const botAvatar = interaction.client.user.displayAvatarURL();
            const guilds = interaction.client.guilds.cache;
            
            // Calculate total members and unique members
            let totalMembers = 0;
            const uniqueMembers = new Set();
            guilds.forEach(guild => {
                totalMembers += guild.memberCount;
                guild.members.cache.forEach(member => uniqueMembers.add(member.id));
            });

            // Calculate uptime
            const uptime = process.uptime();
            const days = Math.floor(uptime / (3600 * 24));
            const hours = Math.floor((uptime % (3600 * 24)) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            // Get system information
            const memoryUsage = process.memoryUsage();
            const systemInfo = {
                os: `${os.type()} ${os.release()}`,
                cpu: `${os.cpus()[0].model}`,
                memory: `${Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
                totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 * 100) / 100} MB`,
                nodeVersion: process.version,
                discordJsVersion: discordVersion
            };

            const embed = new EmbedBuilder()
                .setColor(config.commands?.info || config.colors?.default || '#5865F2')
                .setTitle('🤖 Bot Information')
                .setThumbnail(botAvatar)
                .addFields(
                    { 
                        name: '👤 Creator', 
                        value: 'MaxUltimat3', 
                        inline: true 
                    },
                    { 
                        name: '📅 Creation Date', 
                        value: '<t:1715299200:D>', // Unix timestamp for 10.05.2024
                        inline: true 
                    },
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
                            `📊 Memory Usage: \`${systemInfo.memory}\``,
                            `💾 Total Memory: \`${systemInfo.totalMemory}\``,
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
            const reply = interaction.deferred 
                ? interaction.editReply 
                : interaction.reply;
            
            await reply.call(interaction, {
                content: '❌ An error occurred while fetching bot information.',
                ephemeral: true
            }).catch(console.error);
        }
    },
};
