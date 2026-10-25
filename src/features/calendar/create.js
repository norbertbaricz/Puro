const { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } = require('discord.js');

// Require an explicit timezone to prevent machine-local date interpretation.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/;
const MIN_START_DELAY_MS = 60_000;

function parseDate(value) {
    const match = ISO_DATE.exec(value);
    if (!match) return NaN;
    const [, year, month, day, hour, minute, seconds = '0'] = match;
    const local = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +seconds));
    if (
        local.getUTCFullYear() !== +year ||
        local.getUTCMonth() !== +month - 1 ||
        local.getUTCDate() !== +day ||
        local.getUTCHours() !== +hour ||
        local.getUTCMinutes() !== +minute ||
        local.getUTCSeconds() !== +seconds
    )
        return NaN;
    return Date.parse(value);
}

async function createCalendarEvent(interaction) {
    const starts = parseDate(interaction.options.getString('starts', true));
    const ends = parseDate(interaction.options.getString('ends', true));
    if (
        !Number.isFinite(starts) ||
        !Number.isFinite(ends) ||
        starts < Date.now() + MIN_START_DELAY_MS ||
        ends <= starts
    ) {
        return interaction.editReply({
            content:
                'Use ISO dates with a timezone, for example 2026-10-26T19:00+02:00. Start at least one minute in the future; the end must follow the start.',
        });
    }
    const event = await interaction.guild.scheduledEvents.create({
        name: interaction.options.getString('title', true),
        description: interaction.options.getString('description') || undefined,
        scheduledStartTime: starts,
        scheduledEndTime: ends,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: { location: interaction.options.getString('location', true) },
        reason: `Created by ${interaction.user.tag} through /event`,
    });
    await interaction.editReply({ content: `Event created: ${event.url}` });
}

module.exports = { parseDate, createCalendarEvent };
