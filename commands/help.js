const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COMMANDS_PER_PAGE = 9;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows commands')
        .addIntegerOption(option =>
            option.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.help;
        try {
            const isButton = interaction.isButton();
            if (isButton) await interaction.deferUpdate();

            const commands = Array.from(interaction.client.commands.values()).map(cmd => ({
                name: cmd.data.name,
                description: cmd.data.description,
                category: cmd.category || 'General'
            })).sort((a, b) => a.name.localeCompare(b.name));

            const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
            const requestedPage = interaction.options.getInteger('page') || 1;
            const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

            const startIndex = (currentPage - 1) * COMMANDS_PER_PAGE;
            const pageCommands = commands.slice(startIndex, startIndex + COMMANDS_PER_PAGE);

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('📚 Command List')
                .setDescription(`Page ${currentPage}/${totalPages}`)
                .setFooter({ text: `Use /help <page> • ${commands.length} commands` })
                .setTimestamp();

            const categorizedCommands = pageCommands.reduce((acc, cmd) => {
                if (!acc[cmd.category]) acc[cmd.category] = [];
                acc[cmd.category].push(cmd);
                return acc;
            }, {});

            for (const [category, categoryCommands] of Object.entries(categorizedCommands)) {
                embed.addFields({
                    name: category,
                    value: categoryCommands.map(cmd => `\`/${cmd.name}\`\n↳ ${cmd.description}`).join('\n\n'),
                    inline: false
                });
            }

            const components = totalPages > 1 ? [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('help_first').setLabel('≪ First').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
                new ButtonBuilder().setCustomId('help_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 1),
                new ButtonBuilder().setCustomId('help_next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(currentPage === totalPages),
                new ButtonBuilder().setCustomId('help_last').setLabel('Last ≫').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
            )] : [];

            if (isButton) {
                await interaction.editReply({ embeds: [embed], components });
            } else {
                await interaction.reply({ embeds: [embed], components});
            }
        } catch (error) {
            console.error('Help error:', error);
            const reply = interaction.deferred ? interaction.editReply : interaction.reply;
            await reply.call(interaction, { content: config.messages.error});
        }
    },
};