const { SlashCommandBuilder } = require('discord.js');
const { playBlackjack } = require('../../src/features/blackjack/play');

module.exports = {
    guildOnly: true,
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play blackjack against dealer Puro.')
        .addIntegerOption((option) =>
            option.setName('bet').setDescription('Amount of money to wager').setMinValue(1).setRequired(true),
        )
        .addBooleanOption((option) =>
            option.setName('private').setDescription('Reply only to you (ephemeral)').setRequired(false),
        ),

    execute: playBlackjack,
};
