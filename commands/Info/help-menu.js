const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper function to create the main menu embed, avoiding code repetition
async function createMainMenu(interaction) {
    const config = interaction.client.config?.commands?.help || { color: '#0099ff' };
    const commandsPath = path.join(__dirname, '..');
    const categories = fs.readdirSync(commandsPath)
        .filter(file => fs.statSync(path.join(commandsPath, file)).isDirectory())
        .sort();

    let totalCommands = 0;
    const categoryData = categories.map(category => {
        const categoryCommands = fs.readdirSync(path.join(commandsPath, category))
            .filter(file => file.endsWith('.js'));
        const count = categoryCommands.length;
        totalCommands += count;
        return { name: category, count };
    });

    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('📚 Command Categories')
        .setDescription('Select a category from the menu below to view its commands.')
        .setFooter({ text: `Total categories: ${categories.length} • Total commands: ${totalCommands}` })
        .setTimestamp();

    // Reverting to the old style of displaying categories
    const commandsField = categoryData.map(cat => `**${cat.name}**\n${cat.count} commands`).join('\n\n');
    embed.addFields({
        name: 'Categories',
        value: commandsField || 'No categories found.',
        inline: true
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Select a category')
        .addOptions(
            categoryData.map(category => ({
                label: category.name,
                description: `${category.count} commands available in this category.`,
                value: category.name
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
                const commands = Array.from(interaction.client.commands.values())
                    .filter(cmd => (cmd.category || 'Misc').toLowerCase() === categoryOpt.toLowerCase())
                    .map(cmd => ({ name: cmd.data.name, description: cmd.data.description }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                const embed = new EmbedBuilder()
                    .setColor(config.color)
                    .setTitle(`📂 ${categoryOpt} Commands`)
                    .setFooter({ text: `${commands.length} commands available` })
                    .setTimestamp();
                const commandsList = commands.map(cmd => `\`/${cmd.name}\`\n↳ ${cmd.description}`).join('\n\n') || 'This category currently has no commands.';
                embed.setDescription(commandsList);

                return await interaction.reply({ embeds: [embed], flags: isPrivate ? MessageFlags.Ephemeral : undefined });
            }

            // Search by name/description
            if (searchOpt) {
                const query = searchOpt.toLowerCase();
                const results = Array.from(interaction.client.commands.values())
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
            const commands = Array.from(interaction.client.commands.values())
                .filter(cmd => (cmd.category || 'Misc') === selectedCategory)
                .map(cmd => ({
                    name: cmd.data.name,
                    description: cmd.data.description
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`📂 ${selectedCategory} Commands`)
                .setFooter({ text: `${commands.length} commands available` })
                .setTimestamp();

            if (commands.length > 0) {
                // Reverting to the old style of listing commands
                const commandsList = commands.map(cmd => `\`/${cmd.name}\`\n↳ ${cmd.description}`).join('\n\n');
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
