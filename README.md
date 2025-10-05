# Puro - Discord Bot

## Bot Overview
Puro is a social-first Discord companion built for packs that want energy, structure, and playful automation. Powered by Discord.js v14 and a deep `config.yml`, the bot mixes advanced moderation, interactive games, and a full economy so communities stay active without juggling multiple bots.

## Core Highlights
- Dynamic rotating statuses, greeting flows, and voice lobby automation keep the server feeling alive day and night.
- 40+ slash commands grouped by Moderation, Management, Fun, Media, Info, and Economy categories, each fully themed via config.
- Rich economy toolkit with jobs, work cooldowns, blackjack, slots, and leaderboards to motivate daily engagement.
- Safety-first utilities for staff including mass nickname tools, reaction management, and intelligent giveaways.
- No-code tailoring: every message, color, cooldown, and limit lives inside `config.yml`, so you can localise and brand the experience.

## Premium Mode
Premium mode unlocks guild-specific automations stored in `events/guilds/<slug>`.
- Mark a guild entry in `config.yml` with `tier: 'premium'` (or `premium: true`).
- Match the `slug` to the folder name (e.g. `the-wolf-den`) and supply the Discord guild ID.
- Premium events cover welcome flows, thematic responses, and bespoke voice-channel behaviour; locate them under `events/guilds/<slug>`.
- Premium commands live in `commands/guilds/<slug>` and register only for the tagged guilds; everything else in `commands/` remains global.
- Guilds without the premium flag automatically fall back to the global catalog so the default experience is always available.

## Command Lineup

### Management & Moderation
- `/announce` – broadcast embeds or plain messages with buttons, thumbnails, and auto-publish controls.
- `/thread` – spin up text, announcement, or forum threads, invite members, and handle private threads.
- `/send` – deliver DM campaigns to individuals, roles, or entire servers with live preview.
- `/giveaway` – reward recent activity by analysing message volume and presenting interactive controls.
- `/allnick` – update or reset nicknames across whole servers while respecting hierarchy.
- `/react` – add or remove multiple reactions across channels in one command, perfect for moderation follow-ups.
- `/clear` – bulk-delete targeted messages with filtering for authors, pins, attachments, and more.

### Fun & Social Play
- `/flip`, `/8ball`, `/truthordare`, `/guess`, `/hangman`, `/tictactoe` – fast party games with rich embeds and reroll buttons.
- `/hug`, `/pat`, `/poke`, `/kiss`, `/adopt`, `/marry`, `/divorce` – social emote commands that keep conversations lively.
- `/love`, `/rate`, `/joke`, `/gender` – playful generators built around configurable message pools.
- `/meme`, `/food` – pull curated memes or foodie shots to keep chats fresh.

### Economy & Progression
- `/wallet` – show personal balance, current job, and flavour text.
- `/leaderboard` – paginate the richest members with private or public views.
- `/job` – browse careers, inspect bonuses, and switch roles with live cooldown tracking.
- `/work` – run job-specific tasks featuring success, failure, and bonus logic.
- `/pay`, `/pickpocket`, `/blackjack`, `/slotmachine` – trade, duel, and gamble using configurable limits and taxes.

### Media & Insight
- `/e621` – search the e621 API with safety filters and per-command limits.
- `/info` – display bot stats including latency, versions, and invite buttons.
- `/serverinfo`, `/userinfo`, `/top`, `/help` – surface community analytics, profile call-outs, and a paginated help centre.

## Event Automations
- **Status rotation** – `config.yml` powers periodic activity changes with placeholders such as `{servers}`, `{members}`, `{premiumGuilds}`, and `{uptime}` to showcase live stats.
- **Greeting engine** – Regex-driven keyword detection greets new chatters with themed responses, probability gates, and cooldowns.
- **Voice lobby manager** (premium) – drop into a lobby channel and Puro spins up private voice rooms, reassigns owners, and cleans up empty spaces.
- **Custom guild hooks** – add bespoke logic under `events/guilds/<slug>` for birthdays, onboarding, or seasonal content without touching core files.

## Personalising Puro
- Update colours, emoji, copywriting, and cooldowns directly inside `config.yml`; arrays support randomised responses in any language.
- Extend the economy by editing `lib/jobs.js` or create entirely new commands under the category folders—Puro auto-registers them on startup.
- Tweak database behaviour via the `database` section, including auto-repair and storage paths for self-hosted deployments.

## Data & Safety
- Economy data persists in `database.json`, automatically backed up and repaired if corruption is detected.
- Event and command loaders include guardrails for missing configs, sandboxing premium features to approved guilds only.
- Extensive use of ephemeral replies keeps moderation actions discreet while still providing rich feedback to staff.

## Credits
Created by Skypixel Team. © Skypixel Team — all rights reserved. Licensed under the ISC license. Community contributions are welcome—open a pull request with improvements or new experiences for the pack!
- **Premium samples** (per guild): `/howl-greeting` for The Wolf Den, `/directors-cut` for Mastera's Animation Empire, and `/cave-briefing` for Spencer's Cave – templates you can customise per client.

## Directory Layout
- `commands/` – global slash commands organised by category.
- `commands/guilds/<slug>/` – premium-only commands scoped to the matching guild from `config.yml`.
- `events/core/` – global event handlers.
- `events/guilds/<slug>/` – premium event hooks for each guild.
- `lib/` – shared helpers, economy logic, and utility functions.
- `config.yml` – single source of truth for messages, colours, limits, premium tiers, and status rotation.
