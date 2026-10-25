const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { groups } = require('../../src/features/help/catalog');
const { createSession } = require('../../src/features/help/sessions');
const { render, CATEGORIES_PER_PAGE } = require('../../src/features/help/view');
const actions = require('../../src/features/help/actions');

module.exports = {
    category: 'Info',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Browse commands by category or search.')
        .addStringOption((option) =>
            option.setName('category').setDescription('Show commands in a category.').setAutocomplete(true),
        )
        .addStringOption((option) =>
            option.setName('search').setDescription('Search command names and descriptions.').setMaxLength(100),
        )
        .addBooleanOption((option) =>
            option.setName('private').setDescription('Show the command browser only to you.'),
        ),
    async autocomplete(interaction) {
        const query = String(interaction.options.getFocused()).toLowerCase();
        const names = [...groups(interaction).keys()].filter((name) => name.toLowerCase().includes(query)).sort();
        await interaction.respond(
            names
                .slice(0, CATEGORIES_PER_PAGE)
                .map((name) => ({ name: name.slice(0, 100), value: name.slice(0, 100) })),
        );
    },
    async execute(interaction) {
        const session = createSession(interaction);
        const category = interaction.options.getString('category');
        session.category = category
            ? session.categories.find((name) => name.toLowerCase() === category.toLowerCase()) || category
            : null;
        session.query = interaction.options.getString('search');
        const payload = render(interaction, session, category || session.query ? 'commands' : 'categories');
        if (interaction.options.getBoolean('private')) payload.flags |= MessageFlags.Ephemeral;
        await interaction.reply(payload);
    },
    ...actions,
};
