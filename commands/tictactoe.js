const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

class TicTacToe {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.symbols = { X: '❌', O: '⭕', empty: '⬜' };
    }

    makeMove(position) {
        if (this.board[position] === null) {
            this.board[position] = this.currentPlayer;
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            return true;
        }
        return false;
    }

    checkWinner() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a];
            }
        }

        return this.board.includes(null) ? null : 'tie';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ttt')
        .setDescription('Play Tic Tac Toe')
        .addUserOption(option =>
            option.setName('opponent').setDescription('The opponent').setRequired(true)),

    async execute(interaction) {
        const config = interaction.client.config.commands.ttt;
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;

        if (opponent.bot) {
            return interaction.reply({ content: config.messages.bot_opponent, ephemeral: true });
        }
        if (opponent.id === challenger.id) {
            return interaction.reply({ content: config.messages.self_challenge, ephemeral: true });
        }

        const game = new TicTacToe();
        const players = { 'X': challenger, 'O': opponent };

        const createGameBoard = () => Array(3).fill().map((_, i) => new ActionRowBuilder().addComponents(
            Array(3).fill().map((_, j) => {
                const pos = i * 3 + j;
                return new ButtonBuilder()
                    .setCustomId(`ttt_${pos}`)
                    .setStyle(game.board[pos] ? (game.board[pos] === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary) : ButtonStyle.Secondary)
                    .setLabel(game.board[pos] ? game.symbols[game.board[pos]] : game.symbols.empty)
                    .setDisabled(!!game.board[pos]);
            })
        ));

        const embed = new EmbedBuilder()
            .setTitle('🎮 Tic Tac Toe')
            .setDescription(
                `**Current Turn:** ${players[game.currentPlayer]} ${game.symbols[game.currentPlayer]}\n\n` +
                `${challenger} (${game.symbols.X}) **VS** ${opponent} (${game.symbols.O})`
            )
            .setColor(config.color)
            .setFooter({ text: 'Game times out after 5 minutes' })
            .setTimestamp();

        const message = await interaction.reply({
            embeds: [embed],
            components: createGameBoard(),
            flags: 64 // dacă vrei să fie ephemeral, altfel poți elimina complet
        });
        const sentMessage = await interaction.fetchReply();
        // Folosește `sentMessage` pentru collector
        const collector = sentMessage.createMessageComponentCollector({
            filter: i => i.user.id === challenger.id || i.user.id === opponent.id,
            time: 300000
        });

        collector.on('collect', async i => {
            const currentPlayer = game.currentPlayer;
            if (i.user.id !== players[currentPlayer].id) {
                return i.reply({ content: config.messages.not_your_turn.replace('{player}', players[currentPlayer]), ephemeral: true });
            }

            const position = parseInt(i.customId.split('_')[1]);
            if (game.makeMove(position)) {
                const winner = game.checkWinner();
                if (winner) {
                    const winnerText = winner === 'tie' 
                        ? config.messages.tie
                        : config.messages.win.replace('{player}', players[winner]).replace('{symbol}', game.symbols[winner]);
                    embed.setDescription(winnerText)
                        .setColor(winner === 'tie' ? '#FFD700' : '#00FF00')
                        .setFooter({ text: 'Game ended' });
                    await i.update({ embeds: [embed], components: createGameBoard() });
                    collector.stop('game_over');
                } else {
                    embed.setDescription(
                        `**Current Turn:** ${players[game.currentPlayer]} ${game.symbols[game.currentPlayer]}\n\n` +
                        `${challenger} (${game.symbols.X}) **VS** ${opponent} (${game.symbols.O})`
                    );
                    await i.update({ embeds: [embed], components: createGameBoard() });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                embed.setDescription(config.messages.timeout)
                    .setColor('#FF0000')
                    .setFooter({ text: 'Timed out' });
                interaction.editReply({ embeds: [embed], components: [] });
            }
        });
    },
};