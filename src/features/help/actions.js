const { MessageFlags } = require('discord.js');
const { createSession } = require('./sessions');
const { render, PREFIX } = require('./view');

function update(interaction, session, view, page = 0) {
    const payload = render(interaction, session, view, page);
    if (interaction.message?.flags && !interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
        payload.embeds = [];
        payload.content = null;
    }
    return interaction.update(payload);
}

async function handleComponent(interaction) {
    const [id, action, view, pageText] = interaction.customId.slice(PREFIX.length).split(':');
    const session = interaction.client.helpSessions?.get(id);
    if (!session || session.expires <= Date.now()) {
        if (session) interaction.client.helpSessions.delete(id);
        return interaction.reply({
            content: 'This help menu expired. Run /help again.',
            flags: MessageFlags.Ephemeral,
        });
    }
    if (session.ownerId !== interaction.user.id || session.guildId !== interaction.guildId) {
        return interaction.reply({ content: 'Run /help to open your own menu.', flags: MessageFlags.Ephemeral });
    }
    if (action === 'select') {
        session.category = session.categories[Number(interaction.values[0])] || null;
        session.query = null;
    } else if (action === 'home') {
        session.category = null;
        session.query = null;
    } else if (!['previous', 'next'].includes(action))
        return interaction.reply({
            content: 'This menu belongs to an older version. Run /help again.',
            flags: MessageFlags.Ephemeral,
        });
    await update(interaction, session, view === 'categories' ? 'categories' : 'commands', Number(pageText));
}

async function handleCategorySelect(interaction) {
    const session = createSession(interaction);
    session.category = interaction.values[0];
    await update(interaction, session, 'commands');
}
async function handleBackButton(interaction) {
    await update(interaction, createSession(interaction), 'categories');
}

module.exports = { handleComponent, handleCategorySelect, handleBackButton };
