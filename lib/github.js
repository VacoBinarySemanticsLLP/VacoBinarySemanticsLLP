// GitHub API client with token injection and caching

const BASE_URL = 'https://api.github.com';
const CACHE_TTL = 3600000; // 1 hour in milliseconds

const cache = new Map();

function getOrg() {
    return process.env.ORG_NAME;
}

async function ghFetch(path, options = {}) {
    const url = `${BASE_URL}${path}`;

    // Check cache
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] ${path}`);
        return { data: cached.data, totalCount: cached.totalCount, headers: cached.headers };
    }

    console.log(`[API CALL] ${path}`);

    const headers = {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Org-Dashboard',
        ...options.headers
    };

    let response = await fetch(url, { ...options, headers });

    // Handle 202 Accepted (Stats calculation in progress)
    // GitHub stats endpoints can take 10+ minutes to compute.
    if (response.status === 202 && !options.noRetry) {
        const retryCount = options.retryCount || 0;
        if (retryCount < 5) {
            const isStatsEndpoint = path.includes('/stats/');
            const baseDelay = isStatsEndpoint ? 30000 : 5000;
            const delay = Math.min(baseDelay * Math.pow(2, retryCount), isStatsEndpoint ? 120000 : 30000);
            console.log(`[RETRYING 202] ${path} in ${delay}ms (attempt ${retryCount + 1}/5)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return ghFetch(path, { ...options, retryCount: retryCount + 1 });
        }
        // Exhausted retries — throw so caller can handle as pending
        throw new Error('202_EXHAUSTED');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    // Get Link header for pagination info
    const linkHeader = response.headers.get('Link');
    let totalCount = null;
    if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) totalCount = parseInt(match[1], 10);
    }

    const data = await response.json();

    // Cache the response (if not 202)
    if (response.status !== 202) {
        cache.set(url, { data, totalCount, headers: response.headers, timestamp: Date.now() });
    }

    return { data, totalCount, headers: response.headers };
}

function clearCache() { cache.clear(); }

function getCacheStats() {
    return {
        size: cache.size,
        entries: Array.from(cache.keys()).map(url => ({
            url,
            age: Date.now() - cache.get(url).timestamp
        }))
    };
}

module.exports = { getOrg, ghFetch, clearCache, getCacheStats };