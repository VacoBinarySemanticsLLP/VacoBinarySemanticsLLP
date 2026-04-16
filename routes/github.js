const express = require('express');
const router = express.Router();
const { getOrg, ghFetch } = require('../lib/github');

const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
    Go: '#00ADD8', Ruby: '#701516', Rust: '#dea584', 'C++': '#f34b7d', C: '#555555',
    'C#': '#178600', PHP: '#4F5D95', Swift: '#ffac45', Kotlin: '#A97BFF',
    Vue: '#41b883', CSS: '#563d7c', HTML: '#e34c26', Shell: '#89e051', default: '#8b949e'
};

// ─── Shared repo cache (5 min TTL) ───
let repoCache = null;
let repoCacheTime = 0;
const REPO_CACHE_TTL = 5 * 60 * 1000;

async function getCachedRepos() {
    const now = Date.now();
    if (repoCache && (now - repoCacheTime < REPO_CACHE_TTL)) return repoCache;
    const { data } = await ghFetch(`/orgs/${getOrg()}/repos?per_page=100&sort=pushed`);
    repoCache = data;
    repoCacheTime = now;
    return data;
}

// ─── Per-repo stats cache (5 min TTL) ───
const statsCache = new Map();

function getStatsCache(repo, path) {
    const e = statsCache.get(`${repo.name}::${path}`);
    if (e && (Date.now() - e.time < 5 * 60 * 1000)) return e.data;
    return null;
}
function setStatsCache(repo, path, data) {
    statsCache.set(`${repo.name}::${path}`, { data, time: Date.now() });
}

// ─── Batch parallel fetcher ───
async function batchFetch(repos, pathFn, gatherer, batchSize = 10) {
    for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async repo => {
                const cached = getStatsCache(repo, pathFn(repo));
                if (cached !== null) return cached; // null means not yet cached
                try {
                    const { data } = await ghFetch(`/repos/${getOrg()}/${repo.name}${pathFn(repo)}`);
                    setStatsCache(repo, pathFn(repo), data);
                    return data;
                } catch (err) {
                    return null; // 202 exhausted or network error — skip this repo
                }
            })
        );
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) gatherer(r.value);
        }
    }
}

// GET /api/repos
router.get('/repos', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        res.json(repos.slice(0, 20).map(r => ({
            name: r.name, full_name: r.full_name, description: r.description,
            language: r.language, stargazers_count: r.stargazers_count,
            forks_count: r.forks_count, pushed_at: r.pushed_at, html_url: r.html_url
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contributors
router.get('/contributors', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        const map = new Map();
        await batchFetch(repos, () => '/contributors?per_page=10', data => {
            if (!Array.isArray(data)) return;
            for (const c of data) {
                const e = map.get(c.login) || { login: c.login, avatar_url: c.avatar_url, contributions: 0, repos_count: 0 };
                e.contributions += c.contributions; e.repos_count += 1; map.set(c.login, e);
            }
        });
        res.json(Array.from(map.values()).sort((a, b) => b.contributions - a.contributions).slice(0, 10));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/commits
router.get('/commits', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        // Calculate date 12 weeks ago
        const since = new Date();
        since.setDate(since.getDate() - (12 * 7));
        const sinceISO = since.toISOString();

        const weeklyTotals = new Array(12).fill(0);

        await batchFetch(repos, repo => `/commits?since=${sinceISO}&per_page=100`, data => {
            if (!Array.isArray(data)) return;
            for (const commit of data) {
                // commit.author.date is ISO 8601: "2026-04-10T14:30:00Z"
                // Get Monday of that week using ISO week date
                const date = new Date(commit.commit.author.date);
                const day = date.getUTCDay(); // 0=Sun, 1=Mon, ...
                const diff = (day === 0 ? -6 : 1 - day); // days to Monday
                const monday = new Date(date);
                monday.setUTCDate(date.getUTCDate() + diff);
                monday.setUTCHours(0, 0, 0, 0);

                // Find index relative to 12 weeks ago (0 = oldest week)
                const now = new Date();
                const weekMs = 7 * 24 * 60 * 60 * 1000;
                const weeksAgo = Math.floor((now - monday) / weekMs);
                const idx = 11 - weeksAgo; // invert so [0] = oldest week

                if (idx >= 0 && idx < 12) {
                    weeklyTotals[idx]++;
                }
            }
        });

        const now = Math.floor(Date.now() / 1000);
        const ws = 7 * 24 * 60 * 60;
        res.json(weeklyTotals.map((total, i) => ({
            week: now - ((11 - i) * ws),
            total
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/pulls
router.get('/pulls', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        let open = 0, merged = 0, closed = 0, totalH = 0, prCount = 0;
        await batchFetch(repos, () => '/pulls?state=all&per_page=100', data => {
            if (!Array.isArray(data)) return;
            for (const pr of data) {
                if (pr.state === 'open') open++;
                else if (pr.merged_at) { merged++; totalH += (new Date(pr.merged_at) - new Date(pr.created_at)) / 36e5; prCount++; }
                else closed++;
            }
        });
        res.json({ open, merged, closed, avg_hours: prCount > 0 ? Math.round(totalH / prCount * 10) / 10 : 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/languages
router.get('/languages', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        const bytes = {};
        await batchFetch(repos, () => '/languages', data => {
            if (!data || typeof data !== 'object') return;
            for (const [l, b] of Object.entries(data)) bytes[l] = (bytes[l] || 0) + b;
        });
        const total = Object.values(bytes).reduce((s, b) => s + b, 0);
        const sorted = Object.entries(bytes).sort((a, b) => b[1] - a[1]);
        const top6 = sorted.slice(0, 6).map(([n, b]) => ({
            name: n, bytes: b, percent: Math.round(b / total * 1000) / 10,
            color: LANG_COLORS[n] || LANG_COLORS.default
        }));
        const other = sorted.slice(6).reduce((s, [, b]) => s + b, 0);
        if (other > 0) top6.push({ name: 'Other', bytes: other, percent: Math.round(other / total * 1000) / 10, color: LANG_COLORS.default });
        res.json(top6);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/members
router.get('/members', async (req, res) => {
    try {
        const org = getOrg();
        const r = await ghFetch(`/orgs/${org}/members?per_page=1`);
        res.json({ count: r.totalCount || r.data.length || 0, org_name: org });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/health
router.get('/health', async (req, res) => {
    res.json({ ci_pass_rate: 94, open_issues: 23, stale_prs: 3, review_rate: 91 });
});

// GET /api/issues
router.get('/issues', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        let open = 0, closed = 0, totalResolutionDays = 0, resolvedCount = 0;
        let staleCount = 0;
        const labelMap = new Map();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        await batchFetch(repos, () => '/issues?state=all&per_page=100', data => {
            if (!Array.isArray(data)) return;
            for (const issue of data) {
                if (issue.pull_request) continue; // Skip PRs
                if (issue.state === 'open') {
                    open++;
                    // Check if stale (no activity > 30 days)
                    const updatedAt = new Date(issue.updated_at);
                    if (updatedAt < thirtyDaysAgo) staleCount++;
                } else {
                    closed++;
                    // Calculate resolution time
                    const createdAt = new Date(issue.created_at);
                    const closedAt = new Date(issue.closed_at);
                    const days = (closedAt - createdAt) / (1000 * 60 * 60 * 24);
                    if (days > 0) {
                        totalResolutionDays += days;
                        resolvedCount++;
                    }
                }
                // Count labels
                if (issue.labels) {
                    for (const label of issue.labels) {
                        labelMap.set(label.name, (labelMap.get(label.name) || 0) + 1);
                    }
                }
            }
        });

        // Sort labels by count, take top 5
        const byLabel = Array.from(labelMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        res.json({
            open,
            closed,
            avg_resolution_days: resolvedCount > 0 ? Math.round((totalResolutionDays / resolvedCount) * 10) / 10 : 0,
            stale_count: staleCount,
            by_label: byLabel
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/releases
router.get('/releases', async (req, res) => {
    try {
        const repos = await getCachedRepos();
        let totalReleases = 0, last30Days = 0;
        const recent = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        await batchFetch(repos, () => '/releases?per_page=5', data => {
            if (!Array.isArray(data)) return;
            totalReleases += data.length;
            for (const release of data) {
                const publishedAt = new Date(release.published_at);
                if (publishedAt > thirtyDaysAgo) last30Days++;
                recent.push({
                    name: release.name || release.tag_name,
                    tag_name: release.tag_name,
                    published_at: release.published_at,
                    repo: release.html_url?.split('/')[5] || 'unknown',
                    html_url: release.html_url
                });
            }
        });

        // Sort by published date descending, take top 5
        recent.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

        res.json({
            total_releases: totalReleases,
            last_30_days: last30Days,
            avg_releases_per_month: Math.round((totalReleases / Math.max(repos.length, 1)) * 10) / 10,
            recent: recent.slice(0, 5)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;