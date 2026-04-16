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
    const yAxis = document.getElementById('y-axis');
    container.innerHTML = '';
    
    const max = Math.max(...weeks.map(w => w.total), 1);
    const roundedMax = Math.ceil(max / 100) * 100; // Round up to nearest 100
    
    // Update Y-axis labels
    yAxis.innerHTML = `
        <span>${roundedMax.toLocaleString()}</span>
        <span>${Math.round(roundedMax * 0.75).toLocaleString()}</span>
        <span>${Math.round(roundedMax * 0.5).toLocaleString()}</span>
        <span>${Math.round(roundedMax * 0.25).toLocaleString()}</span>
        <span>0</span>
    `;

    weeks.forEach((week, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'week-bar-wrapper';
        
        const bar = document.createElement('div');
        bar.className = 'week-bar';
        bar.style.height = `${(week.total / max) * 100}%`;
        bar.setAttribute('data-value', week.total.toLocaleString());
        bar.setAttribute('role', 'listitem');
        bar.setAttribute('tabindex', '0');
        bar.setAttribute('aria-label', `Week ${i + 1}: ${week.total.toLocaleString()} commits`);
        
        bar.addEventListener('mouseenter', e => showTooltip(e, `Week ${i + 1}: ${week.total.toLocaleString()} commits`));
        bar.addEventListener('mousemove', updateTooltip);
        bar.addEventListener('mouseleave', hideTooltip);
        bar.addEventListener('focus', e => showTooltip(e, `Week ${i + 1}: ${week.total.toLocaleString()} commits`));
        bar.addEventListener('blur', hideTooltip);
        
        wrapper.appendChild(bar);
        container.appendChild(wrapper);
    });
}

function renderContributors(list) {
    const container = document.getElementById('contributors-list');
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No data</div>';
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
                <div class="contributor-stats">
                    ${c.contributions.toLocaleString()} commits
                </div>
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
        container.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No data</div>';
        return;
    }
    list.forEach(repo => {
        const item = document.createElement('div');
        item.className = 'repo-item';
        item.innerHTML = `
            <div class="repo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15a2 2 0 0 1 1 1.73v5.85a2 2 0 0 1-1 1.73l-9 5.15a2 2 0 0 1-2 0l-9-5.15a2 2 0 0 1-1-1.73v-5.85a2 2 0 0 1 1-1.73l9-5.15a2 2 0 0 1 2 0z"/></svg>
            </div>
            <div class="repo-info">
                <div class="repo-name">${repo.name}</div>
                <div class="repo-stats">
                    <div class="stat-item"><span style="color: #e3b341">⭐</span> ${repo.stargazers_count.toLocaleString()}</div>
                    <div class="stat-item"><span>🍴</span> ${repo.forks_count.toLocaleString()}</div>
                    <div class="stat-item"><div class="lang-dot" style="background: ${LANG_COLORS[repo.language] || LANG_COLORS.default}"></div> ${repo.language || 'N/A'}</div>
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
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `${dateStr}: ${intensity * 4} contributions`);
            cell.addEventListener('mouseenter', e => showTooltip(e, `${dateStr}\n${intensity * 4} contributions`));
            cell.addEventListener('mousemove', updateTooltip);
            cell.addEventListener('mouseleave', hideTooltip);
            cell.addEventListener('focus', e => showTooltip(e, `${dateStr}\n${intensity * 4} contributions`));
            cell.addEventListener('blur', hideTooltip);
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
    document.getElementById('pr-avg-review').textContent = `${prs.avg_review_hours}h`;
    document.getElementById('pr-approval-rate').textContent = `${prs.approval_rate}%`;
    document.getElementById('pr-unreviewed').textContent = prs.unreviewed_prs.toLocaleString();

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
        container.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No activity</div>';
        return;
    }
    const icons = { 
        commit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><line x1="3" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="21"/></svg>', 
        pr: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>', 
        issue: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', 
        release: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.62 5-2.5 5-2.5"/><path d="M12 15v5s3.03-.55 4.5-2c1.62-1.62 2.5-5 2.5-5"/></svg>' 
    };
    filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = `activity-item ${item.type}`;
        el.innerHTML = `
            <div class="activity-icon-box">${icons[item.type] || '📝'}</div>
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
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('skeleton').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('error-banner').classList.add('hidden');
}

function hideSkeleton() {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('skeleton').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    // Trigger staggered reveal animation
    setTimeout(() => {
        document.querySelectorAll('.metric-tile').forEach((el, i) => {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = `reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards ${i * 0.1}s`;
        });
        const reveals = document.querySelectorAll('.reveal');
        reveals.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('active');
            }, i * 100);
        });
    }, 100);
}

function showError(msg) {
    document.getElementById('loader').classList.add('hidden');
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

// === NEW RENDERERS ===
function renderIssueStats(issues) {
    animateCount(document.getElementById('issues-open'), issues.open);
    animateCount(document.getElementById('issues-closed'), issues.closed);
    animateCount(document.getElementById('issues-stale'), issues.stale_count);
    document.getElementById('issues-avg-days').textContent = issues.avg_resolution_days;

    const labelsContainer = document.getElementById('issue-labels');
    labelsContainer.innerHTML = '';

    if (issues.by_label && issues.by_label.length > 0) {
        issues.by_label.forEach(label => {
            const labelEl = document.createElement('div');
            labelEl.className = 'issue-label-item';
            labelEl.innerHTML = `
                <span class="issue-label-name">${label.name}</span>
                <span class="issue-label-count">${label.count}</span>
            `;
            labelsContainer.appendChild(labelEl);
        });
    } else {
        labelsContainer.innerHTML = '<div style="color: var(--text-muted); padding: 10px; text-align: center;">No labels found</div>';
    }
}

function renderReleases(releases) {
    const container = document.getElementById('releases-list');
    container.innerHTML = '';

    // Show release stats at top
    const statsEl = document.createElement('div');
    statsEl.className = 'release-stats';
    statsEl.innerHTML = `
        <div class="release-stat">
            <span class="release-stat-value">${releases.total_releases}</span>
            <span class="release-stat-label">Total Releases</span>
        </div>
        <div class="release-stat">
            <span class="release-stat-value">${releases.last_30_days}</span>
            <span class="release-stat-label">Last 30 Days</span>
        </div>
        <div class="release-stat">
            <span class="release-stat-value">${releases.avg_releases_per_month}</span>
            <span class="release-stat-label">Avg/Month</span>
        </div>
    `;
    container.appendChild(statsEl);

    // Show recent releases
    if (releases.recent && releases.recent.length > 0) {
        releases.recent.forEach(release => {
            const item = document.createElement('div');
            item.className = 'release-item';
            item.innerHTML = `
                <div class="release-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
                </div>
                <div class="release-info">
                    <div class="release-name">${release.name}</div>
                    <div class="release-meta">
                        <span class="release-tag">${release.tag_name}</span>
                        <span class="release-time">${formatTimeAgo(release.published_at)}</span>
                    </div>
                </div>
            `;
            item.addEventListener('click', () => window.open(release.html_url, '_blank'));
            container.appendChild(item);
        });
    } else {
        container.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No recent releases</div>';
    }
}

function renderTopStarred(repos) {
    const container = document.getElementById('top-starred-list');
    container.innerHTML = '';

    // Sort by stargazers_count descending, take top 5
    const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);

    sorted.forEach((repo, i) => {
        const item = document.createElement('div');
        item.className = 'starred-item';
        item.innerHTML = `
            <div class="starred-rank">#${i + 1}</div>
            <div class="starred-info">
                <div class="starred-name">${repo.name}</div>
                <div class="starred-stats">
                    <span class="starred-stars">⭐ ${repo.stargazers_count.toLocaleString()}</span>
                    <span class="starred-forks">🍴 ${repo.forks_count.toLocaleString()}</span>
                </div>
            </div>
        `;
        item.addEventListener('click', () => window.open(repo.html_url, '_blank'));
        container.appendChild(item);
    });
}


function renderTopics(topics) {
    document.getElementById('topics-total').textContent = topics.total_topics;

    const container = document.getElementById('topics-cloud');
    container.innerHTML = '';

    if (topics.topics && topics.topics.length > 0) {
        topics.topics.forEach(topic => {
            const item = document.createElement('div');
            item.className = 'topic-tag';
            // Scale font size based on count (min 12px, max 24px)
            const maxCount = topics.topics[0].count;
            const fontSize = Math.min(24, Math.max(12, (topic.count / maxCount) * 24));
            item.style.fontSize = `${fontSize}px`;
            item.innerHTML = `
                <span class="topic-name">${topic.name}</span>
                <span class="topic-count">${topic.count}</span>
            `;
            container.appendChild(item);
        });
    } else {
        container.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No topics found</div>';
    }
}

function renderCompliance(compliance) {
    const total = compliance.total_repos;
    
    // Update visibility bars
    const publicBar = document.getElementById('visibility-public-bar');
    const privateBar = document.getElementById('visibility-private-bar');
    const archivedBar = document.getElementById('visibility-archived-bar');
    
    publicBar.style.width = `${(compliance.public_count / total) * 100}%`;
    privateBar.style.width = `${(compliance.private_count / total) * 100}%`;
    archivedBar.style.width = `${(compliance.archived_count / total) * 100}%`;
    
    document.getElementById('visibility-public').textContent = compliance.public_count;
    document.getElementById('visibility-private').textContent = compliance.private_count;
    document.getElementById('visibility-archived').textContent = compliance.archived_count;
    
    // Update license list
    const container = document.getElementById('license-list');
    container.innerHTML = '';
    
    if (compliance.licenses && compliance.licenses.length > 0) {
        compliance.licenses.forEach(license => {
            const item = document.createElement('div');
            item.className = 'license-item';
            item.innerHTML = `
                <div class="license-info">
                    <span class="license-name">${license.name}</span>
                    <span class="license-count">${license.count} repos</span>
                </div>
                <div class="license-bar-container">
                    <div class="license-bar" style="width: ${license.percentage}%"></div>
                </div>
                <span class="license-percentage">${license.percentage}%</span>
            `;
            container.appendChild(item);
        });
    } else {
        container.innerHTML = '<div style="color: var(--text-muted); padding: 10px; text-align: center;">No license data</div>';
    }
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 2592000)}mo ago`;
}

// === INIT ===
async function init() {
    showSkeleton();
    try {
        const [repos, members, weeks, contributors, prs, langs, health, issues, releases, topics, compliance] = await Promise.all([
            apiFetch('/repos'),
            apiFetch('/members'),
            apiFetch('/commits'),
            apiFetch('/contributors'),
            apiFetch('/pulls'),
            apiFetch('/languages'),
            apiFetch('/health'),
            apiFetch('/issues'),
            apiFetch('/releases'),
            apiFetch('/topics'),
            apiFetch('/compliance')
        ]);

        hideSkeleton();

        document.getElementById('org-name').textContent = members.org_name || 'Vaco Binary Semantics';
        document.getElementById('org-handle').textContent = '@VacoBinarySemanticsLLP';
        document.getElementById('badge-members').textContent = members.count.toLocaleString();
        document.getElementById('badge-repos').textContent = repos.length.toLocaleString();

        renderMetrics({
            commits: weeks.reduce((s, w) => s + w.total, 0),
            devs: contributors.length,
            prs: prs.open || 0,
            mergeTime: (prs.avg_hours && !isNaN(prs.avg_hours)) ? prs.avg_hours.toFixed(1) : "0.0"
        });
        renderWeekChart(weeks);
        renderContributors(contributors);
        renderRepos(repos.slice(0, 5));
        renderHeatmap();
        renderLanguages(langs);
        renderPRStats(prs);
        renderHealth(health);
        renderIssueStats(issues);
        renderReleases(releases);
        renderTopStarred(repos);
        renderTopics(topics);
        renderCompliance(compliance);

        // Use real activity feed
        const [activity] = await Promise.all([apiFetch('/activity')]);
        window.feedItems = activity.activities;
        renderFeed(window.feedItems, 'all');

        startCountdown();
    } catch (err) {
        console.error('Dashboard error:', err);
        showError(err.message);
    }
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
