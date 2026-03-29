const express = require('express');
const router = express.Router();
const { getOrg, ghFetch } = require('../lib/github');

const TOP_REPOS_COUNT = 5;

// Language colors mapping
const LANG_COLORS = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Ruby: '#701516',
    Rust: '#dea584',
    'C++': '#f34b7d',
    C: '#555555',
    'C#': '#178600',
    PHP: '#4F5D95',
    Swift: '#ffac45',
    Kotlin: '#A97BFF',
    Vue: '#41b883',
    CSS: '#563d7c',
    HTML: '#e34c26',
    Shell: '#89e051',
    default: '#8b949e'
};

// GET /api/repos
router.get('/repos', async (req, res) => {
    try {
        const org = getOrg();
        const { data } = await ghFetch(`/orgs/${org}/repos?per_page=20&sort=pushed`);

        const repos = data.map(repo => ({
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            pushed_at: repo.pushed_at,
            html_url: repo.html_url
        }));

        res.json(repos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/contributors
router.get('/contributors', async (req, res) => {
    try {
        const org = getOrg();

        // Fetch up to 100 repositories to capture the entire organization
        const { data: topRepos } = await ghFetch(`/orgs/${org}/repos?per_page=100&sort=pushed`);

        // Fetch contributors for each repo
        const contributorsMap = new Map();

        for (const repo of topRepos) {
            try {
                const { data } = await ghFetch(`/repos/${org}/${repo.name}/contributors?per_page=10`);

                for (const contributor of data) {
                    const existing = contributorsMap.get(contributor.login) || {
                        login: contributor.login,
                        avatar_url: contributor.avatar_url,
                        contributions: 0,
                        repos_count: 0
                    };
                    existing.contributions += contributor.contributions;
                    existing.repos_count += 1;
                    contributorsMap.set(contributor.login, existing);
                }
            } catch (e) {
                console.warn(`Failed to fetch contributors for ${repo.name}`);
            }
        }

        const contributors = Array.from(contributorsMap.values())
            .sort((a, b) => b.contributions - a.contributions)
            .slice(0, 10);

        res.json(contributors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/commits
router.get('/commits', async (req, res) => {
    try {
        const org = getOrg();
        const { data: topRepos } = await ghFetch(`/orgs/${org}/repos?per_page=100&sort=pushed`);

        const weeklyTotals = new Array(52).fill(0);

        for (const repo of topRepos) {
            try {
                const { data } = await ghFetch(`/repos/${org}/${repo.name}/stats/commit_activity`);

                if (Array.isArray(data)) {
                    data.forEach((week, i) => {
                        weeklyTotals[i] += week.total;
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch stats for ${repo.name}`);
            }
        }

        // Return last 12 weeks with timestamps
        const now = Math.floor(Date.now() / 1000);
        const weekSeconds = 7 * 24 * 60 * 60;

        const weeks = weeklyTotals.slice(-12).map((total, index) => ({
            week: now - ((11 - index) * weekSeconds),
            total
        }));

        res.json(weeks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/pulls
router.get('/pulls', async (req, res) => {
    try {
        const org = getOrg();
        const { data: topRepos } = await ghFetch(`/orgs/${org}/repos?per_page=100&sort=pushed`);

        let open = 0, merged = 0, closed = 0, totalHours = 0, prCount = 0;

        for (const repo of topRepos) {
            try {
                const { data } = await ghFetch(`/repos/${org}/${repo.name}/pulls?state=all&per_page=100`);

                for (const pr of data) {
                    if (pr.state === 'open') {
                        open++;
                    } else if (pr.merged_at) {
                        merged++;
                        // Calculate hours open
                        const created = new Date(pr.created_at);
                        const merged = new Date(pr.merged_at);
                        totalHours += (merged - created) / (1000 * 60 * 60);
                        prCount++;
                    } else {
                        closed++;
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch PRs for ${repo.name}`);
            }
        }

        res.json({
            open,
            merged,
            closed,
            avg_hours: prCount > 0 ? Math.round(totalHours / prCount * 10) / 10 : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/languages
router.get('/languages', async (req, res) => {
    try {
        const org = getOrg();
        const { data: topRepos } = await ghFetch(`/orgs/${org}/repos?per_page=100&sort=pushed`);

        const langBytes = {};

        for (const repo of topRepos) {
            try {
                const { data } = await ghFetch(`/repos/${org}/${repo.name}/languages`);

                for (const [lang, bytes] of Object.entries(data)) {
                    langBytes[lang] = (langBytes[lang] || 0) + bytes;
                }
            } catch (e) {
                console.warn(`Failed to fetch languages for ${repo.name}`);
            }
        }

        const total = Object.values(langBytes).reduce((sum, b) => sum + b, 0);
        const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);

        const top6 = sorted.slice(0, 6).map(([name, bytes]) => ({
            name,
            bytes,
            percent: Math.round((bytes / total) * 1000) / 10,
            color: LANG_COLORS[name] || LANG_COLORS.default
        }));

        const otherBytes = sorted.slice(6).reduce((sum, [, b]) => sum + b, 0);
        if (otherBytes > 0) {
            top6.push({
                name: 'Other',
                bytes: otherBytes,
                percent: Math.round((otherBytes / total) * 1000) / 10,
                color: LANG_COLORS.default
            });
        }

        res.json(top6);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/members
router.get('/members', async (req, res) => {
    try {
        const org = getOrg();
        const { totalCount } = await ghFetch(`/orgs/${org}/members?per_page=1`);

        res.json({ count: totalCount || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/health
router.get('/health', async (req, res) => {
    try {
        const org = getOrg();

        // Aggregate health metrics
        // In a real app, these would come from actual API data
        const health = {
            ci_pass_rate: 94,
            open_issues: Math.floor(Math.random() * 50) + 10,
            stale_prs: Math.floor(Math.random() * 10),
            review_rate: 91
        };

        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;