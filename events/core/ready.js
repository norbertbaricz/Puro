const { ActivityType } = require('discord.js');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        const config = client.config.events.ready;
        const quiet = client.config?.logging?.quiet_startup ?? true;
        if (!quiet) {
            console.log(config.messages.login_success.replace('{tag}', client.user.tag));
        }

        const computeStats = () => {
            let members = 0, channels = 0;
            client.guilds.cache.each(guild => {
                members += guild.memberCount;
                channels += guild.channels.cache.size;
            });
            return { members, channels };
        };

        // Log stats once on ready
        const { members: totalMembers, channels: totalChannels } = computeStats();
        if (!quiet) {
            console.log(config.messages.stats.servers.replace('{count}', client.guilds.cache.size));
            console.log(config.messages.stats.members.replace('{count}', totalMembers));
            console.log(config.messages.stats.channels.replace('{count}', totalChannels));
        }

        const statusConfig = client.config.status;
        if (!statusConfig?.texts?.length) { // Am schimbat asta, verifica doar lungimea array-ului
            console.log(config.messages.no_status);
            await client.user.setPresence({
                activities: [{ name: 'Error' }],
                status: statusConfig?.status || 'dnd'
            });
            return;
        }

        const activityTypes = {
            'Playing': ActivityType.Playing,
            'Streaming': ActivityType.Streaming,
            'Listening': ActivityType.Listening,
            'Watching': ActivityType.Watching,
            'Custom': ActivityType.Custom,
            'Competing': ActivityType.Competing
        };

        let idx = 0;
        const formatUptime = () => {
            const s = Math.floor(process.uptime());
            const d = Math.floor(s / 86400);
            const h = Math.floor((s % 86400) / 3600);
            const m = Math.floor((s % 3600) / 60);
            return `${d}d ${h}h ${m}m`;
        };

        const setRandomActivity = async () => {
            const { members } = computeStats();
            const servers = client.guilds.cache.size;
            const premiumGuildCount = (() => {
                const directory = client.guildDirectory || {};
                if (directory.premiumGuilds instanceof Map) return directory.premiumGuilds.size;
                if (Array.isArray(directory.premiumGuilds)) return directory.premiumGuilds.length;
                return Number(directory.premiumGuilds) || 0;
            })();
            const uptime = formatUptime();
            const textRaw = statusConfig.texts[idx % statusConfig.texts.length];
            idx++;
            const text = textRaw
                .replace('{servers}', String(servers))
                .replace('{members}', String(members))
                .replace('{membersGreeted}', String(members))
                .replace('{uptime}', uptime)
                .replace('{premiumGuilds}', String(premiumGuildCount))
                .slice(0, 128);
            let activity;

            if (statusConfig.type === 'Custom') {
                activity = {
                    name: text,
                    type: ActivityType.Custom,
                };
            } else if (statusConfig.type === 'Streaming') {
                activity = {
                    name: text,
                    type: ActivityType.Streaming,
                    url: statusConfig.url || "https://www.twitch.tv/insym", // Adaugă un URL implicit pentru streaming
                };
            } else {
                activity = {
                    name: text,
                    type: activityTypes[statusConfig.type] || ActivityType.Playing,
                };
            }

            try {
                await client.user.setPresence({ activities: [activity], status: statusConfig.status || 'online' });
            } catch (error) {
                console.error(config.messages.status_error, error);
            }
        };

        setRandomActivity();
        const intervalMs = Math.max(5000, Number(statusConfig.interval_ms) || 10000);
        setInterval(setRandomActivity, intervalMs);

        // Print futuristic banner once, after presence is set and ping stabilizes
        setTimeout(() => {
            try {
                const globalCommandsCount = client.commands?.size || 0;
                const scopedCommandsCount = Array.from(client.guildCommands instanceof Map ? client.guildCommands.values() : [])
                    .reduce((sum, col) => sum + (col?.size || 0), 0);
                const commandsLoaded = globalCommandsCount + scopedCommandsCount;
                const eventsLoaded = (client.eventLoadDetails || []).filter(x => x.status === 'success' && !x.type).length;
                const servers = client.guilds.cache.size;
                const { members } = computeStats();
                const ping = Math.max(0, client.ws.ping);
                let bootSeconds = null;
                try {
                    if (client.bootStartedAt) {
                        const now = process.hrtime.bigint();
                        const ms = Number(now - client.bootStartedAt) / 1e6;
                        bootSeconds = (ms / 1000).toFixed(2);
                    }
                } catch {}

                const lines = [
                    '\n══════════════════════════════════════════════════════════════════════════',
                    '🚀 Puro is online and ready!',
                    `🧠 Commands: ${commandsLoaded} loaded  •  🧩 Events: ${eventsLoaded} active`,
                    `🌐 Servers: ${servers}  •  👥 Members: ${members}  •  📡 Ping: ${ping}ms` + (bootSeconds ? `  •  ⏱️  Boot: ${bootSeconds}s` : ''),
                    '══════════════════════════════════════════════════════════════════════════\n',
                ];
                console.log(lines.join('\n'));
            } catch {}
        }, 800);
    },
};
