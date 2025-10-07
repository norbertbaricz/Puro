# Puro — Your Discord Pack Companion

Puro is a Discord bot built for communities that thrive on energy, friendliness, and playful structure. Every interaction is designed to keep conversations moving, reward participation, and give staff the tools they need without feeling heavy-handed.

---

## How Puro Behaves in Your Server

- **Always-on presence**  
  Rotating custom statuses share live stats such as total servers, member counts, premium dens, and uptime so the pack always knows what Puro is tracking.

- **Conversation greeter**  
  Regex-driven greeting flows listen for warm hellos (“hey”, “yo”, “aloha”, etc.) and reply with adorable, randomized responses that brighten the sender’s day. Cooldowns and probability weighting stop spam while keeping the channel lively.

- **Guided voice hangouts**  
  Hop into the lobby channel and Puro spins up a private voice den named after the member, assigns permissions, and retires the room when everyone leaves. Ownership is transferred automatically if the host drops out.

- **Smart event logging**  
  Readiness, interaction errors, command failures, and activity scans are announced with themed embeds so moderators instantly understand what happened and why.

---

## Command Catalog

Each command is a slash command. The text below summarizes what happens when members use them and how Puro responds.

### Moderation & Management
| Command | What happens |
| --- | --- |
| `/announce` | Launches a guided announcement builder with colorized embeds, optional buttons, auto-publish for announcement channels, and cooldown enforcement for staff. |
| `/thread` | Creates text, announcement, or forum threads, seeds messages if required, and invites up to five members automatically. Private threads are used when supported. |
| `/send` | Delivers direct messages to individuals, roles, or the whole server with error handling for closed inboxes. |
| `/giveaway` | Calculates message activity over a configurable window, surfaces the top contributors, and lets hosts reroll or publish winners. |
| `/allnick` | Mass-updates or resets member nicknames while respecting role hierarchy and summarizing skipped entries. |
| `/react` | Adds or removes reactions across multiple messages with a single request—ideal for moderation follow-up. |
| `/clear` | Bulk deletes messages with friendly warnings when none qualify or permissions are missing. |

### Fun & Social
| Command family | What happens |
| --- | --- |
| `/hug`, `/pat`, `/kiss`, `/poke`, `/adopt`, `/marry`, `/divorce`, `/howl-greeting` (premium) | Sends vibrant embeds and GIFs celebrating social interactions, complete with buttons for accept/decline where it makes sense. |
| `/love`, `/rate`, `/identity-meter`, `/ship`, `/gender` | Generates playful percentages, labels, and descriptions from curated lists in the configuration file. |
| `/truthordare`, `/hangman`, `/ttt`, `/guess`, `/number-guess`, `/coinflip`, `/magic-8-ball`, `/random-joke` | Provides interactive mini-games with reroll buttons, turn timers, and expressive success/failure messaging. |
| `/meme`, `/food`, `/random-meme`, `/random-food` | Fetches fresh media (with caching for speed) and displays origin, stats, and author details. |

### Economy & Progression
| Command | What happens |
| --- | --- |
| `/wallet` | Shows a user’s balance, active job, jobless hint, and cosmetics pulled straight from the shared economy file. |
| `/leaderboard` | Lists the richest pack members with optional private view. |
| `/job` | Lets members browse jobs, review payouts, and switch roles with cool-down reminders. |
| `/work` | Runs job-specific encounters that adjust streaks, balances, and success narratives. |
| `/pay` | Walks the sender through a confirmation flow, applies taxes, handles bad actors (hacker events), and optionally DMs the recipient. |
| `/pickpocket` | Simulates risk-reward theft with configurable outcomes, fines, and cooldowns. |
| `/blackjack`, `/slotmachine` | Interactive casino experiences using dynamic embeds, buttons for actions, and themed color palettes. |

### Insights & Utilities
| Command | What happens |
| --- | --- |
| `/serverinfo`, `/userinfo`, `/activity-top`, `/top` | Surfaces community statistics, top performers, or individual snapshots with friendly formatting. |
| `/info` | Displays creator credits, uptime, latency, system statistics, and optional invite buttons. |
| `/help` | Opens a category-aware selector that lists every command accessible to the user. |
| `/bot-info` (alias via `/info`) | Includes real-time hardware data when available (CPU temperature, memory usage, node versions). |
| `/fetch-e621` | Searches e621 with safety checks, NSFW gating, and per-command rate limits to keep moderation comfortable. |

---

## Premium Experience

Premium dens are supercharged versions of the bot tailored to a specific Discord server. They unlock guild-scoped automations and slash commands that live in `commands/guilds/<slug>` and `events/guilds/<slug>`. Current highlights include:

- **Wolf Den greeting suite**: Dozens of affirmative responses triggered by everyday greetings, making members feel adored the moment they walk in.
- **Temporary voice dens**: Private voice channels created on demand with automatic cleanup and ownership transfers.
- **Guild-branded slash commands**: `/howl-greeting`, `/cave-briefing`, and `/directors-cut` give each premium community a unique spotlight moment.

### How to Unlock Premium

Premium access is sold directly through Discord. A server owner or administrator can:
1. Open your Discord client and navigate to **Puro’s profile**.  
2. Choose the **“Subscribe”** or **Premium** button.  
3. Complete the purchase flow inside Discord (no external storefront required).  
4. After the payment is confirmed, contact the Skypixel support team via DM or dedicated support server to map your guild ID to the premium tier.  
5. Once linked, Puro automatically loads the custom events and commands for that guild—no restart necessary on your side.

Subscriptions can be adjusted or cancelled within Discord’s subscription management panel. Premium-only features remain isolated, so non-premium servers keep the global command set without premium leakage.

---

## Customisation & Configuration

- All text, emojis, colors, cooldowns, and probabilities come from `config.yml`. Update strings without touching code and the bot reacts immediately on restart.
- Randomized arrays ensure variety: add more greetings, jokes, or economy outcomes by editing the relevant list.
- Economy data lives in `database.json`; Puro repairs corrupt files automatically and maintains balances across restarts.
- Jobs, payouts, and scenario texts are defined in `lib/jobs.js`, making it easy to extend or rebalance your economy.

---

## Support & Credits

Puro is curated by the **Skypixel Team**, with special thanks to all the dens that helped shape its voice and feature set.  
Questions, premium activations, or ideas for new interactions? Hop into the Skypixel support hub or DM the team directly on Discord—we’re always listening for the next adorable howl.
