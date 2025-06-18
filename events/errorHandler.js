module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Log all uncaught exceptions and prevent the bot from crashing
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
        });

        // Log all unhandled promise rejections and prevent the bot from crashing
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection:', reason);
        });
    }
};