const { Events } = require('discord.js');

// Copy to events/custom/message.js. MessageContent intent is needed to read text.
const TRIGGER = '!hello';
const RESPONSE = 'Hello!';

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || message.content !== TRIGGER) return;
        await message.reply(client.ui.info(RESPONSE, { title: 'Hello', allowedMentions: { repliedUser: false } }));
    },
};
