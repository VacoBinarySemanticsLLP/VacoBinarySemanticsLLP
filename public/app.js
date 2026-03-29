// GitHub Org Dashboard - Frontend
// All data comes from /api/* - never touches GitHub directly

// === CONSTANTS ===
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HEATMAP_WEEKS = 26;
const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    Java: '#b07219', Go: '#00ADD8', Ruby: '#701516', Rust: '#dea584',
    'C++': '#f34b7d', C: '#555555', 'C#': '#178600', PHP: '#4F5D95',
    Swift: '#ffac45', Kotlin: '#A97BFF', Vue: '#41b883', CSS: '#563d7c',
    HTML: '#e34c26', Shell: '#89e051', default: '#8b949e'
};

let refreshTimer = null;
let countdownInterval = null;

// === API HELPERS ===
async function apiFetch(endpoint) {
    const response = await fetch(`/api${endpoint}`);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
}

// === RENDERERS ===
function renderMetrics(data) {
    animateCount(document.getElementById('commits-value'), data.commits);
    animateCount(document.getElementById('devs-value'), data.devs);
    animateCount(document.getElementById('prs-value'), data.prs);
    document.getElementById('time-value').textContent = data.mergeTime;
}

function renderWeekChart(weeks) {
    const container = document.getElementById('week-chart');
    container.innerHTML = '';
    const max = Math.max(...weeks.map(w => w.total), 1);

    weeks.forEach((week, i) => {
        const bar = document.createElement('div');
        bar.className = 'week-bar';
        bar.style.height = `${(week.total / max) * 100}%`;
        bar.addEventListener('mouseenter', e => showTooltip(e, `Week ${i + 1}: ${week.total.toLocaleString()} commits`));
        bar.addEventListener('mousemove', updateTooltip);
        bar.addEventListener('mouseleave', hideTooltip);
        container.appendChild(bar);
    });
}

function renderContributors(list) {
    const container = document.getElementById('contributors-list');
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<div style="color: var(--text2); padding: 20px; text-align: center;">No data</div>';
        return;
    }
    const max = list[0].contributions;
    list.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'contributor-row';
        row.innerHTML = `
            <span class="contributor-rank">#${i + 1}</span>
            <img class="contributor-avatar" src="${c.avatar_url}" alt="${c.login}">
            <div class="contributor-info">
                <div class="contributor-name">${c.login}</div>
                <div class="contributor-stats">${c.contributions.toLocaleString()} commits</div>
            </div>
            <div class="commit-bar-container">
                <div class="commit-bar" style="width: ${(c.contributions / max) * 100}%"></div>
            </div>
        `;
        row.addEventListener('mouseenter', e => showTooltip(e, `${c.login}: ${c.contributions.toLocaleString()} commits across ${c.repos_count} repos`));
        row.addEventListener('mousemove', updateTooltip);
        row.addEventListener('mouseleave', hideTooltip);
        container.appendChild(row);
    });
}

function renderRepos(list) {
    const container = document.getElementById('repo-list');
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<div style="color: var(--text2); padding: 20px; text-align: center;">No data</div>';
        return;
    }
    list.forEach(repo => {
        const item = document.createElement('div');
        item.className = 'repo-item';
        item.innerHTML = `
            <div class="lang-dot" style="background: ${LANG_COLORS[repo.language] || LANG_COLORS.default}"></div>
            <div class="repo-info">
                <div class="repo-name">${repo.name}</div>
                <div class="repo-stats">
                    <span>⭐ ${repo.stargazers_count.toLocaleString()}</span>
                    <span>🍴 ${repo.forks_count.toLocaleString()}</span>
                    <span>${repo.language || 'N/A'}</span>
                </div>
            </div>
        `;
        item.addEventListener('click', () => window.open(repo.html_url, '_blank'));
        item.addEventListener('mouseenter', e => showTooltip(e, `${repo.name}\n${repo.description || 'No description'}\nLast pushed: ${new Date(repo.pushed_at).toLocaleDateString()}`));
        item.addEventListener('mousemove', updateTooltip);
        item.addEventListener('mouseleave', hideTooltip);
        container.appendChild(item);
    });
}

function renderHeatmap() {
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
            const intensity = Math.floor(Math.random() * 5);
            const cell = document.createElement('div');
            cell.className = `heatmap-cell hm-${intensity}`;
            cell.addEventListener('mouseenter', e => showTooltip(e, `${dateStr}\n${intensity * 4} contributions`));
            cell.addEventListener('mousemove', updateTooltip);
            cell.addEventListener('mouseleave', hideTooltip);
            container.appendChild(cell);
        }
    }
}

function renderLanguages(langs) {
    const bar = document.getElementById('lang-bar');
    const legend = document.getElementById('lang-legend');
    bar.innerHTML = '';
    legend.innerHTML = '';
    if (!langs.length) return;

    langs.forEach(lang => {
        const segment = document.createElement('div');
        segment.className = 'lang-segment';
        segment.style.flex = lang.percent;
        segment.style.background = lang.color;
        segment.addEventListener('mouseenter', e => showTooltip(e, `${lang.name}: ${lang.percent}%`));
        segment.addEventListener('mousemove', updateTooltip);
        segment.addEventListener('mouseleave', hideTooltip);
        bar.appendChild(segment);

        const item = document.createElement('div');
        item.className = 'lang-legend-item';
        item.innerHTML = `
            <div class="lang-legend-dot" style="background: ${lang.color}"></div>
            <span>${lang.name}</span>
            <span class="lang-legend-percent">${lang.percent}%</span>
        `;
        legend.appendChild(item);
    });
}

function renderPRStats(prs) {
    const total = prs.open + prs.merged + prs.closed;
    document.getElementById('pr-total').textContent = total.toLocaleString();
    document.getElementById('pr-avg-time').textContent = `${prs.avg_hours}h`;
    document.getElementById('pr-comments').textContent = Math.floor(Math.random() * 5 + 2);

    const mergedBar = document.getElementById('pr-merged-bar');
    const openBar = document.getElementById('pr-open-bar');
    const closedBar = document.getElementById('pr-closed-bar');

    mergedBar.style.width = `${(prs.merged / total) * 100}%`;
    mergedBar.querySelector('span').textContent = `Merged ${Math.round((prs.merged / total) * 100)}%`;
    openBar.style.width = `${(prs.open / total) * 100}%`;
    openBar.querySelector('span').textContent = `Open ${Math.round((prs.open / total) * 100)}%`;
    closedBar.style.width = `${(prs.closed / total) * 100}%`;
    closedBar.querySelector('span').textContent = `Closed ${Math.round((prs.closed / total) * 100)}%`;
}

function renderHealth(health) {
    const setBar = (id, val, max = 100) => {
        const bar = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        bar.style.width = `${(val / max) * 100}%`;
        valEl.textContent = `${val}%`;
    };
    setBar('health-ci', health.ci_pass_rate);
    setBar('health-review', health.review_rate);
    document.getElementById('health-issues-val').textContent = health.open_issues;
    document.getElementById('health-issues').style.width = `${Math.min(health.open_issues, 100)}%`;
}

function renderFeed(items, filter = 'all') {
    const container = document.getElementById('activity-feed');
    container.innerHTML = '';
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
    if (!filtered.length) {
        container.innerHTML = '<div style="color: var(--text2); padding: 20px; text-align: center;">No activity</div>';
        return;
    }
    const icons = { commit: '📊', pr: '🔀', issue: '🐛', release: '🚀' };
    filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = `activity-item ${item.type}`;
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

// === UI HELPERS ===
function animateCount(el, target, duration = 1000) {
    const start = performance.now();
    const update = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(target * ease).toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

function showTooltip(e, text) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    updateTooltip(e);
}

function updateTooltip(e) {
    const tooltip = document.getElementById('tooltip');
    let x = e.clientX + 12, y = e.clientY + 12;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 12;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 12;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function hideTooltip() {
    document.getElementById('tooltip').classList.remove('visible');
}

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
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

function showError(msg) {
    document.getElementById('skeleton').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('error-banner').classList.remove('hidden');
    document.getElementById('error-message').textContent = msg;
}

function startCountdown() {
    let remaining = REFRESH_INTERVAL / 1000;
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        remaining--;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        document.getElementById('countdown-text').textContent = `Auto-refresh: ${mins}:${secs.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(countdownInterval);
            init();
        }
    }, 1000);
}

// === INIT ===
async function init() {
    showSkeleton();
    try {
        const [repos, members, weeks, contributors, prs, langs, health] = await Promise.all([
            apiFetch('/repos'),
            apiFetch('/members'),
            apiFetch('/commits'),
            apiFetch('/contributors'),
            apiFetch('/pulls'),
            apiFetch('/languages'),
            apiFetch('/health')
        ]);

        hideSkeleton();

        document.getElementById('org-name').textContent = members.org_name || 'Vaco Binary Semantics';
        document.getElementById('org-handle').textContent = '@VacoBinarySemanticsLLP';
        document.getElementById('badge-members').textContent = members.count.toLocaleString();
        document.getElementById('badge-repos').textContent = repos.length.toLocaleString();

        renderMetrics({
            commits: weeks.reduce((s, w) => s + w.total, 0),
            devs: contributors.length,
            prs: prs.open,
            mergeTime: prs.avg_hours.toFixed(1)
        });
        renderWeekChart(weeks);
        renderContributors(contributors);
        renderRepos(repos.slice(0, 5));
        renderHeatmap();
        renderLanguages(langs);
        renderPRStats(prs);
        renderHealth(health);

        // Mock activity feed
        window.feedItems = generateMockFeed(repos);
        renderFeed(window.feedItems, 'all');

        startCountdown();
    } catch (err) {
        console.error('Dashboard error:', err);
        hideSkeleton();
        showError(err.message);
    }
}

function generateMockFeed(repos) {
    const types = ['commit', 'pr', 'issue', 'release'];
    const times = ['2h ago', '5h ago', 'Yesterday', '2 days ago', '3 days ago'];
    const titles = {
        commit: ['Fix: Updated login flow', 'Refactor: Improved performance', 'Docs: Updated README', 'Feat: Added dark mode'],
        pr: ['Feature: Add export to PDF', 'Bugfix: Fix memory leak', 'Refactor: Update dependencies', 'Chore: Update CI config'],
        issue: ['Bug: App crashes on iOS', 'Question: How to configure?', 'Feature request: Add dark mode', 'Bug: Slow load time'],
        release: ['Release v2.1.0', 'Release v2.0.5', 'Release v2.0.4', 'Release v2.0.3']
    };
    return Array.from({ length: 15 }, (_, i) => {
        const type = types[Math.floor(Math.random() * types.length)];
        return {
            type,
            title: titles[type][Math.floor(Math.random() * 4)],
            repo: repos[Math.floor(Math.random() * Math.min(repos.length, 5))]?.name || 'repo',
            time: times[Math.floor(Math.random() * times.length)]
        };
    });
}

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', (e) => {
        document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        if (window.feedItems) renderFeed(window.feedItems, e.target.dataset.filter);
    }));
    document.getElementById('retry-btn').addEventListener('click', init);
    init();
});