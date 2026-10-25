const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    InteractionContextType,
    PollLayoutType,
    MessageFlags,
} = require('discord.js');

// Discord native poll limits, kept together for easy tuning within API limits.
const MAX_ANSWERS = 10;
const MAX_ANSWER_LENGTH = 55;
const MAX_DURATION_HOURS = 768;
const DEFAULT_DURATION_HOURS = 24;

module.exports = {
    category: 'Management',
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageMessages],
    botPermissions: [PermissionFlagsBits.SendPolls],
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a native Discord poll with up to 10 choices.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption((option) =>
            option.setName('question').setDescription('The poll question.').setMaxLength(300).setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('answers')
                .setDescription('Separate choices with |, for example: Yes | No | Maybe')
                .setMaxLength(1000)
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName('hours')
                .setDescription('How long voting stays open.')
                .setMinValue(1)
                .setMaxValue(MAX_DURATION_HOURS),
        )
        .addBooleanOption((option) => option.setName('multiple').setDescription('Allow voting for multiple choices.')),
    async execute(interaction) {
        const answers = interaction.options
            .getString('answers', true)
            .split('|')
            .map((answer) => answer.trim())
            .filter(Boolean);
        if (
            answers.length < 2 ||
            answers.length > MAX_ANSWERS ||
            answers.some((answer) => answer.length > MAX_ANSWER_LENGTH) ||
            new Set(answers.map((answer) => answer.toLowerCase())).size !== answers.length
        ) {
            await interaction.reply({
                content: `Provide 2–${MAX_ANSWERS} distinct answers separated by |, each up to ${MAX_ANSWER_LENGTH} characters.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply({
            poll: {
                question: { text: interaction.options.getString('question', true) },
                answers: answers.map((text) => ({ text })),
                duration: interaction.options.getInteger('hours') ?? DEFAULT_DURATION_HOURS,
                allowMultiselect: interaction.options.getBoolean('multiple') ?? false,
                layoutType: PollLayoutType.Default,
            },
        });
    },
};
