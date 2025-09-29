function parseColor(input, fallback = '#5865F2') {
    const source = typeof input === 'string' && input.trim().length ? input : fallback;
    const sanitized = source.startsWith('#') ? source.slice(1) : source;
    const numeric = Number.parseInt(sanitized, 16);
    if (Number.isNaN(numeric)) {
        const fb = fallback.startsWith('#') ? fallback.slice(1) : fallback;
        return Number.parseInt(fb, 16) || 0x5865f2;
    }
    return numeric;
}

function pickRandom(list, fallback = null) {
    if (Array.isArray(list) && list.length > 0) {
        const index = Math.floor(Math.random() * list.length);
        return list[index];
    }
    return fallback;
}

function randomInt(min, max) {
    const lower = Math.ceil(Number.isFinite(min) ? min : 0);
    const upper = Math.floor(Number.isFinite(max) ? max : lower);
    const range = Math.max(upper - lower + 1, 1);
    return lower + Math.floor(Math.random() * range);
}

function randomFloat(min, max) {
    const lower = Number.isFinite(min) ? min : 0;
    const upper = Number.isFinite(max) ? max : lower;
    if (upper === lower) return upper;
    return Math.random() * (upper - lower) + lower;
}

function formatCurrency(amount, options = {}) {
    const signMode = options.sign || 'auto'; // auto, always, never, negative
    const symbolOption = Object.prototype.hasOwnProperty.call(options, 'symbol')
        ? options.symbol
        : '$';
    const symbol = symbolOption === false ? '' : (symbolOption || '');

    const value = Math.abs(amount);
    const valueStr = Number(value).toLocaleString();

    let sign = '';
    if (signMode === 'always') {
        sign = amount >= 0 ? '+' : '-';
    } else if (signMode === 'auto' && amount < 0) {
        sign = '-';
    } else if (signMode === 'negative' && amount < 0) {
        sign = '-';
    }

    const currency = `${symbol}${valueStr}`;
    return `${sign}${currency}`;
}

function formatTemplate(template, replacements = {}) {
    if (typeof template !== 'string' || !template.length) return '';

    const getValue = (key) => {
        if (Object.prototype.hasOwnProperty.call(replacements, key)) {
            const value = replacements[key];
            return value === undefined || value === null ? '' : String(value);
        }
        return `{${key}}`;
    };

    let output = template.replace(/\$\{(\w+)\}/g, (_, key) => getValue(key));
    output = output.replace(/\{(\w+)\}/g, (_, key) => getValue(key));
    return output;
}

module.exports = {
    parseColor,
    pickRandom,
    randomInt,
    randomFloat,
    formatCurrency,
    formatTemplate
};
