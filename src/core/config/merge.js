function merge(defaults, supplied) {
    const result = { ...defaults };
    for (const [key, value] of Object.entries(supplied || {})) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
        result[key] =
            value && typeof value === 'object' && !Array.isArray(value) ? merge(defaults?.[key] || {}, value) : value;
    }
    return result;
}

module.exports = { merge };
