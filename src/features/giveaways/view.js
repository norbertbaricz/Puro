const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { normalizePlatformList } = require('./platforms');

function getPlatformLabels(giveaway) {
    const tokens = new Set(normalizePlatformList(giveaway.platforms));
    const labels = [];

    if (tokens.has('steam')) {
        labels.push('Steam');
    }

    if (tokens.has('ps4') || tokens.has('ps5') || tokens.has('playstation')) {
        labels.push('PlayStation Store');
    }

    if (tokens.has('epic-games-store') || tokens.has('epic-games') || tokens.has('epicgames')) {
        labels.push('Epic Games Store');
    }

    return labels.length ? labels : ['Unknown'];
}

function getPlatformAccent(giveaway) {
    const tokens = new Set(normalizePlatformList(giveaway.platforms));
    const hasSteam = tokens.has('steam');
    const hasPlayStation = tokens.has('ps4') || tokens.has('ps5') || tokens.has('playstation');
    const hasEpic = tokens.has('epic-games-store') || tokens.has('epic-games') || tokens.has('epicgames');

    if (hasSteam && hasPlayStation && hasEpic) {
        return { color: 0x20bf6b, label: 'Steam + PlayStation + Epic' };
    }

    if (hasSteam && hasPlayStation) {
        return { color: 0x20bf6b, label: 'Steam + PlayStation' };
    }

    if (hasSteam && hasEpic) {
        return { color: 0x2d3436, label: 'Steam + Epic' };
    }

    if (hasPlayStation && hasEpic) {
        return { color: 0x4b4b9f, label: 'PlayStation + Epic' };
    }

    if (hasSteam) {
        return { color: 0x1b2838, label: 'Steam Giveaway' };
    }

    if (hasPlayStation) {
        return { color: 0x003087, label: 'PlayStation Store Giveaway' };
    }

    if (hasEpic) {
        return { color: 0x313131, label: 'Epic Games Store Giveaway' };
    }

    return { color: 0x00b894, label: 'Game Giveaway' };
}

function truncate(value, maxLength) {
    const text = String(value || '').trim();
    if (!text) return 'No description provided.';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

function toDiscordTimestamp(value, style = 'R') {
    if (!value || String(value).toLowerCase() === 'n/a') {
        return 'No end date listed';
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return truncate(value, 200);
    }

    return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function normalizeUrl(value) {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) ? url : null;
}

function buildEmbed(giveaway) {
    const platforms = getPlatformLabels(giveaway).join(', ');
    const accent = getPlatformAccent(giveaway);
    const worth = giveaway.worth && giveaway.worth !== 'N/A' ? truncate(giveaway.worth, 100) : 'Unknown value';
    const description = truncate(giveaway.description, 900);
    const instructions = truncate(giveaway.instructions, 450);
    const endAbsolute = toDiscordTimestamp(giveaway.end_date, 'f');
    const endRelative = toDiscordTimestamp(giveaway.end_date, 'R');
    const publishedAt = toDiscordTimestamp(giveaway.published_date, 'f');
    const imageUrl = normalizeUrl(giveaway.image) || normalizeUrl(giveaway.thumbnail);

    return new EmbedBuilder()
        .setColor(accent.color)
        .setAuthor({ name: accent.label })
        .setTitle(truncate(giveaway.title, 240))
        .setDescription(description)
        .addFields(
            { name: 'Platform', value: platforms, inline: true },
            { name: 'Original Value', value: worth, inline: true },
            { name: 'Status', value: '100% free for a limited time', inline: true },
            { name: 'Published', value: publishedAt, inline: true },
            { name: 'Ends', value: `${endAbsolute}\n${endRelative}`, inline: true },
            { name: 'How to Claim', value: instructions, inline: false },
        )
        .setImage(imageUrl)
        .setThumbnail(normalizeUrl(giveaway.thumbnail))
        .setTimestamp(
            new Date(
                Number.isFinite(Date.parse(giveaway.published_date)) ? Date.parse(giveaway.published_date) : Date.now(),
            ),
        )
        .setFooter({ text: 'Powered by GamerPower' });
}

function buildComponents(giveaway) {
    const claimUrl = normalizeUrl(giveaway.open_giveaway_url) || normalizeUrl(giveaway.gamerpower_url);
    const sourceUrl = normalizeUrl(giveaway.gamerpower_url) || normalizeUrl(giveaway.open_giveaway_url);
    const row = new ActionRowBuilder();

    if (claimUrl) {
        row.addComponents(new ButtonBuilder().setLabel('Claim Now').setStyle(ButtonStyle.Link).setURL(claimUrl));
    }

    if (sourceUrl && sourceUrl !== claimUrl) {
        row.addComponents(
            new ButtonBuilder().setLabel('View on GamerPower').setStyle(ButtonStyle.Link).setURL(sourceUrl),
        );
    }

    return row.components.length ? [row] : [];
}

function buildAnnouncementPayload(giveaway) {
    return {
        embeds: [buildEmbed(giveaway)],
        components: buildComponents(giveaway),
    };
}

module.exports = { buildAnnouncementPayload };
