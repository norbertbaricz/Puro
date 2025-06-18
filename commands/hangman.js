const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Stocăm jocurile active într-o Mapă, folosind ID-ul canalului ca cheie.
const activeGames = new Map();

// LISTA DE CUVINTE EXTINSĂ ȘI CATEGORIZATĂ
const wordList = {
    easy: [
        'cat', 'sun', 'dog', 'ball', 'tree', 'fish', 'bird', 'duck', 'frog', 'wolf', 
        'boat', 'star', 'moon', 'rain', 'fire', 'wind', 'book', 'key', 'door', 'cake',
        'apple', 'grape', 'lemon', 'milk', 'bread', 'water', 'road', 'car', 'bike'
    ],
    medium: [
        'discord', 'computer', 'keyboard', 'bottle', 'adventure', 'mountain', 'forest', 'ocean',
        'library', 'puzzle', 'guitar', 'planet', 'robot', 'dragon', 'castle', 'wizard',
        'galaxy', 'journey', 'treasure', 'pirate', 'mystery', 'shadow', 'spirit',
        'magic', 'crystal', 'diamond', 'engine', 'future', 'jacket', 'island'
    ],
    hard: [
        'javascript', 'developer', 'programming', 'interface', 'metaverse', 'community', 
        'experience', 'encyclopedia', 'photosynthesis', 'onomatopoeia', 'architecture',
        'chrysanthemum', 'archaeology', 'phenomenon', 'synecdoche', 'rhythm',
        'entrepreneur', 'xylophone', 'sovereignty', 'rendezvous', 'bureaucracy',
        'hieroglyph', 'idiosyncratic', 'juxtaposition', 'kaleidoscope', 'magnanimous'
    ]
};

// Reprezentarea vizuală a spânzurătorii (ASCII art)
const hangmanStages = [
    '```\n+---+\n|   |\n    |\n    |\n    |\n    |\n=========\n```', // 0
    '```\n+---+\n|   |\nO   |\n    |\n    |\n    |\n=========\n```', // 1
    '```\n+---+\n|   |\nO   |\n|   |\n    |\n    |\n=========\n```', // 2
    '```\n+---+\n|   |\nO   |\n/|  |\n    |\n    |\n=========\n```', // 3
    '```\n+---+\n|   |\nO   |\n/|\\ |\n    |\n    |\n=========\n```', // 4
    '```\n+---+\n|   |\nO   |\n/|\\ |\n/   |\n    |\n=========\n```', // 5
    '```\n+---+\n|   |\nO   |\n/|\\ |\n/ \\ |\n    |\n=========\n```'  // 6
];

// Funcție ajutătoare pentru a genera și actualiza embed-ul jocului
function createGameEmbed(game, config) {
    const lives = config.max_errors - game.mistakes;
    const description = config.messages.description.replace('{lives}', lives);

    return new EmbedBuilder()
        .setColor(config.color)
        .setTitle(config.messages.title)
        .setDescription(description)
        .addFields(
            { name: 'Hangman', value: hangmanStages[game.mistakes], inline: true },
            { 
                name: config.messages.word_display, 
                value: `\`${game.wordGuessed.join(' ')}\``, 
                inline: true 
            },
            { 
                name: config.messages.guessed_letters, 
                value: game.guessedLetters.length > 0 ? game.guessedLetters.join(', ').toUpperCase() : config.messages.no_letters_guessed 
            }
        )
        .setFooter({ text: config.messages.footer.replace('{userTag}', game.player.tag) });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('Starts a game of Hangman.')
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('Choose the difficulty of the word.')
                .setRequired(false) // Opțional, valoarea implicită va fi 'medium'
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' }
                )),

    async execute(interaction) {
        // Presupunând că fișierul de configurare este încărcat corect pe client
        const config = interaction.client.config.commands.hangman;
        const channelId = interaction.channel.id;

        if (activeGames.has(channelId)) {
            return interaction.reply({ content: config.messages.game_already_running, ephemeral: true });
        }

        await interaction.deferReply();

        // Alegem un cuvânt pe baza dificultății selectate sau 'medium' ca implicit
        const difficulty = interaction.options.getString('difficulty') || 'medium';
        const words = wordList[difficulty];
        const wordToGuess = words[Math.floor(Math.random() * words.length)];

        const game = {
            word: wordToGuess.toLowerCase(),
            wordGuessed: Array(wordToGuess.length).fill('_'),
            guessedLetters: [],
            mistakes: 0,
            player: interaction.user,
            collector: null,
            gameMessage: null,
        };
        activeGames.set(channelId, game);

        const embed = createGameEmbed(game, config);
        game.gameMessage = await interaction.editReply({ embeds: [embed] });

        const filter = m => m.author.id === interaction.user.id;
        game.collector = interaction.channel.createMessageCollector({ filter, time: 300000 }); // 5 minute

        game.collector.on('collect', async m => {
            const guess = m.content.toLowerCase().trim();
            await m.delete().catch(() => {});

            if (!guess || !/^[a-z]+$/.test(guess)) {
                 const msg = await interaction.followUp({ content: config.messages.not_a_letter.replace('{input}', m.content), ephemeral: true });
                 setTimeout(() => msg.delete().catch(() => {}), 3000);
                 return;
            }

            // Verificăm dacă utilizatorul încearcă să ghicească cuvântul întreg
            if (guess.length > 1) {
                if (guess === game.word) {
                    game.collector.stop('win'); // Victorie
                } else {
                    game.mistakes++; // Greșeală
                    const msg = await interaction.followUp({ content: config.messages.wrong_word_guess, ephemeral: true });
                    setTimeout(() => msg.delete().catch(() => {}), 3000);
                }
            } else { // Altfel, este o ghicire de o singură literă
                if (game.guessedLetters.includes(guess) || game.wordGuessed.includes(guess.toUpperCase())) {
                    const msg = await interaction.followUp({ content: config.messages.letter_already_guessed.replace('{letter}', guess), ephemeral: true });
                    setTimeout(() => msg.delete().catch(() => {}), 3000);
                    return;
                }

                game.guessedLetters.push(guess);

                if (game.word.includes(guess)) {
                    for (let i = 0; i < game.word.length; i++) {
                        if (game.word[i] === guess) {
                            game.wordGuessed[i] = guess.toUpperCase();
                        }
                    }
                } else {
                    game.mistakes++;
                }
            }

            // Verificăm starea jocului după fiecare încercare
            if (!game.wordGuessed.includes('_')) {
                game.collector.stop('win');
                return;
            }
            if (game.mistakes >= config.max_errors) {
                game.collector.stop('lose');
                return;
            }
            
            const updatedEmbed = createGameEmbed(game, config);
            await game.gameMessage.edit({ embeds: [updatedEmbed] });
        });

        game.collector.on('end', async (collected, reason) => {
            // FIX: Verificăm dacă jocul încă există în mapă. Dacă nu, înseamnă că logica de finalizare a rulat deja.
            if (!activeGames.has(channelId)) {
                return;
            }
            
            // Ștergem jocul din mapă pentru a preveni rulări multiple și pentru a curăța memoria.
            activeGames.delete(channelId);

            // FIX: Folosim direct obiectul `game` din scope, nu `finalGame`, pentru a evita eroarea.
            if (reason === 'win') {
                game.wordGuessed = game.word.toUpperCase().split('');
            }
            
            let finalEmbed = new EmbedBuilder();
            if (reason === 'win') {
                finalEmbed
                    .setColor(interaction.client.config.colors.success)
                    .setTitle(config.messages.win_title)
                    .setDescription(config.messages.win_description.replace('{word}', game.word.toUpperCase()))
                    .addFields({ name: 'The Word Was:', value: `\`${game.wordGuessed.join(' ')}\`` });
            } else if (reason === 'lose') {
                finalEmbed
                    .setColor(interaction.client.config.colors.error)
                    .setTitle(config.messages.lose_title)
                    .setDescription(config.messages.lose_description.replace('{word}', game.word.toUpperCase()))
                    .addFields({ name: 'Hangman', value: hangmanStages[config.max_errors] });
            } else { // Timeout
                finalEmbed
                    .setColor('#FFA500')
                    .setTitle(config.messages.game_timeout)
                    .setDescription(`The word was: **${game.word.toUpperCase()}**`);
            }
            
            await game.gameMessage.edit({ embeds: [finalEmbed], components: [] });
        });
    },
};
