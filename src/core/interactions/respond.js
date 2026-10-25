const { MessageFlags } = require('discord.js');
async function privateReply(interaction, content, tone = 'warning') {
    const payload = interaction.client.ui[tone](content, { flags: MessageFlags.Ephemeral });
    if (interaction.deferred && !interaction.replied) return interaction.editReply({ ...payload, components: [] });
    return interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
}

module.exports = { privateReply };
