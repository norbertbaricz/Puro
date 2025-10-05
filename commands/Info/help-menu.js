const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, Collection } = require('discord.js');

function collectVisibleCommands(client, guildId) {
    const visible = new Collection();
    client.commands.forEach((cmd, name) => visible.set(name, cmd));

    if (guildId && client.guildCommands instanceof Map) {
        const scoped = client.guildCommands.get(guildId);
        if (scoped) {
            scoped.forEach((cmd, name) => visible.set(name, cmd));
        }
    }

    return Array.from(visible.values());
}

function groupCommandsByCategory(commands) {
    const categories = new Map();
    for (const command of commands) {
        const category = (command.category || 'Misc').toString();
        const key = category.trim().length ? category.trim() : 'Misc';
        if (!categories.has(key)) {
            categories.set(key, []);
        }
        categories.get(key).push(command);
    }

    for (const list of categories.values()) {
        list.sort((a, b) => a.data.name.localeCompare(b.data.name));
    }

    return categories;
}

function buildCategorySummary(categories) {
    return Array.from(categories.entries())
        .map(([name, cmds]) => ({ name, count: cmds.length }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function createMainMenu(interaction) {
    const config = interaction.client.config?.commands?.help || { color: '#0099ff' };
    const commands = collectVisibleCommands(interaction.client, interaction.guildId);
    const categories = groupCommandsByCategory(commands);
    const summaries = buildCategorySummary(categories);

    const totalCommands = commands.length;
    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('📚 Command Categories')
        .setDescription('Select a category from the menu below to view its commands.')
        .setFooter({ text: `Total categories: ${summaries.length} • Total commands: ${totalCommands}` })
        .setTimestamp();

    const commandsField = summaries.map(cat => `**${cat.name}**\n${cat.count} commands`).join('\n\n');
    embed.addFields({
        name: 'Categories',
        value: commandsField || 'No categories found.',
        inline: true,
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Select a category')
        .addOptions(
            summaries.slice(0, 25).map(category => ({
                label: category.name,
                description: `${category.count} commands available in this category.`,
                value: category.name,
            }))
        );

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);
    return { embeds: [embed], components: [actionRow] };
}

module.exports = {
    category: 'Info',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays all commands sorted by category, with search.')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Show commands from this category')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Search by command name/description')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately (only you can see)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const categoryOpt = interaction.options.getString('category');
            const searchOpt = interaction.options.getString('search');
            const isPrivate = interaction.options.getBoolean('private') || false;

            // Direct category view via option
            if (categoryOpt) {
                const config = interaction.client.config?.commands?.help || { color: '#0099ff' };
                const commands = collectVisibleCommands(interaction.client, interaction.guildId);
                const categories = groupCommandsByCategory(commands);
                const matchKey = Array.from(categories.keys()).find(key => key.toLowerCase() === categoryOpt.toLowerCase());
                const list = matchKey ? categories.get(matchKey) : [];
                const summaryName = matchKey || categoryOpt;

                const embed = new EmbedBuilder()
                    .setColor(config.color)
                    .setTitle(`📂 ${summaryName} Commands`)
                    .setFooter({ text: `${list.length} commands available` })
                    .setTimestamp();
                const commandsList = list.map(cmd => `\`/${cmd.data.name}\`\n↳ ${cmd.data.description || 'No description.'}`).join('\n\n') || 'This category currently has no commands.';
                embed.setDescription(commandsList);

                return await interaction.reply({ embeds: [embed], flags: isPrivate ? MessageFlags.Ephemeral : undefined });
            }

            // Search by name/description
            if (searchOpt) {
                const query = searchOpt.toLowerCase();
                const results = collectVisibleCommands(interaction.client, interaction.guildId)
                    .map(cmd => ({ name: cmd.data.name, description: cmd.data.description, category: cmd.category || 'Misc' }))
                    .filter(c => c.name.toLowerCase().includes(query) || (c.description || '').toLowerCase().includes(query))
                    .sort((a, b) => a.name.localeCompare(b.name));

                const embed = new EmbedBuilder()
                    .setColor('#00bcd4')
                    .setTitle(`🔎 Search: "${searchOpt}" (${results.length})`)
                    .setTimestamp();
                const body = results.slice(0, 20).map(r => `\`/${r.name}\` — ${r.category}\n↳ ${r.description}`).join('\n\n') || 'No matching commands found.';
                embed.setDescription(body);
                if (results.length > 20) embed.setFooter({ text: `Showing first 20 of ${results.length} results` });
                return await interaction.reply({ embeds: [embed], flags: isPrivate ? MessageFlags.Ephemeral : undefined });
            }

            // Default: interactive menu
            const menu = await createMainMenu(interaction);
            await interaction.reply({ ...menu, flags: isPrivate ? MessageFlags.Ephemeral : undefined });
        } catch (error) {
            console.error('Help command execute error:', error);
            await interaction.reply({
                content: 'An error occurred while processing the help command.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },

    // Handles the dropdown menu selection
    async handleCategorySelect(interaction) {
        const selectedCategory = interaction.values[0];
        const config = interaction.client.config?.commands?.help || { color: '#0099ff' };

        try {
            const commands = groupCommandsByCategory(collectVisibleCommands(interaction.client, interaction.guildId)).get(selectedCategory) || [];

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`📂 ${selectedCategory} Commands`)
                .setFooter({ text: `${commands.length} commands available` })
                .setTimestamp();

            if (commands.length > 0) {
                const commandsList = commands.map(cmd => `\`/${cmd.data.name}\`\n↳ ${cmd.data.description || 'No description.'}`).join('\n\n');
                embed.setDescription(commandsList);
            } else {
                embed.setDescription('This category currently has no commands.');
            }

            const backButton = new ButtonBuilder()
                .setCustomId('help_back_to_categories')
                .setLabel('Back to Categories')
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder().addComponents(backButton);

            // Edit the original message to show the commands
            await interaction.update({
                embeds: [embed],
                components: [actionRow]
            });

        } catch (error) {
            console.error('Category selection error:', error);
            await interaction.followUp({
                content: 'An error occurred while loading this category.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },

    // Handles the "Back" button
    async handleBackButton(interaction) {
        try {
            // Recreate the main menu and edit the message
            const menu = await createMainMenu(interaction);
            await interaction.update(menu);
        } catch (error) {
            console.error('Help back button error:', error);
            await interaction.followUp({
                content: 'An error occurred while returning to the main menu.',
                flags: MessageFlags.Ephemeral,
            });
        }
    }
};
