const DEFAULT_ACCENT = 0xff1493;

function accentColor(client, override) {
    const value = override ?? client?.config?.ui?.accent ?? DEFAULT_ACCENT;
    const color = typeof value === 'string' ? Number.parseInt(value.replace('#', ''), 16) : value;
    return Number.isInteger(color) && color >= 0 && color <= 0xffffff ? color : DEFAULT_ACCENT;
}

module.exports = { accentColor };
