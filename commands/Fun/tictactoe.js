const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// Folosim o Mapă globală pentru a stoca jocurile active, cheia fiind ID-ul canalului
const activeGames = new Map();

class TicTacToe {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.symbols = { X: '❌', O: '⭕' };
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
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a]; // 'X' or 'O'
            }
        }
        return this.board.includes(null) ? null : 'tie';
    }
}

function createGameBoard(game, isGameOver = false) {
    return Array(3).fill(0).map((_, rowIndex) => 
        new ActionRowBuilder().addComponents(
            Array(3).fill(0).map((_, colIndex) => {
                const pos = rowIndex * 3 + colIndex;
                const symbol = game.board[pos];
                return new ButtonBuilder()
                    .setCustomId(`ttt_${pos}`)
                    .setStyle(symbol ? (symbol === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary) : ButtonStyle.Secondary)
                    .setLabel(symbol ? game.symbols[symbol] : ' ')
                    .setDisabled(isGameOver || !!symbol);
            })
        )
    );
}

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Play Tic Tac Toe against another member.')
        .addUserOption(option =>
            option.setName('opponent').setDescription('Your opponent').setRequired(true)),

    async execute(interaction) {
        const channelId = interaction.channel.id;
        if (activeGames.has(channelId)) {
            return interaction.reply({ content: 'A game is already in progress in this channel.', ephemeral: true });
        }

        try {
            const opponent = interaction.options.getUser('opponent');
            const challenger = interaction.user;
            const config = interaction.client.config.commands.ttt;

            if (opponent.bot) {
                return interaction.reply({ content: config.messages.bot_opponent, ephemeral: true });
            }
            if (opponent.id === challenger.id) {
                return interaction.reply({ content: config.messages.self_challenge, ephemeral: true });
            }

            const game = new TicTacToe();
            const players = { 'X': challenger, 'O': opponent };
            activeGames.set(channelId, game);

            const getEmbedDescription = (winner = null) => {
                if (winner) {
                    return winner === 'tie'
                        ? config.messages.tie
                        : config.messages.win.replace('{player}', players[winner]).replace('{symbol}', game.symbols[winner]);
                }
                return `**Current Turn:** ${players[game.currentPlayer]} ${game.symbols[game.currentPlayer]}\n\n${challenger} (${game.symbols.X}) **vs** ${opponent} (${game.symbols.O})`;
            };

            const embed = new EmbedBuilder()
                .setTitle('🎮 Tic Tac Toe')
                .setDescription(getEmbedDescription())
                .setColor(config.color)
                .setFooter({ text: 'Game ends after 5 minutes of inactivity.' })
                .setTimestamp();

            const message = await interaction.reply({
                embeds: [embed],
                components: createGameBoard(game),
                fetchReply: true
            });

            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === players.X.id || i.user.id === players.O.id,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                if (i.user.id !== players[game.currentPlayer].id) {
                    await i.reply({ content: config.messages.not_your_turn.replace('{player}', players[game.currentPlayer]), ephemeral: true });
                    return;
                }

                const position = parseInt(i.customId.split('_')[1]);
                game.makeMove(position);
                const winner = game.checkWinner();

                if (winner) {
                    collector.stop('game_over');
                    embed.setDescription(getEmbedDescription(winner))
                         .setColor(winner === 'tie' ? '#FFD700' : '#00FF00');
                    await i.update({ embeds: [embed], components: createGameBoard(game, true) });
                } else {
                    embed.setDescription(getEmbedDescription());
                    await i.update({ embeds: [embed], components: createGameBoard(game) });
                }
            });

            collector.on('end', (collected, reason) => {
                activeGames.delete(channelId); // Cel mai important: curăță jocul
                if (reason === 'time') {
                    embed.setDescription(config.messages.timeout)
                         .setColor('#FF0000')
                         .setFooter({ text: 'Game timed out.' });
                    interaction.editReply({ embeds: [embed], components: createGameBoard(game, true) }).catch(console.error);
                }
            });

        } catch (error) {
            console.error("TicTacToe Error:", error);
            activeGames.delete(interaction.channel.id);
            if (!interaction.replied && !interaction.deferred) {
                 await interaction.reply({ content: 'A critical error occurred while starting the game.', ephemeral: true });
            } else {
                 await interaction.editReply({ content: 'A critical error occurred, the game has been cancelled.', components: [] });
            }
        }
    },
};