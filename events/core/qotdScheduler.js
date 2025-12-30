const VALID_ARCHIVE_MINUTES = new Set([60, 1440, 4320, 10080]);

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        const cfg = client.config?.events?.guilds?.['the-wolf-den']?.qotd;
        if (!cfg || cfg.enabled === false) return;

        const guildId = String(cfg.guild_id || '').trim();
        const channelId = String(cfg.channel_id || '').trim();
        if (!guildId || !channelId) return;

        const premiumIds = client.guildDirectory?.premiumIds;
        if (premiumIds instanceof Set && !premiumIds.has(guildId)) return;

        const intervalMs = Math.max(15_000, (Number(cfg.interval_seconds) || 60) * 1000);
        const archiveMinutes = Number(cfg.auto_archive_minutes) || 1440;
        const autoArchiveDuration = VALID_ARCHIVE_MINUTES.has(archiveMinutes) ? archiveMinutes : 1440;
        const threadTemplate = cfg.thread_name_template || 'QOTD {date}';

        const pickQuestion = (channel) => {
            const sfw = Array.isArray(cfg.questions?.sfw) ? cfg.questions.sfw.filter(Boolean) : [];
            const nsfw = Array.isArray(cfg.questions?.nsfw) ? cfg.questions.nsfw.filter(Boolean) : [];
            const pool = channel?.nsfw ? (nsfw.length ? nsfw : sfw) : (sfw.length ? sfw : nsfw);
            if (!pool.length) return null;
            return pool[Math.floor(Math.random() * pool.length)];
        };

        const buildContent = (channel) => {
            const question = pickQuestion(channel);
            if (!question) return cfg.message || 'Question of the day (test).';
            const template = cfg.message_template || 'QOTD: {question}';
            return template.replace('{question}', question);
        };

        const formatDate = () => new Date().toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

        const sendQotd = async () => {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) return;
                if (channel.isThread && channel.isThread()) return;
                if (channel.guildId && channel.guildId !== guildId) return;

                const content = buildContent(channel);
                const sent = await channel.send({ content });
                const threadName = threadTemplate.replace('{date}', formatDate()).slice(0, 100);

                await sent.startThread({
                    name: threadName,
                    autoArchiveDuration,
                });
            } catch (error) {
                console.error('QOTD scheduler error:', error);
            }
        };

        await sendQotd();
        const timer = setInterval(sendQotd, intervalMs);
        if (typeof timer.unref === 'function') timer.unref();

        if (!Array.isArray(client._qotdSchedulers)) client._qotdSchedulers = [];
        client._qotdSchedulers.push(timer);
    },
};
