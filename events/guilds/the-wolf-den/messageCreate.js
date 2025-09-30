// Per-user cooldown map to prevent spam replies
const userCooldown = new Map(); // Map<userId, lastTimestamp>

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        const config = message.client.config?.events?.messageCreate || {};
        if (!message.guild) return;
        if (message.author.bot) return;
        if (config.guild_id && message.guild.id !== config.guild_id) return;

        const greetingsCfg = config.greetings || {};

        // Channel allow/deny filters from config
        const allowChannels = greetingsCfg.allow_channels || [];
        const denyChannels = greetingsCfg.deny_channels || [];
        if (allowChannels.length && !allowChannels.includes(message.channel.id)) return;
        if (denyChannels.length && denyChannels.includes(message.channel.id)) return;

        // Cooldown
        const cooldownSec = Math.max(0, Number(greetingsCfg.cooldown_seconds) || 10);
        const now = Date.now();
        const last = userCooldown.get(message.author.id) || 0;
        if (cooldownSec > 0 && now - last < cooldownSec * 1000) return;

        const content = (message.content || '').toLowerCase().trim();
        if (!content) return;

        const patterns = Array.isArray(greetingsCfg.patterns) ? greetingsCfg.patterns : [];
        const matched = patterns.some(pattern => {
            try { return new RegExp(pattern, 'i').test(content); } catch { return false; }
        });
        if (!matched) return;

        // Probability gate
        const probability = Number(greetingsCfg.probability);
        if (!Number.isNaN(probability) && probability >= 0 && probability <= 1) {
            if (Math.random() > probability) return;
        }

        userCooldown.set(message.author.id, now);

        try {
            const responses = Array.isArray(greetingsCfg.responses) ? greetingsCfg.responses : [greetingsCfg.responses].filter(Boolean);
            const response = (responses[Math.floor(Math.random() * responses.length)] || 'Hello, {user}!')
                .replace('{user}', `${message.author}`)
                .replace('{channel}', `${message.channel}`);

            // Optional react
            const reactEmoji = greetingsCfg.reaction || null;
            if (reactEmoji) {
                message.react(reactEmoji).catch(() => {});
            }

            const sent = await message.reply({ content: response, allowedMentions: { repliedUser: true } });

            // Auto-delete after N seconds if configured
            const deleteAfter = Number(greetingsCfg.delete_after_seconds) || 0;
            if (deleteAfter > 0) {
                setTimeout(() => sent.delete().catch(() => {}), deleteAfter * 1000);
            }
        } catch (error) {
            console.error('Greeting error:', error);
            // message.reply does not support ephemeral; provide a normal reply
            const fallback = (config.messages && config.messages.error) || 'An error occurred while sending the greeting.';
            message.reply({ content: fallback, allowedMentions: { repliedUser: false } }).catch(() => {});
        }
    },
};
