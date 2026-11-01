const { MessageFlags } = require('discord.js');
const { acknowledgementMode } = require('./acknowledgement');

async function privateReply(interaction, content, tone = 'warning') {
    const payload = interaction.client.ui[tone](content, { flags: MessageFlags.Ephemeral });
    if (interaction.deferred && !interaction.replied && acknowledgementMode(interaction) === 'reply') {
        // An edit retains the privacy chosen by deferReply; flags cannot change it.
        const edit = { ...payload };
        delete edit.flags;
        return interaction.editReply({ ...edit, components: [] });
    }
    return interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload);
}

module.exports = { privateReply };
