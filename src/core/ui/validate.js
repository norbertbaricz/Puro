const { MessageFlags, MessageFlagsBitField, ComponentType } = require('discord.js');

// Discord message/form limits. Disabled components still require unique custom IDs.
const LIMITS = {
    customId: 100,
    legacyRows: 5,
    rowButtons: 5,
    components: 40,
    content: 2000,
    embeds: 10,
    embedText: 6000,
};

class UiValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UiValidationError';
        this.code = 'PURO_INVALID_UI';
    }
}
const reject = (message) => {
    throw new UiValidationError(message);
};
const json = (value) => (typeof value?.toJSON === 'function' ? value.toJSON() : value);

function validateComponents(components = []) {
    const customIds = new Set();
    const numericIds = new Set();
    let count = 0;
    function visit(input, location) {
        const item = json(input);
        if (!item || typeof item !== 'object') reject(`${location}: expected a component object.`);
        if (++count > LIMITS.components) reject(`A message may contain at most ${LIMITS.components} components.`);
        if (item.custom_id !== undefined) {
            if (typeof item.custom_id !== 'string' || !item.custom_id.length || item.custom_id.length > LIMITS.customId)
                reject(`${location}: custom_id must contain 1–100 characters.`);
            if (customIds.has(item.custom_id))
                reject(`${location}: duplicate custom_id '${item.custom_id}', including disabled controls.`);
            customIds.add(item.custom_id);
        }
        if (item.id !== undefined && item.id !== 0) {
            if (numericIds.has(item.id)) reject(`${location}: duplicate numeric component id '${item.id}'.`);
            numericIds.add(item.id);
        }
        if (item.type === ComponentType.ActionRow) {
            const children = (item.components || []).map(json);
            if (!children.length || children.length > LIMITS.rowButtons)
                reject(`${location}: an action row needs 1–5 controls.`);
            if (children.length > 1 && children.some((child) => child.type !== ComponentType.Button))
                reject(`${location}: select menus must occupy their own action row.`);
        }
        (item.components || []).forEach((child, index) => visit(child, `${location}.components[${index}]`));
        if (item.accessory) visit(item.accessory, `${location}.accessory`);
        if (item.component) visit(item.component, `${location}.component`);
    }
    components.forEach((item, index) => visit(item, `components[${index}]`));
    return { count, customIds };
}

function validatePayload(input, { modal = false } = {}) {
    if (!input) return input;
    const payload = typeof input === 'string' ? { content: input } : json(input.options || input);
    if (payload.content && payload.content.length > LIMITS.content)
        reject(`Message content exceeds ${LIMITS.content} characters.`);
    const flags = new MessageFlagsBitField(payload.flags ?? 0).bitfield;
    const v2 = Boolean(flags & MessageFlags.IsComponentsV2);
    if (v2 && (payload.content || payload.embeds?.length || payload.poll || payload.stickers?.length))
        reject('Components V2 cannot be mixed with legacy content, embeds, polls, or stickers.');
    if (!v2 && (payload.components?.length || 0) > LIMITS.legacyRows)
        reject('Legacy messages and forms allow at most five top-level component rows.');
    if (modal && (!payload.custom_id || !payload.title || !payload.components?.length))
        reject('A modal needs custom_id, title, and components.');
    validateComponents(payload.components || []);
    const embeds = (payload.embeds || []).map(json);
    if (embeds.length > LIMITS.embeds) reject('A message may contain at most ten embeds.');
    for (const [index, embed] of embeds.entries()) {
        for (const [key, max] of [
            ['title', 256],
            ['description', 4096],
        ])
            if (embed[key]?.length > max) reject(`embeds[${index}].${key} exceeds ${max} characters.`);
        if (embed.footer?.text?.length > 2048 || embed.author?.name?.length > 256)
            reject(`embeds[${index}]: footer or author exceeds Discord's text limits.`);
        if (embed.fields?.length > 25) reject(`embeds[${index}] exceeds 25 fields.`);
        for (const field of embed.fields || [])
            if (!field.name?.length || field.name.length > 256 || !field.value?.length || field.value.length > 1024)
                reject(`embeds[${index}]: fields need a name (1–256 characters) and value (1–1024 characters).`);
    }
    const textLength = embeds.reduce(
        (sum, embed) =>
            sum +
            [
                embed.title,
                embed.description,
                embed.footer?.text,
                embed.author?.name,
                ...(embed.fields || []).flatMap((field) => [field.name, field.value]),
            ].reduce((total, value) => total + (value?.length || 0), 0),
        0,
    );
    if (textLength > LIMITS.embedText) reject('Combined embed text exceeds 6000 characters.');
    return input;
}

module.exports = { LIMITS, UiValidationError, validateComponents, validatePayload };
