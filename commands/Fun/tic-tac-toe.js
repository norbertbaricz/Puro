const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

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
                const button = new ButtonBuilder()
                    .setCustomId(`ttt_${pos}`)
                    .setStyle(symbol ? (symbol === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary) : ButtonStyle.Secondary)
                    .setDisabled(isGameOver || !!symbol);

                return symbol
                    ? button.setLabel(game.symbols[symbol])
                    : button.setLabel('\u200b'); // zero-width space keeps the button valid while appearing empty
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
            option.setName('opponent').setDescription('Your opponent').setRequired(true))
        .addStringOption(option =>
            option.setName('first')
                .setDescription('Who plays first?')
                .addChoices(
                    { name: 'Random', value: 'random' },
                    { name: 'Challenger (you)', value: 'challenger' },
                    { name: 'Opponent', value: 'opponent' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const channelId = interaction.channel.id;
        if (activeGames.has(channelId)) {
            return interaction.reply({ content: 'A game is already in progress in this channel.', flags: MessageFlags.Ephemeral });
        }

        try {
            const opponent = interaction.options.getUser('opponent');
            const challenger = interaction.user;
            const pickedFirst = interaction.options.getString('first') || 'random';

            const cfg = interaction.client.config.commands.ttt || {
                color: '#5865F2',
                messages: {
                    bot_opponent: 'You cannot play against a bot.',
                    self_challenge: 'You cannot challenge yourself.',
                    not_your_turn: "It's not your turn! It's {player}'s turn.",
                    tie: "It's a tie!",
                    win: '{player} wins as {symbol}! 🎉',
                    timeout: '⏳ The game timed out due to inactivity.'
                }
            };

            if (opponent.bot) {
                return interaction.reply({ content: cfg.messages.bot_opponent, flags: MessageFlags.Ephemeral });
            }
            if (opponent.id === challenger.id) {
                return interaction.reply({ content: cfg.messages.self_challenge, flags: MessageFlags.Ephemeral });
            }

            // Invitation step
            const invite = new EmbedBuilder()
                .setTitle('🎮 Tic Tac Toe')
                .setDescription(`${challenger} challenged ${opponent} to a game!\n\nPress Accept to play.`)
                .setColor(cfg.color)
                .setFooter({ text: 'Invitation expires in 30 seconds.' })
                .setTimestamp();

            const inviteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ttt_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('ttt_decline').setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

            await interaction.reply({ embeds: [invite], components: [inviteRow] });
            const inviteMsg = await interaction.fetchReply();

            const inviteCollector = inviteMsg.createMessageComponentCollector({ time: 30000 });
            let accepted = false;

            inviteCollector.on('collect', async i => {
                if (i.user.id !== opponent.id) {
                    await i.reply({ content: 'Only the challenged opponent can respond.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'ttt_decline') {
                    inviteCollector.stop('declined');
                    const declined = EmbedBuilder.from(invite)
                        .setDescription(`${opponent} declined the challenge.`)
                        .setColor('#ff0000');
                    const disabled = new ActionRowBuilder().addComponents(inviteRow.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ embeds: [declined], components: [disabled] });
                    return;
                }
                if (i.customId === 'ttt_accept') {
                    accepted = true;
                    inviteCollector.stop('accepted');
                    const disabled = new ActionRowBuilder().addComponents(inviteRow.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                }
            });

            inviteCollector.on('end', async (_c, reason) => {
                if (!accepted) {
                    if (reason === 'time') {
                        const timed = EmbedBuilder.from(invite)
                            .setDescription('Invitation expired.')
                            .setColor('#ffcc00');
                        const disabled = new ActionRowBuilder().addComponents(inviteRow.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await interaction.editReply({ embeds: [timed], components: [disabled] }).catch(() => {});
                    }
                    return;
                }

                // Decide who is X and starts
                let xPlayer, oPlayer;
                if (pickedFirst === 'challenger') {
                    xPlayer = challenger; oPlayer = opponent;
                } else if (pickedFirst === 'opponent') {
                    xPlayer = opponent; oPlayer = challenger;
                } else { // random
                    if (Math.random() < 0.5) { xPlayer = challenger; oPlayer = opponent; } else { xPlayer = opponent; oPlayer = challenger; }
                }

                let players = { X: xPlayer, O: oPlayer };
                let rematches = 0;

                const startMatch = async () => {
                    const game = new TicTacToe();
                    game.currentPlayer = 'X';

                    activeGames.set(channelId, game);

                    const getEmbedDescription = (winner = null) => {
                        if (winner) {
                            return winner === 'tie'
                                ? cfg.messages.tie
                                : cfg.messages.win.replace('{player}', players[winner]).replace('{symbol}', game.symbols[winner]);
                        }
                        return `**Current Turn:** ${players[game.currentPlayer]} ${game.symbols[game.currentPlayer]}\n\n${players.X} (${game.symbols.X}) **vs** ${players.O} (${game.symbols.O})`;
                    };

                    const embed = new EmbedBuilder()
                        .setTitle('🎮 Tic Tac Toe')
                        .setDescription(getEmbedDescription())
                        .setColor(cfg.color)
                        .setFooter({ text: 'Game ends after 5 minutes of inactivity.' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed], components: createGameBoard(game) });
                    const message = await interaction.fetchReply();

                    const collector = message.createMessageComponentCollector({
                        filter: i => i.user.id === players.X.id || i.user.id === players.O.id,
                        time: 300000
                    });

                    collector.on('collect', async i => {
                        if (!i.customId.startsWith('ttt_')) return;
                        if (i.user.id !== players[game.currentPlayer].id) {
                            await i.reply({ content: cfg.messages.not_your_turn.replace('{player}', players[game.currentPlayer]), flags: MessageFlags.Ephemeral });
                            return;
                        }
                        const position = parseInt(i.customId.split('_')[1]);
                        if (!game.makeMove(position)) {
                            await i.reply({ content: 'That spot is already taken!', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        const winner = game.checkWinner();

                        if (winner) {
                            collector.stop('game_over');
                            embed.setDescription(getEmbedDescription(winner))
                                 .setColor(winner === 'tie' ? '#FFD700' : '#00FF00');

                            const endRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('ttt_rematch').setLabel('Rematch').setStyle(ButtonStyle.Secondary).setEmoji('🔁').setDisabled(rematches >= 1),
                                new ButtonBuilder().setCustomId('ttt_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                            );
                            await i.update({ embeds: [embed], components: [ ...createGameBoard(game, true), endRow ] });

                            const endMsg = await interaction.fetchReply();
                            const endCollector = endMsg.createMessageComponentCollector({ time: 60000 });
                            endCollector.on('collect', async btn => {
                                if (![players.X.id, players.O.id].includes(btn.user.id)) {
                                    await btn.reply({ content: 'Only players can use these buttons.', flags: MessageFlags.Ephemeral });
                                    return;
                                }
                                if (btn.customId === 'ttt_close') {
                                    endCollector.stop('closed');
                                    const disabled = new ActionRowBuilder().addComponents(endRow.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                                    await btn.update({ components: [ ...createGameBoard(game, true), disabled ] });
                                    activeGames.delete(channelId);
                                    return;
                                }
                                if (btn.customId === 'ttt_rematch' && rematches < 1) {
                                    rematches += 1;
                                    // swap players for fairness
                                    players = { X: players.O, O: players.X };
                                    await btn.deferUpdate();
                                    await startMatch();
                                    endCollector.stop('rematch');
                                }
                            });

                            endCollector.on('end', async (_c2, reason2) => {
                                if (reason2 === 'time') {
                                    const disabled = new ActionRowBuilder().addComponents(endRow.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                                    await interaction.editReply({ components: [ ...createGameBoard(game, true), disabled ] }).catch(() => {});
                                    activeGames.delete(channelId);
                                }
                            });
                        } else {
                            embed.setDescription(getEmbedDescription());
                            await i.update({ embeds: [embed], components: createGameBoard(game) });
                        }
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            embed.setDescription(cfg.messages.timeout)
                                 .setColor('#FF0000')
                                 .setFooter({ text: 'Game timed out.' });
                            interaction.editReply({ embeds: [embed], components: createGameBoard(game, true) }).catch(() => {});
                            activeGames.delete(channelId);
                        }
                    });
                };

                await startMatch();
            });

        } catch (error) {
            console.error("TicTacToe Error:", error);
            activeGames.delete(interaction.channel.id);
            if (!interaction.replied && !interaction.deferred) {
                 await interaction.reply({ content: 'A critical error occurred while starting the game.', flags: MessageFlags.Ephemeral });
            } else {
                 await interaction.editReply({ content: 'A critical error occurred, the game has been cancelled.', components: [] });
            }
        }
    },
};
