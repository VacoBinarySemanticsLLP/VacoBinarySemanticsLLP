// =================================================================
// GITHUB ORG STATS DASHBOARD
// =================================================================

// === CONFIG (secure - token entered at runtime) ===
// Token is NOT stored in code - user enters it when first loading the page
// Credentials are saved in browser localStorage for convenience

function getConfig() {
    let org = localStorage.getItem('github_org');
    let token = localStorage.getItem('github_token');
    
    // If not set, prompt user
    if (!org || !token) {
        org = prompt('Enter GitHub Organization name (e.g., facebook, google):');
        token = prompt('Enter your GitHub Personal Access Token:');
        
        if (org && token) {
            localStorage.setItem('github_org', org);
            localStorage.setItem('github_token', token);
        }
    }
    
    return { org, token };
}

// Get config at runtime
const config = getConfig();
const ORG = config.org;
const TOKEN = config.token;

// Exit if no credentials provided
if (!ORG || !TOKEN) {
    document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #e6edf3; background: #0d1117; min-height: 100vh;">
            <h1>GitHub Dashboard</h1>
            <p style="color: #8b949e; margin: 20px 0;">Credentials required to access GitHub API.</p>
            <button onclick="location.reload()" style="padding: 10px 20px; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                Enter Credentials
            </button>
            <br><br>
            <button onclick="localStorage.clear(); location.reload();" style="padding: 10px 20px; background: #30363d; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; font-size: 14px;">
                Clear Saved Credentials
            </button>
        </div>
    `;
    throw new Error('No credentials provided');
}

// === CONSTANTS ===
const API_BASE = 'https://api.github.com';
const WEEKS_TO_SHOW = 12;
const HEATMAP_WEEKS = 26;
const TOP_REPOS_COUNT = 5;
const TOP_CONTRIBUTORS_COUNT = 7;

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
    Dart: '#00B4AB',
    default: '#8b949e'
};

// =================================================================
// API HELPERS
// =================================================================

async function ghFetch(path) {
    const url = `${API_BASE}${path}`;
    const headers = {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    // Parse Link header for pagination info
    const linkHeader = response.headers.get('Link');
    let totalCount = null;

    if (linkHeader && path.includes('members')) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) {
            totalCount = parseInt(match[1], 10);
        }
    }

    const data = await response.json();
    return { data, totalCount, headers: response.headers };
}

// =================================================================
// DATA FETCHERS
// =================================================================

async function fetchRepos() {
    const { data } = await ghFetch(`/orgs/${ORG}/repos?per_page=20&sort=pushed`);
    return data;
}

async function fetchMembers() {
    const { totalCount } = await ghFetch(`/orgs/${ORG}/members?per_page=1`);
    return totalCount || 0;
}

async function fetchContributors(repos) {
    const contributorsMap = new Map();

    for (const repo of repos.slice(0, TOP_REPOS_COUNT)) {
        try {
            const { data } = await ghFetch(`/repos/${ORG}/${repo.name}/contributors?per_page=10`);

            for (const contributor of data) {
                const existing = contributorsMap.get(contributor.login) || {
                    login: contributor.login,
                    avatar: contributor.avatar_url,
                    contributions: 0,
                    repos: []
                };
                existing.contributions += contributor.contributions;
                existing.repos.push(repo.name);
                contributorsMap.set(contributor.login, existing);
            }
        } catch (e) {
            console.warn(`Failed to fetch contributors for ${repo.name}:`, e);
        }
    }

    return Array.from(contributorsMap.values());
}

async function fetchWeeklyStats(repos) {
    const weeklyTotals = new Array(52).fill(0);

    for (const repo of repos.slice(0, TOP_REPOS_COUNT)) {
        try {
            const { data } = await ghFetch(`/repos/${ORG}/${repo.name}/stats/commit_activity`);

            if (Array.isArray(data)) {
                data.forEach((week, i) => {
                    weeklyTotals[i] += week.total;
                });
            }
        } catch (e) {
            console.warn(`Failed to fetch weekly stats for ${repo.name}:`, e);
        }
    }

    // Return last 12 weeks
    return weeklyTotals.slice(-WEEKS_TO_SHOW);
}

async function fetchOpenPRs(repos) {
    let totalOpen = 0;

    for (const repo of repos.slice(0, TOP_REPOS_COUNT)) {
        try {
            const { data } = await ghFetch(`/repos/${ORG}/${repo.name}/pulls?state=open&per_page=1`);
            totalOpen += data.length;
        } catch (e) {
            console.warn(`Failed to fetch PRs for ${repo.name}:`, e);
        }
    }

    return totalOpen;
}

async function fetchLanguages(repos) {
    const langBytes = {};

    for (const repo of repos.slice(0, TOP_REPOS_COUNT)) {
        try {
            const { data } = await ghFetch(`/repos/${ORG}/${repo.name}/languages`);

            for (const [lang, bytes] of Object.entries(data)) {
                langBytes[lang] = (langBytes[lang] || 0) + bytes;
            }
        } catch (e) {
            console.warn(`Failed to fetch languages for ${repo.name}:`, e);
        }
    }

    return langBytes;
}

async function fetchCommitsForHeatmap(repos) {
    const commitCounts = {};

    for (const repo of repos.slice(0, TOP_REPOS_COUNT)) {
        try {
            const { data } = await ghFetch(`/repos/${ORG}/${repo.name}/commits?per_page=100`);

            for (const commit of data) {
                if (commit.commit && commit.commit.author && commit.commit.author.date) {
                    const date = commit.commit.author.date.split('T')[0];
                    commitCounts[date] = (commitCounts[date] || 0) + 1;
                }
            }
        } catch (e) {
            console.warn(`Failed to fetch commits for ${repo.name}:`, e);
        }
    }

    return commitCounts;
}

// =================================================================
// AGGREGATORS
// =================================================================

function aggregateContributors(rawData) {
    return rawData
        .sort((a, b) => b.contributions - a.contributions)
        .slice(0, TOP_CONTRIBUTORS_COUNT);
}

function aggregateLanguages(langBytes) {
    const total = Object.values(langBytes).reduce((sum, bytes) => sum + bytes, 0);
    const sorted = Object.entries(langBytes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const languages = sorted.map(([name, bytes]) => ({
        name,
        percent: ((bytes / total) * 100).toFixed(1),
        color: LANG_COLORS[name] || LANG_COLORS.default
    }));

    // Add "Other" if more than 6 languages
    const otherPercent = Object.entries(langBytes)
        .slice(6)
        .reduce((sum, [, bytes]) => sum + bytes, 0);

    if (otherPercent > 0) {
        languages.push({
            name: 'Other',
            percent: ((otherPercent / total) * 100).toFixed(1),
            color: LANG_COLORS.default
        });
    }

    return languages;
}

function calcMergeTime(repos) {
    // Simulated merge time (in real app, would calculate from PR data)
    return (Math.random() * 10 + 4).toFixed(1);
}

function sumCommits(contributors) {
    return contributors.reduce((sum, c) => sum + c.contributions, 0);
}

// =================================================================
// RENDERERS
// =================================================================

function renderOrgInfo(repos, members) {
    // Use first repo's owner as org info
    const firstRepo = repos[0];
    if (firstRepo && firstRepo.owner) {
        document.getElementById('org-avatar').src = firstRepo.owner.avatar_url;
        document.getElementById('org-name').textContent = firstRepo.owner.login;
        document.getElementById('org-handle').textContent = `@${firstRepo.owner.login}`;
    }

    // Badges
    document.getElementById('badge-members').textContent = members.toLocaleString();
    document.getElementById('badge-repos').textContent = repos.length.toLocaleString();
    document.getElementById('badge-active').textContent = Math.floor(members * 0.3).toLocaleString();
}

function renderMetrics({ commits, devs, prs, mergeTime }) {
    animateCount(document.getElementById('commits-value'), commits);
    animateCount(document.getElementById('devs-value'), devs);
    animateCount(document.getElementById('prs-value'), prs);
    document.getElementById('time-value').textContent = mergeTime;
}

function renderWeekChart(weeks) {
    const container = document.getElementById('week-chart');
    container.innerHTML = '';

    const maxValue = Math.max(...weeks, 1);

    weeks.forEach((total, index) => {
        const bar = document.createElement('div');
        bar.className = 'week-bar';
        const height = (total / maxValue) * 100;
        bar.style.height = `${height}%`;

        // Tooltip handlers
        bar.addEventListener('mouseenter', (e) => {
            showTooltip(e, `Week ${index + 1}: ${total.toLocaleString()} commits`);
        });
        bar.addEventListener('mousemove', (e) => {
            updateTooltipPosition(e);
        });
        bar.addEventListener('mouseleave', hideTooltip);

        container.appendChild(bar);
    });
}

function renderContributors(list) {
    const container = document.getElementById('contributors-list');
    container.innerHTML = '';

    const maxCommits = list[0]?.contributions || 1;

    list.forEach((contributor, index) => {
        const row = document.createElement('div');
        row.className = 'contributor-row';

        const barWidth = (contributor.contributions / maxCommits) * 100;

        row.innerHTML = `
            <span class="contributor-rank">#${index + 1}</span>
            <img class="contributor-avatar" src="${contributor.avatar}" alt="${contributor.login}">
            <div class="contributor-info">
                <div class="contributor-name">${contributor.login}</div>
                <div class="contributor-stats">${contributor.contributions.toLocaleString()} commits</div>
            </div>
            <div class="commit-bar-container">
                <div class="commit-bar" style="width: ${barWidth}%;"></div>
            </div>
        `;

        row.addEventListener('mouseenter', (e) => {
            showTooltip(e, `${contributor.login}: ${contributor.contributions.toLocaleString()} commits across ${contributor.repos.length} repos`);
        });
        row.addEventListener('mousemove', updateTooltipPosition);
        row.addEventListener('mouseleave', hideTooltip);

        container.appendChild(row);
    });
}

function renderRepos(list) {
    const container = document.getElementById('repo-list');
    container.innerHTML = '';

    list.forEach(repo => {
        const item = document.createElement('div');
        item.className = 'repo-item';

        const langColor = LANG_COLORS[repo.language] || LANG_COLORS.default;

        item.innerHTML = `
            <div class="lang-dot" style="background: ${langColor};"></div>
            <div class="repo-info">
                <div class="repo-name">${repo.name}</div>
                <div class="repo-stats">
                    <span class="repo-stat">⭐ ${repo.stargazers_count.toLocaleString()}</span>
                    <span class="repo-stat">🍴 ${repo.forks_count.toLocaleString()}</span>
                    <span class="repo-stat">📝 ${repo.language || 'N/A'}</span>
                </div>
            </div>
        `;

        item.addEventListener('click', () => {
            window.open(repo.html_url, '_blank');
        });

        item.addEventListener('mouseenter', (e) => {
            showTooltip(e, `${repo.full_name}\n${repo.description || 'No description'}\nLast pushed: ${new Date(repo.pushed_at).toLocaleDateString()}`);
        });
        item.addEventListener('mousemove', updateTooltipPosition);
        item.addEventListener('mouseleave', hideTooltip);

        container.appendChild(item);
    });
}

function renderHeatmap(commitCounts = null) {
    const container = document.getElementById('heatmap');
    container.innerHTML = '';

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (HEATMAP_WEEKS * 7) + (6 - today.getDay()));

    for (let day = 0; day < 7; day++) {
        for (let week = 0; week < HEATMAP_WEEKS; week++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(cellDate.getDate() + (week * 7) + day);
            const dateStr = cellDate.toISOString().split('T')[0];

            const cell = document.createElement('div');
            let intensity = 0;

            if (commitCounts && commitCounts[dateStr]) {
                const count = commitCounts[dateStr];
                if (count >= 20) intensity = 4;
                else if (count >= 10) intensity = 3;
                else if (count >= 4) intensity = 2;
                else if (count >= 1) intensity = 1;
            } else {
                // Random for demo
                intensity = Math.floor(Math.random() * 5);
            }

            cell.className = `heatmap-cell hm-${intensity}`;
            cell.dataset.date = dateStr;
            cell.dataset.count = commitCounts?.[dateStr] || 0;

            cell.addEventListener('mouseenter', (e) => {
                const count = commitCounts?.[dateStr] || Math.floor(Math.random() * 15);
                showTooltip(e, `${dateStr}\n${count} contribution${count !== 1 ? 's' : ''}`);
            });
            cell.addEventListener('mousemove', updateTooltipPosition);
            cell.addEventListener('mouseleave', hideTooltip);

            container.appendChild(cell);
        }
    }
}

function renderLanguages(langs) {
    const barContainer = document.getElementById('lang-bar');
    const legendContainer = document.getElementById('lang-legend');

    barContainer.innerHTML = '';
    legendContainer.innerHTML = '';

    langs.forEach(lang => {
        // Bar segment
        const segment = document.createElement('div');
        segment.className = 'lang-segment';
        segment.style.flex = lang.percent;
        segment.style.background = lang.color;

        segment.addEventListener('mouseenter', (e) => {
            showTooltip(e, `${lang.name}: ${lang.percent}%`);
        });
        segment.addEventListener('mousemove', updateTooltipPosition);
        segment.addEventListener('mouseleave', hideTooltip);

        barContainer.appendChild(segment);

        // Legend item
        const legendItem = document.createElement('div');
        legendItem.className = 'lang-legend-item';
        legendItem.innerHTML = `
            <div class="lang-legend-dot" style="background: ${lang.color};"></div>
            <span>${lang.name}</span>
            <span class="lang-legend-percent">${lang.percent}%</span>
        `;
        legendContainer.appendChild(legendItem);
    });
}

function renderFeed(items, filter = 'all') {
    const container = document.getElementById('activity-feed');
    container.innerHTML = '';

    const filtered = filter === 'all' ? items : items.filter(item => item.type === filter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="activity-empty">No activity to display</div>';
        return;
    }

    filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = `activity-item ${item.type}`;

        const icons = {
            commit: '📊',
            pr: '🔀',
            issue: '🐛',
            release: '🚀'
        };

        el.innerHTML = `
            <span class="activity-icon">${icons[item.type] || '📝'}</span>
            <div class="activity-content">
                <div class="activity-title">${item.title}</div>
                <div class="activity-repo">${item.repo}</div>
            </div>
            <span class="activity-time">${item.time}</span>
        `;

        container.appendChild(el);
    });
}

function renderPRStats(data) {
    document.getElementById('pr-total').textContent = (data.merged + data.open + data.closed).toLocaleString();
    document.getElementById('pr-avg-time').textContent = `${calcMergeTime()}h`;
    document.getElementById('pr-comments').textContent = Math.floor(Math.random() * 5 + 2);

    // Update status bar
    const total = data.merged + data.open + data.closed;
    const mergedBar = document.querySelector('.pr-merged');
    const openBar = document.querySelector('.pr-open');
    const closedBar = document.querySelector('.pr-closed');

    if (mergedBar && openBar && closedBar) {
        mergedBar.style.width = `${(data.merged / total) * 100}%`;
        mergedBar.querySelector('span').textContent = `Merged ${Math.round((data.merged / total) * 100)}%`;

        openBar.style.width = `${(data.open / total) * 100}%`;
        openBar.querySelector('span').textContent = `Open ${Math.round((data.open / total) * 100)}%`;

        closedBar.style.width = `${(data.closed / total) * 100}%`;
        closedBar.querySelector('span').textContent = `Closed ${Math.round((data.closed / total) * 100)}%`;
    }
}

function renderHealth(data) {
    const updateBar = (id, value) => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.style.width = `${value}%`;
            bar.parentElement.nextElementSibling.textContent = `${value}%`;

            // Update color based on value
            bar.className = 'health-bar';
            if (value >= 80) bar.classList.add('health-bar-good');
            else if (value >= 60) bar.classList.add('health-bar-warning');
            else bar.classList.add('health-bar-danger');
        }
    };

    updateBar('health-coverage', data.coverage);
    updateBar('health-ci', data.ci);
    updateBar('health-review', data.review);
    updateBar('health-docs', data.docs);
}

// =================================================================
// UI HELPERS
// =================================================================

function showTooltip(event, text) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    updateTooltipPosition(event);
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('tooltip');
    const padding = 12;
    let x = event.clientX + padding;
    let y = event.clientY + padding;

    // Keep tooltip in viewport
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
        x = event.clientX - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight) {
        y = event.clientY - rect.height - padding;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('visible');
}

function animateCount(element, target, duration = 1000) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * easeProgress);

        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });
}

function filterFeed(type, element) {
    // Update chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.toggle('active', chip === element);
    });

    // Re-render feed with filter
    if (window.lastFeedItems) {
        renderFeed(window.lastFeedItems, type);
    }
}

function showSkeleton() {
    document.getElementById('skeleton').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('error-banner').classList.add('hidden');
}

function hideSkeleton() {
    document.getElementById('skeleton').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
}

function showError(message) {
    document.getElementById('skeleton').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('error-banner').classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
}

function clearError() {
    document.getElementById('error-banner').classList.add('hidden');
}

// =================================================================
// MOCK DATA (for demo purposes)
// =================================================================

function generateMockFeed() {
    const types = ['commit', 'pr', 'issue', 'release'];
    const repos = ['frontend-app', 'api-service', 'mobile-client', 'docs', 'shared-utils'];
    const times = ['2 hours ago', '5 hours ago', 'Yesterday', '2 days ago', '3 days ago'];

    const feedItems = [];

    for (let i = 0; i < 15; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const repo = repos[Math.floor(Math.random() * repos.length)];
        const time = times[Math.floor(Math.random() * times.length)];

        let title;
        switch (type) {
            case 'commit':
                title = `Fix: Updated ${['login flow', 'API timeout', 'CSS grid', 'error handling'][Math.floor(Math.random() * 4)]}`;
                break;
            case 'pr':
                title = `${['Feature', 'Bugfix', 'Refactor', 'Update'][Math.floor(Math.random() * 4)]}: ${['Add dark mode', 'Fix memory leak', 'Update dependencies', 'Improve performance'][Math.floor(Math.random() * 4)]}`;
                break;
            case 'issue':
                title = `${['Bug:', 'Question:', 'Feature request:'][Math.floor(Math.random() * 3)]} ${['App crashes on iOS', 'How to configure proxy?', 'Add export to PDF'][Math.floor(Math.random() * 3)]}`;
                break;
            case 'release':
                title = `Release v${Math.floor(Math.random() * 3 + 1)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
                break;
        }

        feedItems.push({ type, title, repo, time });
    }

    return feedItems;
}

// =================================================================
// INIT
// =================================================================

async function init() {
    showSkeleton();
    clearError();

    try {
        // Fetch repos and members in parallel
        const [repos, members] = await Promise.all([
            fetchRepos(),
            fetchMembers()
        ]);

        if (!repos || repos.length === 0) {
            throw new Error('No repositories found. Check your ORG name.');
        }

        const top5 = repos.slice(0, TOP_REPOS_COUNT);

        // Fetch detailed data in parallel
        const [contributors, weeks, prs, langs, commitCounts] = await Promise.all([
            fetchContributors(top5),
            fetchWeeklyStats(top5),
            fetchOpenPRs(top5),
            fetchLanguages(top5),
            fetchCommitsForHeatmap(top5)
        ]);

        hideSkeleton();

        // Render all sections
        renderOrgInfo(repos, members);
        renderMetrics({
            commits: sumCommits(contributors),
            devs: members,
            prs: prs,
            mergeTime: calcMergeTime(repos)
        });
        renderWeekChart(weeks);
        renderContributors(aggregateContributors(contributors));
        renderRepos(repos.slice(0, TOP_REPOS_COUNT));
        renderHeatmap(commitCounts);
        renderLanguages(aggregateLanguages(langs));

        // Mock data for demo
        window.lastFeedItems = generateMockFeed();
        renderFeed(window.lastFeedItems, 'all');
        renderPRStats({ merged: 62, open: 23, closed: 15 });
        renderHealth({ coverage: 78, ci: 94, review: 91, docs: 62 });

    } catch (err) {
        console.error('Dashboard error:', err);
        hideSkeleton();
        showError(err.message || 'Failed to load dashboard data');
    }
}

// =================================================================
// EVENT LISTENERS
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // Feed filtering
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterFeed(chip.dataset.filter, e.target);
        });
    });

    // Retry button
    document.getElementById('retry-btn').addEventListener('click', init);

    // Clear credentials button
    const clearBtn = document.getElementById('clear-credentials');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('github_org');
            localStorage.removeItem('github_token');
            location.reload();
        });
    }

    // Initialize dashboard
    init();
});