module.exports = {
    name: 'messageCreate',
    async execute(message) {
        const config = message.client.config.events.messageCreate;
        if (message.author.bot || message.guild.id !== config.guild_id) return;

        const content = message.content.toLowerCase().trim();
        const matched = config.greetings.patterns.some(pattern => new RegExp(pattern).test(content));

        if (matched) {
            try {
                const response = config.greetings.responses[Math.floor(Math.random() * config.greetings.responses.length)]
                    .replace('{user}', message.author);
                await message.reply({ content: response, allowedMentions: { repliedUser: true } });
            } catch (error) {
                console.error('Greeting error:', error);
                await message.reply({ content: config.messages.error, ephemeral: true });
            }
        }
    },
};