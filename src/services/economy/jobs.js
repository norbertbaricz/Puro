const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../../paths');

// Edit individual job definitions in config/jobs/; restart after changing job data.
const JOB_DIRECTORY = path.join(ROOT, 'config', 'jobs');
const preferredOrder = JSON.parse(fs.readFileSync(path.join(JOB_DIRECTORY, 'index.json'), 'utf8'));
const rank = (name) =>
    preferredOrder.includes(name.slice(0, -5)) ? preferredOrder.indexOf(name.slice(0, -5)) : Number.MAX_SAFE_INTEGER;
const jobs = fs
    .readdirSync(JOB_DIRECTORY)
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((file) => JSON.parse(fs.readFileSync(path.join(JOB_DIRECTORY, file), 'utf8')));
const jobsById = new Map(jobs.map((job) => [job.id, job]));
function getAllJobs() {
    return jobs;
}
function getJobById(id) {
    return jobsById.get(id) || null;
}
function formatPayRange(job) {
    const { min, max } = job.work.payRange;
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
}
module.exports = { jobs, getAllJobs, getJobById, formatPayRange };
