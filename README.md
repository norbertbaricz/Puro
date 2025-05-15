# Puro - Discord Bot

## Overview

Puro is a versatile and feature-rich Discord bot designed to enhance server engagement, moderation, and entertainment. Built with Node.js and Discord.js, Puro offers a suite of slash commands and event-driven functionalities, all configurable via a centralized `config.yml` file. Whether you're looking to moderate your server, entertain members, or add interactive games, Puro has you covered!

## Features

### Slash Commands
Puro provides a variety of slash commands for moderation, fun, and utility:

- **/announce**: Send announcements to a specified channel (supports publishing in announcement channels).
- **/avatar**: Display a user's global or server-specific avatar.
- **/clear**: Delete up to 100 messages in a channel, optionally filtering by user.
- **/flip**: Flip one or multiple coins (up to 10) with animated results.
- **/e621**: Fetch images from e621 with safe/explicit filtering (NSFW channel required for explicit content).
- **/help**: View a paginated list of all commands with button navigation.
- **/info**: Display detailed bot and system information (uptime, memory usage, etc.).
- **/love**: Calculate love compatibility between two users with fun messages and tips.
- **/meme**: Retrieve random memes from Reddit, optionally from a specific subreddit.
- **/send**: Send a private DM to a user (requires Manage Messages permission).
- **/top**: Show the top 10 most active members based on message count.
- **/tp**: "Teleport" to another member with a fun, animated message.
- **/ttt**: Play a Tic-Tac-Toe game against another user with interactive buttons.

### Events
Puro responds to various Discord events to enhance server interaction:

- **Ready**: Logs bot startup details and sets a custom status (configurable in `config.yml`).
- **Interaction Create**: Handles slash commands and button interactions (e.g., help command pagination).
- **Message Create**: Responds to greetings (e.g., "hi", "hello") in a specific guild with randomized, wolf-themed replies.

### Configuration
All commands and events are fully customizable via `config.yml`, allowing you to:
- Set custom colors for embeds.
- Define messages for success, errors, and specific interactions.
- Configure cooldowns, limits, and bot status.
- Customize greeting patterns and responses.

## Installation

### Prerequisites
- **Node.js** v16 or higher
- **npm** (comes with Node.js)
- A Discord bot token (obtainable from the [Discord Developer Portal](https://discord.com/developers/applications))
- Optional: e621 API credentials for the `/e621` command

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/username/puro-discord-bot.git
   cd puro-discord-bot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   clientId=your_bot_client_id
   E621_USERNAME=your_e621_username
   E621_API_KEY=your_e621_api_key
   ```
   Note: `E621_USERNAME` and `E621_API_KEY` are required only for the `/e621` command.

4. **Configure the bot**:
   Edit `config.yml` to customize colors, messages, limits, and other settings. Example:
   ```yaml
   status:
     text: "Powered by Skypixel™️"
     type: "Custom"
     url: "https://thewolfdenvr.carrd.co/"
   ```

5. **Run the bot**:
   ```bash
   npm start
   ```

## Usage

1. **Invite the bot**:
   - Add Puro to your Discord server using the bot's invite link (generate it in the Discord Developer Portal).
   - Ensure the bot has permissions to read/send messages, embed links, and manage messages (for certain commands).

2. **Use slash commands**:
   - Type `/` in any text channel to see available commands.
   - Example: `/help` to view all commands or `/flip 5` to flip five coins.

3. **Interact with events**:
   - In the configured guild (default ID: `1217588804328620163`), send greetings like "hi" or "hello" to receive a wolf-themed reply.
   - The bot automatically sets its status upon startup (e.g., "Powered by Skypixel™️").

## Configuration Details

The `config.yml` file is the heart of Puro's customization. Key sections include:
- **colors**: Define embed colors (default, success, error, info, and command-specific).
- **limits**: Set constraints like max message length or coin flips.
- **commands**: Customize messages, colors, and settings for each command.
- **events**: Configure event-specific settings, such as greeting patterns or ready messages.
- **status**: Set the bot's activity and status type (Playing, Streaming, etc.).

Example command configuration:
```yaml
commands:
  love:
    color: '#FF69B4'
    messages:
      self_love: "💝 No self-love checks!"
      error: "❌ Error calculating love!"
```

## Contributing

We welcome contributions to make Puro even better! To contribute:

1. **Fork the repository** and create a new branch:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes** and test thoroughly.

3. **Submit a pull request** with a clear description of your changes.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) and ensure your code adheres to the project's style (e.g., use ESLint if configured).

## Troubleshooting

- **Bot not responding to commands**:
  - Check if the bot has the necessary permissions.
  - Verify the `DISCORD_TOKEN` and `clientId` in `.env`.
  - Ensure commands are registered (re-run `npm start`).

- **e621 command failing**:
  - Confirm `E621_USERNAME` and `E621_API_KEY` are set correctly in `.env`.
  - Ensure the channel is NSFW for explicit content.

- **Greetings not working**:
  - Verify the guild ID in `config.yml` matches your server.
  - Check if the message matches a greeting pattern.

For additional help, open an issue on GitHub or contact the maintainer.

## License

Puro is licensed under the [MIT License](LICENSE). See the LICENSE file for details.

## Acknowledgments

- Built with [Discord.js](https://discord.js.org/) for robust Discord API integration.
- Inspired by the furry and gaming communities for its wolf-themed personality.
- Thanks to all contributors and users for supporting Puro!

---

**Contact**: For questions or suggestions, open an issue on GitHub or reach out via Discord (username: MaxUltimat3).

Happy howling with Puro! 🐺✨