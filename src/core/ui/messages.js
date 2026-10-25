const {
    EmbedBuilder,
    MessageFlags,
    MessageFlagsBitField,
    MessagePayload,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
} = require('discord.js');
const { accentColor } = require('./theme');
const { UiValidationError, validatePayload } = require('./validate');

// One message style for commands, collectors, channel posts, and direct messages.
const DESCRIPTION_LIMIT = 4096;
const TOTAL_TEXT_LIMIT = 6000;
const DEFAULT_FOOTER = 'Puro • Skypixel';
const RAW_MESSAGE = Symbol('puro.ui.plain');
const TONES = {
    info: { title: 'Puro' },
    success: { title: 'Done', color: 0x2ecc71 },
    warning: { title: 'Please check', color: 0xf1c40f },
    error: { title: 'Unable to complete', color: 0xed4245 },
};
const json = (value) => (typeof value?.toJSON === 'function' ? value.toJSON() : value);
const flagsOf = (value) => new MessageFlagsBitField(value ?? 0).bitfield;

function textLength(embeds) {
    return embeds.reduce(
        (sum, embed) =>
            sum +
            [
                embed.title,
                embed.description,
                embed.footer?.text,
                embed.author?.name,
                ...(embed.fields || []).flatMap((field) => [field.name, field.value]),
            ].reduce((n, text) => n + (text?.length || 0), 0),
        0,
    );
}

function splitDescription(text, limit = DESCRIPTION_LIMIT) {
    if (text.length > TOTAL_TEXT_LIMIT)
        throw new UiValidationError(
            'Message text exceeds the combined 6000-character embed limit. Split it into separate messages.',
        );
    const parts = [];
    while (text.length > limit) {
        let end = text.lastIndexOf('\n', limit);
        if (end < limit / 2) end = limit;
        // Keep UTF-16 surrogate pairs together at a hard boundary.
        if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
        parts.push(text.slice(0, end));
        text = text.slice(end);
    }
    if (text) parts.push(text);
    return parts;
}

function decorate(client, embeds, { tone = 'info', title } = {}) {
    const settings = client?.config?.ui || {};
    const theme = TONES[tone] || TONES.info;
    const configured = tone === 'info' ? undefined : client?.config?.colors?.[tone];
    const color = accentColor(client, configured ?? theme.color);
    const footer = settings.footer ?? DEFAULT_FOOTER;
    let available = TOTAL_TEXT_LIMIT - textLength(embeds);
    for (const [index, embed] of embeds.entries()) {
        embed.color ??= color;
        // Branding never displaces the caller's footer, media, fields, or colors.
        if (!embed.title && title && index === 0 && title.length <= available) {
            embed.title = title;
            available -= title.length;
        }
        if (!embed.footer && footer && footer.length <= available) {
            embed.footer = { text: footer };
            available -= footer.length;
        }
        if (settings.timestamps && !embed.timestamp) embed.timestamp = new Date().toISOString();
    }
    return embeds.map((embed) => new EmbedBuilder(embed));
}

function plainMessage(input) {
    const payload = typeof input === 'string' ? { content: input } : { ...input };
    Object.defineProperty(payload, RAW_MESSAGE, { value: true });
    return payload;
}

function toV2(client, payload, embeds) {
    const components = embeds.map((embed) => {
        const card = new ContainerBuilder().setAccentColor(embed.color ?? accentColor(client));
        const text = [
            embed.author?.name,
            embed.title && `## ${embed.title}`,
            embed.description,
            ...(embed.fields || []).map((field) => `**${field.name}**\n${field.value}`),
            embed.footer?.text && `-# ${embed.footer.text}`,
        ]
            .filter(Boolean)
            .join('\n\n');
        for (const chunk of splitDescription(text, 4000))
            card.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
        const urls = [embed.image?.url, embed.thumbnail?.url].filter(Boolean);
        if (urls.length)
            card.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(...urls.map((url) => ({ media: { url } }))),
            );
        return card;
    });
    return {
        ...payload,
        content: null,
        embeds: [],
        components: [...components, ...(payload.components || [])],
        flags: flagsOf(payload.flags) | MessageFlags.IsComponentsV2,
    };
}

function formatMessage(client, input, options = {}) {
    if (!input) return input;
    if (input instanceof MessagePayload)
        return new MessagePayload(input.target, formatMessage(client, input.options, options));
    const payload = typeof input === 'string' ? { content: input } : input;
    if (payload[RAW_MESSAGE] || client?.config?.ui?.auto_embeds === false) return payload;
    // V2 layouts and native polls have their own Discord presentation.
    if (flagsOf(payload.flags) & MessageFlags.IsComponentsV2 || payload.poll || payload.stickers?.length)
        return payload;
    const hasText = typeof payload.content === 'string' && payload.content.length > 0;
    const embeds = (payload.embeds || []).map((embed) => structuredClone(json(embed)));
    if (!hasText && !embeds.length) return payload; // Attachment-only and component-only edits.
    const result = { ...payload };
    if (hasText) {
        const title = options.title || TONES[options.tone || 'info']?.title || 'Puro';
        const descriptions = splitDescription(payload.content);
        embeds.unshift(...descriptions.map((description, index) => ({ description, ...(index ? {} : { title }) })));
        // Clear previous plain content when this payload is used for an edit.
        result.content = null;
    }
    if (options.v2) return toV2(client, result, decorate(client, embeds, options).map(json));
    result.embeds = decorate(client, embeds, options);
    return result;
}

function createUi(client) {
    function message(input, options) {
        const payload = formatMessage(client, input, options);
        if (client.config.ui?.validate_payloads !== false) validatePayload(payload);
        return payload;
    }
    function notice(description, { title, fields, image, thumbnail, color, footer, tone = 'info', ...payload } = {}) {
        const embeds = splitDescription(String(description)).map((text) => new EmbedBuilder().setDescription(text));
        const embed = embeds[0] || new EmbedBuilder();
        if (!embeds.length) embeds.push(embed);
        embed.setTitle(title || TONES[tone]?.title || 'Puro');
        if (fields?.length) embed.addFields(fields);
        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (color !== undefined) embed.setColor(color);
        if (footer) embed.setFooter(typeof footer === 'string' ? { text: footer } : footer);
        return message({ ...payload, embeds }, { tone });
    }
    return Object.freeze({
        message,
        plain: plainMessage,
        info: (text, options) => notice(text, { ...options, tone: 'info' }),
        success: (text, options) => notice(text, { ...options, tone: 'success' }),
        warning: (text, options) => notice(text, { ...options, tone: 'warning' }),
        error: (text, options) => notice(text, { ...options, tone: 'error' }),
    });
}

module.exports = { createUi, formatMessage, plainMessage, flagsOf };
