const { Events } = require('discord.js');
const { bootstrapRecorder } = require('../../lib/wolfDenRecorder');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await bootstrapRecorder(client);
  },
};
