const { PermissionsBitField } = require('discord.js');
function permissionMissing(permissions, required) {
    if (!required) return false;
    const bits = new PermissionsBitField(required);
    return !permissions || !new PermissionsBitField(permissions).has(bits);
}

module.exports = { permissionMissing };
