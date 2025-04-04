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
                `Hey ${message.author}! 👋`,
                `Hi there ${message.author}! ✨`,
                `Hello ${message.author}! 🌟`,
                `Hewo ${message.author}! 💫`,
                `*waves at* ${message.author}! 🌈`,
                `G'day ${message.author}! 🦘`,
                `Greetings ${message.author}! 🎉`,
                `Hi hi ${message.author}! 🌺`,
                `Henlo ${message.author}! 🌸`,
                `*bounces over to* ${message.author}! 💝`,
                `Haiiii ${message.author}! 🌺`,
                `Hewwo ${message.author}! 🎀`,
                `*happy bounces* Hi ${message.author}! 🦊`,
                `Henlo fren ${message.author}! 🐾`,
                `Hoi ${message.author}! 💕`,
                `*wags tail* Hello ${message.author}! 🐕`,
                `*perks ears* Hi ${message.author}! 🦊`,
                `Awoo~ Welcome ${message.author}! 🐺`,
                `*nuzzles* Heya ${message.author}! 💖`,
                `*boops* Hi there ${message.author}! 🐽`,
                `*purrs* Hello ${message.author}! 🐱`,
                `Greetings and pawsitivity ${message.author}! 🐾`,
                `*flicks tail* Hey ${message.author}! 🦁`,
                `*chirps* Hello there ${message.author}! 🐦`,
                `Mrrp~ Hi ${message.author}! 🐯`,
                `*bounces excitedly* Heyo ${message.author}! 🦘`,
                `*wiggles* Hi hi ${message.author}! 🐰`,
                `*happy floof noises* Hello ${message.author}! 🦊`,
                `Henlo wonderful ${message.author}! 🌸`,
                `*excited tail wags* Hi fren ${message.author}! 💫`,
                `Greetings floofy fren ${message.author}! 🐾`,
                `*happy prances* Hello ${message.author}! 🦌`,
                `Pawsome to see you ${message.author}! 🐾`,
                `*happy squeaks* Hi ${message.author}! 🐹`,
                `*gentle headboop* Hello ${message.author}! 💝`
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
