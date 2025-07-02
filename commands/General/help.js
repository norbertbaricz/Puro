const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    category: 'General',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows commands by category'),

    async execute(interaction) {
        const config = interaction.client.config?.commands?.help || { 
            color: '#0099ff',
            messages: {
                error: 'An error occurred while processing the help command.'
            }
        };
        
        try {
            // Get all command categories from the commands folder structure
            const commandsPath = path.join(__dirname, '..'); // Fix: Use parent directory, not ../commands
            const categories = fs.readdirSync(commandsPath)
                .filter(file => fs.statSync(path.join(commandsPath, file)).isDirectory())
                .sort();

            // Count commands in each category
            const categoryData = [];
            let totalCommands = 0;

            for (const category of categories) {
                const categoryCommands = fs.readdirSync(path.join(commandsPath, category))
                    .filter(file => file.endsWith('.js'));
                
                const count = categoryCommands.length;
                totalCommands += count;
                categoryData.push({
                    name: category,
                    count: count
                });
            }

            // Create the main help embed
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('📚 Command Categories')
                .setDescription('Select a category from the menu below to view commands')
                .setFooter({ text: `Total categories: ${categoryData.length} • Total commands: ${totalCommands} • ${new Date().toLocaleString()}` })
                .setTimestamp();

            // Add command counts to the embed
            const commandsField = categoryData.map(cat => `**${cat.name}**\n${cat.count} commands`).join('\n\n');
            embed.addFields({
                name: 'Categories',
                value: commandsField,
                inline: true
            });

            // Create category selection dropdown
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('help_category_select')
                .setPlaceholder('Select a category')
                .addOptions(
                    categoryData.map(category => ({
                        label: category.name,
                        description: `${category.count} commands available`,
                        value: category.name
                    }))
                );

            const actionRow = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({ 
                embeds: [embed], 
                components: [actionRow]
            });

        } catch (error) {
            console.error('Help command error:', error);
            await interaction.reply({ 
                content: config.messages.error
            });
        }
    },

    // This handles the category selection
    async handleCategorySelect(interaction) {
        const selectedCategory = interaction.values[0];
        const config = interaction.client.config?.commands?.help || { 
            color: '#0099ff'
        };

        try {
            // Get commands for the selected category
            const commands = Array.from(interaction.client.commands.values())
                .filter(cmd => (cmd.category || 'General') === selectedCategory)
                .map(cmd => ({
                    name: cmd.data.name,
                    description: cmd.data.description
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            // Create embed for the selected category
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`📂 ${selectedCategory} Commands`)
                .setDescription(`Here are all commands in the ${selectedCategory} category`)
                .setFooter({ text: `${commands.length} commands available` })
                .setTimestamp();

            // Add commands to the embed
            if (commands.length > 0) {
                embed.addFields({
                    name: 'Commands',
                    value: commands.map(cmd => `\`/${cmd.name}\`\n↳ ${cmd.description}`).join('\n\n')
                });
            } else {
                embed.addFields({
                    name: 'No Commands',
                    value: 'This category currently has no commands.'
                });
            }

            // Add back button
            const backButton = new ButtonBuilder()
                .setCustomId('help_back_to_categories')
                .setLabel('Back to Categories')
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder().addComponents(backButton);

            await interaction.update({ 
                embeds: [embed], 
                components: [actionRow] 
            });

        } catch (error) {
            console.error('Category selection error:', error);
            await interaction.update({ 
                content: 'An error occurred while loading this category.',
                components: [] 
            });
        }
    },

    // This handles the back button
    async handleBackButton(interaction) {
        // Simply re-run the original command
        await this.execute(interaction);
    }
};