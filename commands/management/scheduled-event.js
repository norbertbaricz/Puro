const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createCalendarEvent } = require('../../src/features/calendar/create');

module.exports = {
    category: 'Management',
    guildOnly: true,
    feature: 'scheduled_events',
    defer: 'private',
    cooldown: 5,
    userPermissions: [PermissionFlagsBits.CreateEvents],
    botPermissions: [PermissionFlagsBits.CreateEvents],
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Create an event in the native Discord server calendar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.CreateEvents)
        .addStringOption((option) =>
            option.setName('title').setDescription('Event title.').setMaxLength(100).setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('starts')
                .setDescription('ISO date with timezone, for example 2026-10-26T19:00+02:00')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName('ends').setDescription('ISO end date, with timezone.').setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('location')
                .setDescription('Where the event takes place.')
                .setMaxLength(100)
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName('description').setDescription('Event description.').setMaxLength(1000),
        ),
    async execute(interaction) {
        await createCalendarEvent(interaction);
    },
};
