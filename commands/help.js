const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#00FF00' } }; // Fallback config
}

// Commands per page for pagination
const COMMANDS_PER_PAGE = 9;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number to view')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Check if this is a button interaction
            const isButton = interaction.isButton();
            
            // If it's a button interaction, we need to defer the update
            if (isButton) {
                await interaction.deferUpdate();
            }

            const commandsPath = path.join(__dirname);
            let commands = [];

            try {
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                
                for (const file of commandFiles) {
                    try {
                        const command = require(path.join(commandsPath, file));
                        if (command.data) {
                            commands.push({
                                name: command.data.name,
                                description: command.data.description,
                                category: command.category || 'General'
                            });
                        }
                    } catch (error) {
                        console.error(`Error loading command from ${file}:`, error);
                    }
                }
            } catch (error) {
                return interaction.reply({
                    content: '❌ An error occurred while loading commands.',
                    ephemeral: true
                });
            }

            // Sort commands alphabetically
            commands.sort((a, b) => a.name.localeCompare(b.name));

            // Calculate total pages
            const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
            const requestedPage = interaction.options.getInteger('page') || 1;
            const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

            // Get commands for current page
            const startIndex = (currentPage - 1) * COMMANDS_PER_PAGE;
            const pageCommands = commands.slice(startIndex, startIndex + COMMANDS_PER_PAGE);

            const embed = new EmbedBuilder()
                .setColor(config.commands?.help || config.colors?.default || '#00FF00')
                .setTitle('📚 Command List')
                .setDescription(`Page ${currentPage}/${totalPages}`)
                .setFooter({ 
                    text: `Use /help <page> to view different pages • ${commands.length} commands total`
                })
                .setTimestamp();

            // Group commands by category on the current page
            const categorizedCommands = pageCommands.reduce((acc, cmd) => {
                if (!acc[cmd.category]) {
                    acc[cmd.category] = [];
                }
                acc[cmd.category].push(cmd);
                return acc;
            }, {});

            // Add fields for each category
            for (const [category, categoryCommands] of Object.entries(categorizedCommands)) {
                const commandList = categoryCommands
                    .map(cmd => `\`/${cmd.name}\`\n↳ ${cmd.description}`)
                    .join('\n\n');
                
                embed.addFields({
                    name: `${category}`,
                    value: commandList,
                    inline: false
                });
            }

            // Add navigation buttons if there are multiple pages
            const components = [];
            if (totalPages > 1) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('help_first')
                            .setLabel('≪ First')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === 1),
                        new ButtonBuilder()
                            .setCustomId('help_prev')
                            .setLabel('◀ Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 1),
                        new ButtonBuilder()
                            .setCustomId('help_next')
                            .setLabel('Next ▶')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === totalPages),
                        new ButtonBuilder()
                            .setCustomId('help_last')
                            .setLabel('Last ≫')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === totalPages)
                    );
                components.push(row);
            }

            // Send the response based on interaction type
            if (isButton) {
                await interaction.editReply({ embeds: [embed], components });
            } else {
                await interaction.reply({ embeds: [embed], components, ephemeral: true });
            }

        } catch (error) {
            try {
                const reply = interaction.deferred 
                    ? interaction.editReply 
                    : interaction.reply;
                
                await reply.call(interaction, {
                    content: '❌ An error occurred while displaying the help menu.',
                    ephemeral: true
                });
            } catch (e) {
                console.error('Error sending error message:', e);
            }
        }
    },
};
