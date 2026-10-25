const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const CACHE_MS = 60_000;
const PROBE_TIMEOUT_MS = 1500;
const exec = promisify(execFile);
let cached;
let expires = 0;

async function probe(command, args = []) {
    try {
        return (await exec(command, args, { timeout: PROBE_TIMEOUT_MS, maxBuffer: 16 * 1024, windowsHide: true }))
            .stdout;
    } catch {
        return '';
    } // Optional host utilities are often absent on servers.
}

function getSystemHardwareInfo() {
    if (cached && Date.now() < expires) return cached;
    expires = Date.now() + CACHE_MS;
    cached = (async () => {
        if (os.type() !== 'Linux') return { cpuTemperature: 'N/A', batteryPercentage: 'N/A' };
        const [sensors, battery] = await Promise.all([probe('sensors'), probe('acpi', ['-b'])]);
        const temperature = /Core 0:\s*\+?([\d.]+)°C/.exec(sensors)?.[1];
        const percentage = /(\d+)%/.exec(battery)?.[1];
        return {
            cpuTemperature: temperature ? `${temperature}°C` : 'N/A',
            batteryPercentage: percentage ? `${percentage}%` : 'N/A',
        };
    })();
    return cached;
}

module.exports = { getSystemHardwareInfo };
