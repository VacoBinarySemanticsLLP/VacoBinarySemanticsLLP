// GitHub API client with token injection and caching

const BASE_URL = 'https://api.github.com';
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// In-memory cache
const cache = new Map();

/**
 * Get the configured organization name
 */
function getOrg() {
    return process.env.ORG_NAME;
}

/**
 * Fetch from GitHub API with authentication and caching
 * @param {string} path - API path (e.g., '/orgs/myorg/repos')
 * @param {object} options - Additional fetch options
 * @returns {Promise<object>} - Parsed JSON response
 */
async function ghFetch(path, options = {}) {
    const url = `${BASE_URL}${path}`;

    // Check cache
    const cached = cache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] ${path}`);
        return cached.data;
    }

    console.log(`[API CALL] ${path}`);

    const headers = {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Org-Dashboard',
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    // Get Link header for pagination info
    const linkHeader = response.headers.get('Link');
    let totalCount = null;
    if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) {
            totalCount = parseInt(match[1], 10);
        }
    }

    const data = await response.json();

    // Cache the response
    cache.set(url, { data, totalCount, timestamp: Date.now() });

    return { data, totalCount, headers: response.headers };
}

/**
 * Clear the cache (useful for testing)
 */
function clearCache() {
    cache.clear();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        size: cache.size,
        entries: Array.from(cache.keys()).map(url => ({
            url,
            age: Date.now() - cache.get(url).timestamp
        }))
    };
}

module.exports = {
    getOrg,
    ghFetch,
    clearCache,
    getCacheStats
};