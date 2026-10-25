const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const { visibleCommands, groups } = require('./catalog');
const { validatePayload } = require('../../core/ui/validate');
const { accentColor } = require('../../core/ui/theme');

const PREFIX = 'puro:help:';
const CATEGORIES_PER_PAGE = 25;
const DEFAULT_PAGE_SIZE = 8;

function button(session, action, view, page, label, disabled = false) {
    // The action is part of the ID even when two controls target the same page.
    return new ButtonBuilder()
        .setCustomId(`${PREFIX}${session.id}:${action}:${view}:${page}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);
}

function render(interaction, session, view = 'categories', requestedPage = 0) {
    const commands = visibleCommands(interaction);
    const categories = groups(interaction);
    const pageSize =
        view === 'categories' ? CATEGORIES_PER_PAGE : interaction.client.config.ui?.help_page_size || DEFAULT_PAGE_SIZE;
    const matching =
        view === 'categories'
            ? session.categories
            : commands.filter(
                  (command) =>
                      (!session.category || String(command.category || 'Misc') === session.category) &&
                      (!session.query ||
                          `${command.data.name} ${command.data.description || ''}`
                              .toLowerCase()
                              .includes(session.query.toLowerCase())),
              );
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    const page = Math.max(0, Math.min(pages - 1, Number.isInteger(requestedPage) ? requestedPage : 0));
    const items = matching.slice(page * pageSize, (page + 1) * pageSize);
    const title =
        view === 'categories'
            ? 'Command browser'
            : session.query
              ? `Search: ${session.query}`
              : `${session.category || 'All'} commands`;
    const lines =
        view === 'categories'
            ? items.map((name) => `**${name}** · ${categories.get(name)?.length || 0} commands`)
            : items.map((command) => `**/${command.data.name}**\n${command.data.description || 'No description.'}`);
    const container = new ContainerBuilder()
        .setAccentColor(accentColor(interaction.client, interaction.client.config.commands?.help?.color))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Puro · ${title}\n${lines.join('\n\n') || 'No commands are currently available.'}`,
            ),
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# Page ${page + 1}/${pages} · ${view === 'categories' ? commands.length : matching.length} commands`,
            ),
        );
    if (view === 'categories' && items.length) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`${PREFIX}${session.id}:select:commands:0`)
                    .setPlaceholder('Choose a category')
                    .addOptions(
                        items.map((name) => ({
                            label: name.slice(0, 100),
                            value: String(session.categories.indexOf(name)),
                            description: `${categories.get(name)?.length || 0} commands`,
                        })),
                    ),
            ),
        );
    }
    if (pages > 1 || view !== 'categories') {
        const controls = [button(session, 'previous', view, Math.max(0, page - 1), 'Previous', page === 0)];
        if (view !== 'categories') controls.push(button(session, 'home', 'categories', 0, 'Categories'));
        controls.push(button(session, 'next', view, Math.min(pages - 1, page + 1), 'Next', page === pages - 1));
        container.addActionRowComponents(new ActionRowBuilder().addComponents(...controls));
    }
    const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
    validatePayload(payload);
    return payload;
}

module.exports = { PREFIX, CATEGORIES_PER_PAGE, render };
