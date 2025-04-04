module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Ignore bot messages and check for specific guild
        if (message.author.bot || message.guild.id !== '1217588804328620163') return;

        // Convert message to lowercase for easier matching
        const content = message.content.toLowerCase().trim();

        // Regular expressions for greetings
        const greetingPatterns = [
            /^h+e+l+o+$/,           // helo, helloo, heellooo, etc.
            /^h+e+l+l+o+$/,         // hello, helloo, heellooo, etc.
            /^h+i+$/,               // hi, hii, hiii, etc.
            /^h+e+y+$/,             // hey, heyy, heyyy, etc.
            /^h+e+w+o+$/,           // hewo, hewoo, hewwooo, etc.
            /^h+e+l+w+o+$/,         // helwo, hellwoo, etc.
            /^h+a+i+$/,             // hai, haiii, etc.
            /^h+e+i+$/,             // hei, heii, etc.
            /^h+o+i+$/,             // hoi, hoiii, etc.
            /^h+a+y+$/              // hay, hayyy, etc.
        ];

        // Check if the message matches any greeting pattern
        if (greetingPatterns.some(pattern => pattern.test(content))) {
            // Array of possible responses
            const responses = [
                `*perks ears* Hey ${message.author}! 🐺`,
                `*wags fluffy tail* Hi there ${message.author}! 🐺✨`,
                `*howls softly* Hello ${message.author}! 🐺🌟`,
                `*tilts head curiously* Hewo ${message.author}! 🐺💫`,
                `*approaches with wagging tail* ${message.author}! 🐺🌈`,
                `*playful noises* G'day ${message.author}! 🐺`,
                `*happy bounces* Greetings ${message.author}! 🐺🎉`,
                `*excited tail wagging* Hi hi ${message.author}! 🐺🌺`,
                `*friendly smile* Henlo ${message.author}! 🐺🌸`,
                `*bounds over happily* Hi ${message.author}! 🐺💝`,
                `*gentle awoo* Haiiii ${message.author}! 🐺✨`,
                `*playful pounce* Hewwo ${message.author}! 🐺🎀`,
                `*happy zoomies* Hi ${message.author}! 🐺🦊`,
                `*welcoming howl* Henlo pack mate ${message.author}! 🐺🐾`,
                `*wolf tail wag* Hoi ${message.author}! 🐺💕`,
                `*excited dance* Hello ${message.author}! 🐺⭐`,
                `*alert ears* Hi ${message.author}! 🐺🌙`,
                `*joyful awoo~* Welcome ${message.author}! 🐺🌟`,
                `*friendly nuzzle* Heya ${message.author}! 🐺💖`,
                `*gentle boop* Hi there ${message.author}! 🐺✨`,
                `*happy noises* Hello ${message.author}! 🐺🌸`,
                `*wolf pack welcome* Greetings ${message.author}! 🐺🐾`,
                `*flicks tail* Hey ${message.author}! 🐺🌟`,
                `*melodic howl* Hello there ${message.author}! 🐺🌙`,
                `*playful growl* Hi ${message.author}! 🐺💫`,
                `*bounces with energy* Heyo ${message.author}! 🐺✨`,
                `*happy wiggles* Hi hi ${message.author}! 🐺🎉`,
                `*wolf pack greetings* Hello ${message.author}! 🐺🌟`,
                `*friendly approach* Henlo wonderful ${message.author}! 🐺🌸`,
                `*excited welcome* Hi pack mate ${message.author}! 🐺💫`,
                `*wolf pack celebration* Welcome fren ${message.author}! 🐺🐾`,
                `*graceful bow* Hello ${message.author}! 🐺🌙`,
                `*wolf-style welcome* Great to see you ${message.author}! 🐺✨`,
                `*happy yips* Hi ${message.author}! 🐺💝`,
                `*gentle greeting* Welcome to the pack ${message.author}! ��🌟`
            ];

            try {
                // Get a random response
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                
                // Send the response
                await message.reply({
                    content: randomResponse,
                    allowedMentions: { 
                        repliedUser: true // This will ping the user
                    }
                });
            } catch (error) {
                console.error('Error sending greeting response:', error);
            }
        }
    },
};
