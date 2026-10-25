const { MessageFlags } = require('discord.js');
const { onCollect, onEnd } = require('../../shared/collectors');
const { withEconomy, ensureUserRecord } = require('../../services/economy/store');
const { parseColor, pickRandom, formatTemplate, formatCurrency } = require('../../shared/utils');
const { createDeck, drawCard, calculateHand } = require('./cards');
const { buildTable, createControls } = require('./view');
const { isUnknownInteractionError } = require('../../core/interactions/safety');

const GAME_DURATION_MS = 60_000;

async function playBlackjack(interaction) {
    const bet = interaction.options.getInteger('bet');
    const isPrivate = interaction.options.getBoolean('private') || false;

    const config = interaction.client.config?.commands?.blackjack || {};
    const msgs = config.messages || {};
    const colors = {
        table: parseColor(config.color || '#2F3136', '#2F3136'),
        win: parseColor(config.color_win || '#2ECC71', '#2ECC71'),
        lose: parseColor(config.color_lose || '#ED4245', '#ED4245'),
        push: parseColor(config.color_push || '#F1C40F', '#F1C40F'),
    };
    const buttons = {
        hit: msgs.buttons?.hit || 'Hit',
        stand: msgs.buttons?.stand || 'Stand',
        double: msgs.buttons?.double || 'Double',
    };

    if (typeof interaction.inGuild === 'function' ? !interaction.inGuild() : !interaction.guild) {
        return interaction.reply({
            content: msgs.guild_only || '❌ This command can only be used inside a server.',
            flags: MessageFlags.Ephemeral,
        });
    }

    if (bet <= 0) {
        return interaction.reply({
            content: msgs.invalid_bet || '❌ Bet must be a positive amount.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const shouldBeEphemeral = Boolean(isPrivate);
    await interaction.deferReply({ flags: shouldBeEphemeral ? MessageFlags.Ephemeral : undefined });

    const betResult = await withEconomy((db) => {
        const entry = ensureUserRecord(db, interaction.user.id);
        if (entry.balance < bet) {
            return { status: 'insufficient', balance: entry.balance };
        }
        entry.balance -= bet;
        return { status: 'ok', balance: entry.balance };
    });

    if (betResult.status === 'insufficient') {
        return interaction.editReply({
            content: formatTemplate(msgs.insufficient_funds || '❌ You only have ${balance}.', {
                balance: `$${betResult.balance.toLocaleString()}`,
            }),
        });
    }

    const state = {
        deck: createDeck(),
        player: [],
        dealer: [],
        bet,
        status: 'playing',
        canDouble: true,
        balance: betResult.balance,
        outcomeMessage: null,
    };

    const hitSoft17 = config.hit_soft_17 ?? true;

    const draw = () => {
        const card = drawCard(state);
        return card;
    };

    const dealInitial = () => {
        state.player.push(draw(), draw());
        state.dealer.push(draw(), draw());
    };

    const outcomeTemplates = {
        'player-blackjack': msgs.outcome_blackjack || 'Blackjack! You win ${profit}.',
        'player-win': msgs.outcome_player_win || 'You beat Puro and win ${profit}.',
        'dealer-bust': msgs.outcome_dealer_bust || 'Puro busts! You take ${profit}.',
        'dealer-win': msgs.outcome_dealer_win || 'Puro wins this hand. You lose ${loss}.',
        'dealer-blackjack': msgs.outcome_dealer_blackjack || 'Puro shows blackjack and sweeps the table.',
        'player-bust': msgs.outcome_player_bust || 'You bust and lose ${loss}.',
        push: msgs.outcome_push || 'Push. Your bet of ${bet} is returned.',
        timeout: msgs.timeout_loss || 'You took too long. Puro keeps your wager.',
    };

    const buildEmbed = (options) => buildTable(interaction, state, msgs, colors, options);

    const settle = async (status) => {
        if (state.settled) return;
        let winnings = 0;
        let profit;

        if (status === 'player-blackjack') {
            winnings = Math.floor(state.bet * 2.5);
            profit = winnings - state.bet;
        } else if (status === 'player-win' || status === 'dealer-bust') {
            winnings = state.bet * 2;
            profit = state.bet;
        } else if (status === 'push') {
            winnings = state.bet;
            profit = 0;
        } else {
            winnings = 0;
            profit = -state.bet;
        }

        if (status === 'timeout') {
            profit = -state.bet;
        }

        if (winnings > 0) {
            const payout = await withEconomy((db) => {
                const entry = ensureUserRecord(db, interaction.user.id);
                entry.balance += winnings;
                return { balance: entry.balance };
            });
            state.balance = payout.balance;
        }
        state.status = status;
        state.settled = true;
        const replacements = {
            bet: formatCurrency(state.bet),
            payout: formatCurrency(winnings),
            profit: formatCurrency(profit, { sign: 'always' }),
            loss: formatCurrency(Math.abs(Math.min(profit, 0))),
            dealer: 'Puro',
        };

        const templateKey = outcomeTemplates[status] ? status : status === 'timeout' ? 'timeout' : status;
        state.outcomeMessage = formatTemplate(outcomeTemplates[templateKey], replacements);

        const disabledRow = createControls(state, buttons, true);
        const embed = buildEmbed({ revealDealer: true, statusMessage: state.outcomeMessage });
        await interaction.editReply({ embeds: [embed], components: [disabledRow] });
    };

    const concludeIfNeeded = async () => {
        const playerEval = calculateHand(state.player);
        const dealerEval = calculateHand(state.dealer);

        if (playerEval.value === 21 && state.player.length === 2) {
            if (dealerEval.value === 21 && state.dealer.length === 2) {
                await settle('push');
            } else {
                await settle('player-blackjack');
            }
            return true;
        }

        if (dealerEval.value === 21 && state.dealer.length === 2) {
            await settle('dealer-blackjack');
            return true;
        }

        return false;
    };

    const dealerTurn = async () => {
        let dealerEval = calculateHand(state.dealer);
        while (dealerEval.value < 17 || (hitSoft17 && dealerEval.value === 17 && dealerEval.isSoft)) {
            state.dealer.push(draw());
            dealerEval = calculateHand(state.dealer);
        }

        const playerEval = calculateHand(state.player);
        if (dealerEval.isBust) {
            await settle('dealer-bust');
            return;
        }
        if (playerEval.value > dealerEval.value) {
            await settle('player-win');
            return;
        }
        if (playerEval.value < dealerEval.value) {
            await settle('dealer-win');
            return;
        }
        await settle('push');
    };

    let collector;
    try {
        dealInitial();
        if (await concludeIfNeeded()) return;
        const introMessage = msgs.table_intro || 'Puro deals the cards. Make your move!';
        await interaction.editReply({
            embeds: [buildEmbed({ statusMessage: introMessage, revealDealer: false })],
            components: [createControls(state, buttons)],
        });
        const message = await interaction.fetchReply();
        collector = message.createMessageComponentCollector({ time: GAME_DURATION_MS });
    } catch (error) {
        // A wager is only kept after a playable table or a settled hand exists.
        if (!state.settled) {
            await withEconomy((db) => {
                ensureUserRecord(db, interaction.user.id).balance += state.bet;
            });
            state.status = 'cancelled';
        }
        throw error;
    }

    const safeDeferUpdate = async (componentInteraction) => {
        try {
            await componentInteraction.deferUpdate();
            return true;
        } catch (err) {
            if (isUnknownInteractionError(err)) return false;
            throw err;
        }
    };

    onCollect(collector, async (i) => {
        if (i.user.id !== interaction.user.id) {
            await i.reply({
                content: msgs.not_your_turn || 'Only the current player can act on this game.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (state.status !== 'playing') {
            await i.reply({
                content: msgs.already_finished || 'This hand has already finished.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (i.customId === 'bj_hit') {
            if (!(await safeDeferUpdate(i))) return;
            state.canDouble = false;
            state.player.push(draw());
            const evalPlayer = calculateHand(state.player);
            if (evalPlayer.isBust) {
                await settle('player-bust');
                collector.stop('finished');
                return;
            }
            await interaction.editReply({
                embeds: [
                    buildEmbed({
                        statusMessage: pickRandom(msgs.prompt_hit_variants, msgs.prompt_hit || 'You draw a card...'),
                        revealDealer: false,
                    }),
                ],
                components: [createControls(state, buttons)],
            });
            return;
        }

        if (i.customId === 'bj_stand') {
            if (!(await safeDeferUpdate(i))) return;
            state.canDouble = false;
            await dealerTurn();
            collector.stop('finished');
            return;
        }

        if (i.customId === 'bj_double') {
            if (!state.canDouble) {
                await i.reply({
                    content: msgs.double_unavailable || 'You cannot double right now.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (!(await safeDeferUpdate(i))) return;
            const doubleResult = await withEconomy((db) => {
                const entry = ensureUserRecord(db, interaction.user.id);
                if (entry.balance < state.bet) {
                    return { status: 'insufficient', balance: entry.balance };
                }
                entry.balance -= state.bet;
                return { status: 'ok', balance: entry.balance };
            });

            if (doubleResult.status === 'insufficient') {
                await i.followUp(
                    interaction.client.ui.warning(msgs.double_unavailable || 'You cannot double right now.', {
                        flags: MessageFlags.Ephemeral,
                    }),
                );
                return;
            }
            state.bet *= 2;
            state.canDouble = false;
            state.balance = doubleResult.balance;
            state.player.push(draw());
            const evalPlayer = calculateHand(state.player);
            if (evalPlayer.isBust) {
                await settle('player-bust');
                collector.stop('finished');
                return;
            }
            await dealerTurn();
            collector.stop('finished');
            return;
        }
    });

    onEnd(collector, async (_collected, reason) => {
        if (reason === 'finished') {
            return;
        }
        if (state.status === 'playing') {
            await settle('timeout');
        }
    });
}

module.exports = { playBlackjack };
