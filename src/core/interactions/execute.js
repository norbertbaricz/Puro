const { MessageFlags } = require('discord.js');
const { privateReply } = require('./respond');
const { permissionMissing } = require('./access');
const COOLDOWN_SWEEP_MS = 60_000;
const MAX_COOLDOWN_ENTRIES = 50_000;
async function runHandler(interaction, handler, label) {
    const client = interaction.client;
    const config = client.config.commands?.[interaction.commandName] || {};
    if (handler.ownerOnly && !client.config.runtime.owner_ids.includes(interaction.user.id)) {
        await privateReply(interaction, 'Only a configured bot owner can use this action.');
        return;
    }
    if (handler.guildOnly && !interaction.guildId) {
        await privateReply(interaction, 'This action can only be used inside a server.');
        return;
    }
    if (interaction.guildId && permissionMissing(interaction.memberPermissions, handler.userPermissions)) {
        await privateReply(interaction, 'You do not have the permissions required for this action.');
        return;
    }
    if (interaction.guildId && permissionMissing(interaction.appPermissions, handler.botPermissions)) {
        await privateReply(interaction, 'I do not have the permissions required for this action.');
        return;
    }
    const runtime = (client.interactionRuntime ||= { cooldowns: new Map(), lastSweep: 0 });
    const now = Date.now();
    if (now - runtime.lastSweep >= COOLDOWN_SWEEP_MS) {
        for (const [key, expires] of runtime.cooldowns) if (expires <= now) runtime.cooldowns.delete(key);
        runtime.lastSweep = now;
    }
    const cooldown = Math.max(0, Number(config.cooldown_seconds ?? handler.cooldown) || 0) * 1000;
    const cooldownKey = `${interaction.guildId || 'dm'}:${label}:${interaction.user.id}`;
    const remaining = (runtime.cooldowns.get(cooldownKey) || 0) - now;
    if (remaining > 0) {
        await privateReply(
            interaction,
            (config.messages?.cooldown || 'Please wait {remaining} seconds.').replaceAll(
                '{remaining}',
                String(Math.ceil(remaining / 1000)),
            ),
        );
        return;
    }
    if (cooldown > 0) {
        if (runtime.cooldowns.size >= MAX_COOLDOWN_ENTRIES)
            runtime.cooldowns.delete(runtime.cooldowns.keys().next().value);
        runtime.cooldowns.set(cooldownKey, now + cooldown);
    }
    if (handler.defer && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: handler.defer === 'private' ? MessageFlags.Ephemeral : undefined });
    }
    client.healthMonitor?.recordCommand();
    try {
        await handler.execute(interaction, client);
    } catch (error) {
        // A failed command should not consume the user's cooldown.
        if (cooldown > 0) runtime.cooldowns.delete(cooldownKey);
        throw error;
    }
}

module.exports = { runHandler };
