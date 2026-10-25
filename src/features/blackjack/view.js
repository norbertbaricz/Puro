const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { calculateHand } = require('./cards');
const { formatCurrency } = require('../../shared/utils');

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
        .setDisabled(disabled || state.status !== 'playing' || !state.canDouble || state.balance < state.bet);

    return new ActionRowBuilder().addComponents(hit, stand, double);
}

function buildTable(interaction, state, msgs, colors, options = {}) {
    const revealDealer = options.revealDealer ?? state.status !== 'playing';
    const statusMessage =
        options.statusMessage ||
        (state.status === 'playing' ? msgs.prompt_action || 'Hit, stand, or double down?' : state.outcomeMessage || '');

    const dealerLabel = msgs.dealer_label || 'Dealer — Puro';
    const dealerTitle =
        !revealDealer && state.status === 'playing'
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
        labelLine(msgs.balance_label || 'Stack', formatCurrency(state.balance)),
    ].join('\n');

    const statusPrefix = statusMessage ? `${statusMessage}\n\n` : '';

    return new EmbedBuilder()
        .setColor(determineColor(state.status, colors))
        .setTitle(msgs.title || '♣️ Blackjack Table')
        .setDescription(`${statusPrefix}\`\`\`\n${boardLines}\n\`\`\``)
        .setFooter({
            text:
                state.status === 'playing'
                    ? msgs.footer_table || 'Dealer Puro awaits your move...'
                    : msgs.footer_final || 'Thanks for playing with Puro!',
        })
        .setTimestamp();
}

module.exports = { buildTable, createControls };
