const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load config
let config;
try {
    config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#0099ff' } }; // Fallback config
}

class TicTacToe {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.symbols = {
            X: '❌',
            O: '⭕',
            empty: '⬜'
        };
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
            [0, 4, 8], [2, 4, 6] // Diagonals
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
        .setDescription('Play Tic Tac Toe with another member')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The member you want to challenge')
                .setRequired(true)),

    async execute(interaction) {
        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;

        // Check if opponent is not a bot and not the challenger
        if (opponent.bot) {
            return interaction.reply({ 
                content: '❌ You cannot play against bots!', 
                ephemeral: true 
            });
        }
        if (opponent.id === challenger.id) {
            return interaction.reply({ 
                content: '❌ You cannot play against yourself!', 
                ephemeral: true 
            });
        }

        const game = new TicTacToe();
        const players = {
            'X': challenger,
            'O': opponent
        };

        function createGameBoard() {
            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const position = i * 3 + j;
                    const button = new ButtonBuilder()
                        .setCustomId(`ttt_${position}`)
                        .setStyle(game.board[position] ? 
                            (game.board[position] === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary) : 
                            ButtonStyle.Secondary)
                        .setLabel(game.board[position] ? 
                            game.symbols[game.board[position]] : 
                            game.symbols.empty);

                    if (game.board[position]) {
                        button.setDisabled(true);
                    }

                    row.addComponents(button);
                }
                rows.push(row);
            }
            return rows;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎮 Tic Tac Toe')
            .setDescription(
                `**Current Turn:** ${players[game.currentPlayer]} ${game.symbols[game.currentPlayer]}\n\n` +
                `${challenger} (${game.symbols.X}) **VS** ${opponent} (${game.symbols.O})`
            )
            .setColor(config.colors?.default || '#0099ff')
            .setFooter({ text: 'Game will timeout after 5 minutes of inactivity' })
            .setTimestamp();

        const message = await interaction.reply({
            embeds: [embed],
            components: createGameBoard(),
            fetchReply: true
        });

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === challenger.id || i.user.id === opponent.id,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            const currentPlayer = game.currentPlayer;
            if (i.user.id !== players[currentPlayer].id) {
                return i.reply({ 
                    content: `❌ Wait for your turn! It's ${players[currentPlayer]}'s turn.`, 
                    ephemeral: true 
                });
            }

            const position = parseInt(i.customId.split('_')[1]);
            if (game.makeMove(position)) {
                const winner = game.checkWinner();
                
                if (winner) {
                    const winnerText = winner === 'tie' 
                        ? "🤝 It's a tie!"
                        : `🎉 ${players[winner]} wins with ${game.symbols[winner]}!`;
                    
                    embed.setDescription(winnerText)
                         .setColor(winner === 'tie' ? '#FFD700' : '#00FF00')
                         .setFooter({ text: 'Game ended' });
                    
                    await i.update({
                        embeds: [embed],
                        components: createGameBoard()
                    });
                    collector.stop('game_over');
                } else {
                    embed.setDescription(
                        `**Current Turn:** ${players[game.currentPlayer]} ${game.symbols[game.currentPlayer]}\n\n` +
                        `${challenger} (${game.symbols.X}) **VS** ${opponent} (${game.symbols.O})`
                    );
                    await i.update({
                        embeds: [embed],
                        components: createGameBoard()
                    });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                embed.setDescription('⏰ Game ended due to inactivity!')
                     .setColor('#FF0000')
                     .setFooter({ text: 'Timed out' });
                
                interaction.editReply({
                    embeds: [embed],
                    components: []
                });
            }
        });
    },
};
