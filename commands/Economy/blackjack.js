const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { readEconomyDB, writeEconomyDB, ensureUserRecord } = require('../../lib/economy');
const { parseColor, randomInt, pickRandom, formatTemplate, formatCurrency } = require('../../lib/utils');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = [
    { rank: 'A', value: 11 },
    { rank: '2', value: 2 },
    { rank: '3', value: 3 },
    { rank: '4', value: 4 },
    { rank: '5', value: 5 },
    { rank: '6', value: 6 },
    { rank: '7', value: 7 },
    { rank: '8', value: 8 },
    { rank: '9', value: 9 },
    { rank: '10', value: 10 },
    { rank: 'J', value: 10 },
    { rank: 'Q', value: 10 },
    { rank: 'K', value: 10 }
];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({
                rank: rank.rank,
                value: rank.value,
                isAce: rank.rank === 'A',
                label: `${rank.rank}${suit}`
            });
        }
    }
    for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function drawCard(state) {
    if (state.deck.length === 0) {
        state.deck = createDeck();
    }
    return state.deck.pop();
}

function calculateHand(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
        if (card.isAce) {
            aces += 1;
            total += 1;
        } else {
            total += card.value;
        }
    }
    let best = total;
    let remainingAces = aces;
    while (remainingAces > 0 && best + 10 <= 21) {
        best += 10;
        remainingAces -= 1;
    }
    const isSoft = best !== total && best <= 21;
    const value = best;
    const isBust = value > 21;
    return { value, min: total, isSoft, isBust };
}

function formatHand(hand, hideSecond) {
    return hand.map((card, idx) => (hideSecond && idx === 1 ? '🂠' : card.label)).join(' ');
}

function formatTotal(hand, reveal, hiddenLabel) {
    if (!reveal) {
        return hiddenLabel || '??';
    }
    const { value, min, isSoft, isBust } = calculateHand(hand);
    if (isBust) {
        return `${value} (bust)`;
    }
    if (isSoft && value !== min) {
        return `${value} (soft)`;
    }
    return `${value}`;
}

function determineColor(status, colors) {
    if (status === 'playing') return colors.table;
    if (status === 'push') return colors.push;
    if (status === 'player-blackjack' || status === 'player-win' || status === 'dealer-bust') {
        return colors.win;
    }
    return colors.lose;
}

function createControls(state, labels, disabled = false) {
    const hit = new ButtonBuilder()
        .setCustomId('bj_hit')
        .setLabel(labels.hit)
        .setEmoji('🃏')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || state.status !== 'playing');

    const stand = new ButtonBuilder()
        .setCustomId('bj_stand')
        .setLabel(labels.stand)
        .setEmoji('✋')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || state.status !== 'playing');

    const double = new ButtonBuilder()
        .setCustomId('bj_double')
        .setLabel(labels.double)
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
        .setDisabled(
            disabled ||
            state.status !== 'playing' ||
            !state.canDouble ||
            state.balance < state.bet
        );

    return new ActionRowBuilder().addComponents(hit, stand, double);
}

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play blackjack against dealer Puro.')
        .setDMPermission(false)
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount of money to wager')
                .setMinValue(1)
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet');
        const isPrivate = interaction.options.getBoolean('private') || false;

        const config = interaction.client.config?.commands?.blackjack || {};
        const msgs = config.messages || {};
        const colors = {
            table: parseColor(config.color || '#2F3136', '#2F3136'),
            win: parseColor(config.color_win || '#2ECC71', '#2ECC71'),
            lose: parseColor(config.color_lose || '#ED4245', '#ED4245'),
            push: parseColor(config.color_push || '#F1C40F', '#F1C40F')
        };
        const buttons = {
            hit: msgs.buttons?.hit || 'Hit',
            stand: msgs.buttons?.stand || 'Stand',
            double: msgs.buttons?.double || 'Double'
        };

        if (typeof interaction.inGuild === 'function' ? !interaction.inGuild() : !interaction.guild) {
            return interaction.reply({
                content: msgs.guild_only || '❌ This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (bet <= 0) {
            return interaction.reply({
                content: msgs.invalid_bet || '❌ Bet must be a positive amount.',
                flags: MessageFlags.Ephemeral
            });
        }

        const shouldBeEphemeral = Boolean(isPrivate);
        await interaction.deferReply(shouldBeEphemeral ? { flags: MessageFlags.Ephemeral } : {});

        const db = readEconomyDB();
        const entry = ensureUserRecord(db, interaction.user.id);
        if (entry.balance < bet) {
            return interaction.editReply({
                content: formatTemplate(msgs.insufficient_funds || '❌ You only have ${balance}.', {
                    balance: `$${entry.balance.toLocaleString()}`
                })
            });
        }

        entry.balance -= bet;
        writeEconomyDB(db);

        const state = {
            deck: createDeck(),
            player: [],
            dealer: [],
            bet,
            status: 'playing',
            canDouble: true,
            balance: entry.balance,
            outcomeMessage: null
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

        const updateBalance = () => {
            state.balance = entry.balance;
        };

        const outcomeTemplates = {
            'player-blackjack': msgs.outcome_blackjack || 'Blackjack! You win ${profit}.',
            'player-win': msgs.outcome_player_win || 'You beat Puro and win ${profit}.',
            'dealer-bust': msgs.outcome_dealer_bust || 'Puro busts! You take ${profit}.',
            'dealer-win': msgs.outcome_dealer_win || 'Puro wins this hand. You lose ${loss}.',
            'dealer-blackjack': msgs.outcome_dealer_blackjack || 'Puro shows blackjack and sweeps the table.',
            'player-bust': msgs.outcome_player_bust || 'You bust and lose ${loss}.',
            'push': msgs.outcome_push || 'Push. Your bet of ${bet} is returned.',
            'timeout': msgs.timeout_loss || 'You took too long. Puro keeps your wager.'
        };

        const buildEmbed = (options = {}) => {
            const revealDealer = options.revealDealer ?? state.status !== 'playing';
            const statusMessage = options.statusMessage || (state.status === 'playing'
                ? (msgs.prompt_action || 'Hit, stand, or double down?')
                : state.outcomeMessage || '');

            const dealerLabel = msgs.dealer_label || 'Dealer — Puro';
            const dealerTitle = (!revealDealer && state.status === 'playing')
                ? `${dealerLabel} (${msgs.dealer_hidden || 'showing one card'})`
                : dealerLabel;
            const playerDisplayName = interaction.member?.displayName || interaction.user.username;
            const playerLabel = `${msgs.player_label || 'Your Hand'} (${playerDisplayName})`;

            const dealerCards = formatHand(state.dealer, !revealDealer && state.status === 'playing');
            const dealerTotal = formatTotal(state.dealer, revealDealer || state.status !== 'playing', msgs.hidden_total);
            const playerCards = formatHand(state.player, false);
            const playerTotal = formatTotal(state.player, true, msgs.hidden_total);

            const labelLine = (label, value) => `${`${label}:`.padEnd(16)} ${value}`;

            const boardLines = [
                dealerTitle,
                labelLine(msgs.cards_label || 'Cards', dealerCards),
                labelLine(msgs.total_label || 'Total', dealerTotal),
                ''.padEnd(32, '─'),
                playerLabel,
                labelLine(msgs.cards_label || 'Cards', playerCards),
                labelLine(msgs.total_label || 'Total', playerTotal),
                labelLine(msgs.bet_label || 'Bet', formatCurrency(state.bet)),
                labelLine(msgs.balance_label || 'Stack', formatCurrency(state.balance))
            ].join('\n');

            const statusPrefix = statusMessage ? `${statusMessage}\n\n` : '';

            return new EmbedBuilder()
                .setColor(determineColor(state.status, colors))
                .setTitle(msgs.title || '♣️ Blackjack Table')
                .setDescription(`${statusPrefix}\`\`\`\n${boardLines}\n\`\`\``)
                .setFooter({
                    text: state.status === 'playing'
                        ? (msgs.footer_table || 'Dealer Puro awaits your move...')
                        : (msgs.footer_final || 'Thanks for playing with Puro!')
                })
                .setTimestamp();
        };

        const settle = async (status) => {
            state.status = status;
            let winnings = 0;
            let profit = 0;

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
                entry.balance += winnings;
            }

            state.balance = entry.balance;
            const replacements = {
                bet: formatCurrency(state.bet),
                payout: formatCurrency(winnings),
                profit: formatCurrency(profit, { sign: 'always' }),
                loss: formatCurrency(Math.abs(Math.min(profit, 0))),
                dealer: 'Puro'
            };

            const templateKey = outcomeTemplates[status] ? status : (status === 'timeout' ? 'timeout' : status);
            state.outcomeMessage = formatTemplate(outcomeTemplates[templateKey], replacements);

            writeEconomyDB(db);

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
            while (
                dealerEval.value < 17 ||
                (hitSoft17 && dealerEval.value === 17 && dealerEval.isSoft)
            ) {
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

        dealInitial();
        updateBalance();

        if (await concludeIfNeeded()) {
            return;
        }

        const introMessage = msgs.table_intro || 'Puro deals the cards. Make your move!';
        await interaction.editReply({
            embeds: [buildEmbed({ statusMessage: introMessage, revealDealer: false })],
            components: [createControls(state, buttons)]
        });

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 60000 });

        const safeDeferUpdate = async (componentInteraction) => {
            try {
                await componentInteraction.deferUpdate();
            } catch (err) {
                if (err?.code !== 10062) {
                    throw err;
                }
            }
        };

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: msgs.not_your_turn || 'Only the current player can act on this game.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (state.status !== 'playing') {
                await i.reply({ content: msgs.already_finished || 'This hand has already finished.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (i.customId === 'bj_hit') {
                await safeDeferUpdate(i);
                state.canDouble = false;
                state.player.push(draw());
                const evalPlayer = calculateHand(state.player);
                if (evalPlayer.isBust) {
                    await settle('player-bust');
                    collector.stop('finished');
                    return;
                }
                await interaction.editReply({
                    embeds: [buildEmbed({ statusMessage: pickRandom(msgs.prompt_hit_variants, msgs.prompt_hit || 'You draw a card...'), revealDealer: false })],
                    components: [createControls(state, buttons)]
                });
                return;
            }

            if (i.customId === 'bj_stand') {
                await safeDeferUpdate(i);
                state.canDouble = false;
                await dealerTurn();
                collector.stop('finished');
                return;
            }

            if (i.customId === 'bj_double') {
                if (!state.canDouble || entry.balance < state.bet) {
                    await i.reply({ content: msgs.double_unavailable || 'You cannot double right now.', flags: MessageFlags.Ephemeral });
                    return;
                }
                await safeDeferUpdate(i);
                entry.balance -= state.bet;
                state.bet *= 2;
                state.canDouble = false;
                updateBalance();
                writeEconomyDB(db);
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

        collector.on('end', async (_collected, reason) => {
            if (reason === 'finished') {
                return;
            }
            if (state.status === 'playing') {
                state.status = 'timeout';
                await settle('timeout');
            }
        });
    }
};
