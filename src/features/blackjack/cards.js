const { randomInt } = require('../../shared/utils');

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
    { rank: 'K', value: 10 },
];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({
                rank: rank.rank,
                value: rank.value,
                isAce: rank.rank === 'A',
                label: `${rank.rank}${suit}`,
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

module.exports = { createDeck, drawCard, calculateHand };
