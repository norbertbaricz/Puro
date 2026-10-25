const { accentColor } = require('../../core/ui/theme');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

async function showPollResults(interaction) {
    const message = await interaction.targetMessage.fetch();
    if (!message.poll)
        return interaction.editReply({ content: 'This message does not contain a native Discord poll.' });
    const poll = message.poll;
    const answers = [...poll.answers.values()];
    const selections = answers.reduce((sum, answer) => sum + answer.voteCount, 0);
    const text = [
        `## ${poll.question.text || 'Poll results'}`,
        ...answers.map(
            (answer) =>
                `**${answer.text || answer.emoji?.name || 'Choice'}** — ${answer.voteCount} vote${answer.voteCount === 1 ? '' : 's'}`,
        ),
        '',
        `${selections} total selections · ${poll.resultsFinalized ? 'Final results' : 'Voting is open; counts may still change'}`,
        `[Open poll](${message.url})`,
    ].join('\n');
    await interaction.editReply({
        components: [
            new ContainerBuilder()
                .setAccentColor(accentColor(interaction.client))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
}

module.exports = { showPollResults };
