const { SlashCommandBuilder, PollLayoutType } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('The poll question')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('option1')
                .setDescription('First option')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('option2')
                .setDescription('Second option')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('option3')
                .setDescription('Third option')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('option4')
                .setDescription('Fourth option')
                .setRequired(false))
        .addBooleanOption(option => 
            option.setName('multiselect')
                .setDescription('Allow multiple selections')
                .setRequired(false))
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('Poll duration in minutes')
                .setRequired(false)),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = [
            interaction.options.getString('option1'),
            interaction.options.getString('option2'),
            interaction.options.getString('option3'),
            interaction.options.getString('option4')
        ].filter(option => option !== null);

        const allowMultiselect = interaction.options.getBoolean('multiselect') || false;
        const duration = interaction.options.getInteger('duration') || 24;

        // Acknowledge the interaction
        await interaction.reply({ content: 'Poll created!', ephemeral: true });

        // Send the poll to the channel
        interaction.channel.send({
            poll: {
                question: { text: question },
                answers: options.map(option => ({ text: option })),
                allowMultiselect: allowMultiselect,
                duration: duration,
                layoutType: PollLayoutType.Default
            }
        });
    },
};
