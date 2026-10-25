const { SlashCommandBuilder } = require('discord.js');
const { systemPanel } = require('../../src/features/system/panel');

module.exports = {
    category: 'Info',
    ownerOnly: true,
    defer: 'private',
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('system')
        .setDescription('Bot owner: inspect and manage the running framework.')
        .addSubcommand((option) =>
            option.setName('status').setDescription('Inspect module errors, memory, and command sync.'),
        )
        .addSubcommand((option) =>
            option.setName('reload').setDescription('Rescan command, event, and component files.'),
        )
        .addSubcommand((option) =>
            option.setName('sync').setDescription('Synchronize changed command definitions with Discord.'),
        ),
    async execute(interaction) {
        const action = interaction.options.getSubcommand();
        if (action === 'reload') await interaction.client.plugins.enqueue(() => interaction.client.plugins.scan());
        if (action === 'sync') await interaction.client.commandRegistrar.sync();
        await interaction.editReply(systemPanel(interaction.client));
    },
};
