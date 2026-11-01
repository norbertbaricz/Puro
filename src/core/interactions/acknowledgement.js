// Track whether a deferred response owns a new reply or updates an existing message.
const modes = new WeakMap();

function recordAcknowledgement(interaction, mode) {
    modes.set(interaction, mode);
}

function acknowledgementMode(interaction) {
    if (modes.has(interaction)) return modes.get(interaction);
    // Discord SDK instances expose null ephemeral state after deferUpdate().
    if (interaction.deferred && interaction.message && interaction.ephemeral === null) return 'update';
    return 'reply';
}

module.exports = { recordAcknowledgement, acknowledgementMode };
