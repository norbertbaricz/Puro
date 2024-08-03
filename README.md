# Puro - Discord Bot

## Description

Puro is a basic Discord bot that provides slash commands and automatically uploads and deploys them to the Discord API. The bot offers several commands and events for server protection and fun!

## Features

### Commands

- `/avatar` - Displays a user's avatar.
- `/clear` - Clears a specified number of messages from a channel.
- `/coinflip` - Flips a coin and shows the result.
- `/e621` - Searches for images on e621 (NSFW).
- `/help` - Displays the list of available commands and their descriptions.
- `/info` - Provides information about the bot.
- `/love` - Calculates love compatibility between two users.
- `/meme` - Displays a random meme.
- `/polls` - Creates a poll.
- `/tp` - Teleports a user to a specified location (fictional functionality for fun).

### Events

- **Server Protection**:
  - Monitors messages for spam detection and deletion.
  - Detects abusive behavior and warns or sanctions the involved users.
- **Entertainment**:
  - Greets new members when they join the server.
  - Sends farewell messages when a member leaves the server.

## Installation

1. Clone this repository:
    ```bash
    git clone https://github.com/username/discord-bot.git
    ```
2. Navigate to the project directory:
    ```bash
    cd discord-bot
    ```
3. Install the required dependencies:
    ```bash
    npm install
    ```
4. Create a `.env` file in the root directory of the project and add the following:
    ```
    DISCORD_TOKEN=your_discord_bot_token
    ```
5. Run the bot:
    ```bash
    npm start
    ```

## Project Structure

- **commands**: Contains all the available command files.
  - `avatar.js`
  - `clear.js`
  - `coinflip.js`
  - `e621.js`
  - `help.js`
  - `info.js`
  - `love.js`
  - `meme.js`
  - `polls.js`
  - `tp.js`
- **events**: Contains files that handle the bot's events.
  - `interactionCreate.js`
  - `ready.js`
- **handler**: Contains the logic for handling commands and events.
  - `register.js`
- `.env`: File for environment variables.
- `.gitignore`: File to exclude files and directories from Git.
- `app.js`: Entry point of the application.
- `config.yml`: Configuration file.
- `package-lock.json`: Automatically generated file for managing dependencies.
- `package.json`: NPM configuration file.

## Usage

Once the bot is running, you can use the slash commands in any Discord server where the bot is added. Make sure the bot has the necessary permissions to execute the respective commands.

## Contributions

Contributions are welcome! Please follow these steps to contribute to the project:

1. Fork the repository.
2. Create a new branch:
    ```bash
    git checkout -b feature/feature-name
    ```
3. Make the necessary changes and commit them:
    ```bash
    git commit -m "Added feature X"
    ```
4. Push the changes to the main repository:
    ```bash
    git push origin feature/feature-name
    ```
5. Create a pull request and wait for approval.

## License

This project is licensed under the [MIT License](LICENSE).

---

Thank you for using Puro! If you have any questions or suggestions, please open an issue or contact me directly.
