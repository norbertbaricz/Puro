# Messages and visual style

`client.ui` is the public messaging API. It reads the current configuration on every call, so changing the accent or footer takes effect without restarting.

```yaml
ui:
    accent: '#ff1493'
    footer: 'Puro • Skypixel'
    timestamps: false
    auto_embeds: true
    validate_payloads: true
```

An empty `ui.footer` hides the default footer. Existing embed colors, custom footers, attribution, fields, and media are preserved. `colors.success`, `colors.error`, and optional `colors.warning` override notice colors.

## Ordinary messages

```js
const { MessageFlags } = require('discord.js');

await interaction.reply(
    interaction.client.ui.success('Your settings were saved.', {
        title: 'Settings',
        flags: MessageFlags.Ephemeral,
    }),
);

await interaction.editReply(interaction.client.ui.error('That channel is unavailable.'));
await interaction.followUp(
    interaction.client.ui.warning('The recipient has closed their DMs.', {
        flags: MessageFlags.Ephemeral,
    }),
);

await channel.send(client.ui.info('Welcome to the community!', { title: 'Welcome' }));
await user.send(client.ui.info('Your request was accepted.', { title: 'Request update' }));
await message.reply(client.ui.info('Hello!', { allowedMentions: { repliedUser: false } }));
```

The notice methods accept `title`, `fields`, `image`, `thumbnail`, `color`, and `footer`. Other options, such as `flags`, `components`, `files`, and `allowedMentions`, remain Discord message options.

## Existing payloads and new plugins

```js
await channel.send(
    client.ui.message({
        embeds: [existingEmbed],
        components: [buttons],
        files: [attachment],
    }),
);
```

`reply`, `editReply`, `followUp`, and `update` on incoming interactions also format ordinary text automatically. Both string replies and `{ content: 'Hello' }` receive an embed. Collected component interactions use the same path. Modal payloads are validated without message formatting.

Custom events and direct channel/DM sends must use `client.ui`, as shown above. The framework does not replace Discord SDK prototypes or wrap arbitrary user objects. Component-only edits, empty clears, and attachment-only messages remain partial payloads.

Formatting does not mutate the original payload or its embeds. Long ordinary text is split at embed-description boundaries, within Discord's combined 6000-character embed budget. Invalid fields, excessive text, duplicate IDs, and incompatible layouts fail locally with a diagnostic.

## Native Discord interfaces

Components V2 views, native polls, and stickers keep their native format. A V2 message cannot switch back to legacy embeds. When an ordinary notice updates an existing V2 message, the guard renders the notice as a native card and clears the old legacy fields.

Never combine `IsComponentsV2` with nonempty `content`, `embeds`, or `poll`. New native views should construct their layout explicitly, like `src/features/help/view.js`.

## Explicit plain content and mentions

`/announce` and `/send` default to embed mode. Their explicit `mode: plain` option remains available. Plugin code can opt into plain content with `client.ui.plain(payload)`; payload validation still runs.

Mentions inside an embed do not notify users. For an intentional notification, construct the rich payload first, then add only the required mention to its `content`, using an explicit `allowedMentions` allowlist. `/announce` does this for requested `@everyone` / `@here` notifications after checking Mention Everyone permission. Ordinary bot messages do not create those notifications.

Grant **Embed Links** and **Send Messages** in channels where the bot posts rich messages; files also require **Attach Files**. A failed destination send is reported rather than acknowledged as delivered.

## Collectors

Use `onCollect(collector, handler)` and `onEnd(collector, handler)` from `src/shared/collectors.js` when creating local game or confirmation collectors. They process callbacks in order, catch asynchronous errors, and prevent queued confirmations from executing after a collector stops. The final event reaching a normal SDK collection limit is still processed. Long operations should acknowledge the interaction before doing slow work.

Persistent component files in `components/` do not need a collector; the central router handles them.
