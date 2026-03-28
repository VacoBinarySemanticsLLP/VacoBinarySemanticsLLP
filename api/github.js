// Vercel Serverless Function - GitHub API Proxy
// This hides your GitHub token from the public dashboard

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Get path from query
    const { path } = req.query;

    if (!path) {
        return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Get token from environment variable (HIDDEN from public)
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Forward request to GitHub API
        const githubUrl = `https://api.github.com/${path}`;
        
        const response = await fetch(githubUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'VacoBinarySemanticsLLP-Dashboard'
            }
        });

        // Get response headers to pass through (especially Link header for pagination)
        const linkHeader = response.headers.get('Link');

        // Parse response
        const data = await response.json();

        // Return with status and Link header if present
        const headers = {};
        if (linkHeader) {
            headers['x-github-link'] = linkHeader;
        }

        res.status(response.status).setHeaders(headers).json(data);
    } catch (error) {
        console.error('GitHub API error:', error);
        res.status(500).json({ error: 'Failed to fetch from GitHub' });
    }
}