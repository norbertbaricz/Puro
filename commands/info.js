const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');
const { execSync } = require('child_process'); // Pentru a rula comenzi shell

// Funcții ajutătoare pentru informații specifice Termux/Android
function getAndroidOsVersion() {
    try {
        // În Termux, poți rula comenzi Android. getprop ro.build.version.release dă versiunea Android.
        return execSync('getprop ro.build.version.release').toString().trim();
    } catch (error) {
        return 'Unknown Android Version';
    }
}

function getTermuxPackageVersion() {
    try {
        // Obține versiunea pachetului Termux
        // WARNING: apt does not have a stable CLI interface. Use with caution in scripts.
        // The above warning is from 'pkg' command itself, not an error.
        // It means 'pkg show' is generally stable for scripts, but 'pkg install' might not be.
        return execSync('pkg show termux | grep Version | cut -d\' \' -f2').toString().trim();
    } catch (error) {
        return 'Unknown Termux Version';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Bot information'),

    async execute(interaction) {
        // Asigură-te că `config` este disponibil și are structura așteptată
        // Presupunând că 'config' este accesibil prin interaction.client.config
        // și că are un obiect 'commands' cu un obiect 'info' în interior
        const config = interaction.client.config?.commands?.info || {
            color: '#0099ff', // Culoare default dacă nu este configurată
            messages: {
                error: 'A apărut o eroare la preluarea informațiilor botului.' // Mesaj default
            }
        };

        try {
            await interaction.deferReply();

            const guilds = interaction.client.guilds.cache;
            let totalMembers = 0;
            const uniqueMembers = new Set();
            for (const guild of guilds.values()) {
                totalMembers += guild.memberCount;
                // În Discord.js v13+, members este o colecție, iar `fetch` ar putea fi necesar
                // dacă nu toate membrii sunt în cache. Pentru scopul nostru, presupunem că sunt.
                guild.members.cache.forEach(member => uniqueMembers.add(member.id));
            }

            // Uptime-ul procesului Node.js este corect
            const uptime = process.uptime();
            const days = Math.floor(uptime / (3600 * 24));
            const hours = Math.floor((uptime % (3600 * 24)) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            // Memoria folosită de procesul Node.js (heapUsed este cea mai relevantă pentru bot)
            const memoryUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
            const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;

            // Get CPU Model safely
            let cpuModel = 'N/A';
            const cpus = os.cpus();
            if (cpus && cpus.length > 0) {
                cpuModel = cpus[0].model;
            }

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('🤖 Bot Information')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Creator', value: 'MaxUltimat3', inline: true },
                    { name: '📅 Creation Date', value: '<t:1715299200:D>', inline: true }, // Asigură-te că timestamp-ul e corect
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
                            `🖥️ OS: \`Android ${getAndroidOsVersion()} (Termux ${getTermuxPackageVersion()})\``,
                            `⚙️ CPU Model: \`${cpuModel}\``, // Utilizăm variabila cpuModel verificată
                            `📊 Memory Usage (Bot): \`${heapUsedMB} MB / ${heapTotalMB} MB\``, // Mai precis pentru bot
                            `📦 Node.js: \`${process.version}\``,
                            `🔧 Discord.js: \`v${require('discord.js').version}\``
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ text: `Bot ID: ${interaction.client.user.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Info error:', error);
            // Asigură-te că `config.messages.error` există sau folosește un mesaj hardcodat
            await interaction.editReply({ content: config.messages.error || 'An error occurred while fetching bot information.', ephemeral: true });
        }
    },
};