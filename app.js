const { start } = require('./src/bootstrap');

if (require.main === module) {
    start().catch((error) => {
        require('./src/core/logging/logger').logger.fatal('Cannot start Puro', { error });
        process.exitCode = 1;
    });
}

module.exports = { main: start };
