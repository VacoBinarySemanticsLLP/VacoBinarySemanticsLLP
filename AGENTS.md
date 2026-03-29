# AGENTS.md

## Repository Overview
GitHub Organization Stats Dashboard for Vaco Binary Semantics LLP.

**Stack**: Node.js + Express backend + vanilla JS frontend

## File Structure
```
├── .env.example      # Template for environment variables
├── .gitignore        # Ignores node_modules, .env
├── package.json      # Dependencies and scripts
├── server.js         # Express entry point
├── lib/
│   └── github.js     # GitHub API client with caching
├── routes/
│   └── github.js     # /api/* route handlers
├── public/
│   ├── index.html    # Dashboard HTML
│   ├── style.css     # Dark GitHub theme
│   └── app.js        # Browser JS (calls /api/* only)
└── README.md         # Organization profile
```

## Security Model
- `GITHUB_TOKEN` lives ONLY in `.env` (gitignored)
- `lib/github.js` reads `process.env.GITHUB_TOKEN`
- Browser JS calls `localhost:3000/api/...` — never touches GitHub directly
- Token NEVER appears in any file inside `public/`

## Commands
```bash
# Install dependencies
npm install

# Run in development (auto-reload)
npm run dev

# Run in production
npm start

# Server runs at http://localhost:3000
```

## API Endpoints (routes/github.js)
| Endpoint | Returns |
|----------|---------|
| GET /api/repos | Top 20 repos sorted by pushed_at |
| GET /api/contributors | Top 10 contributors aggregated |
| GET /api/commits | Weekly commit totals (last 12 weeks) |
| GET /api/pulls | PR stats: open, merged, closed, avg_hours |
| GET /api/languages | Language percentages (top 6 + Other) |
| GET /api/members | Member count |
| GET /api/health | Health metrics (CI, review rate, issues) |

## Setup Steps
1. Copy `.env.example` to `.env`
2. Fill in your `GITHUB_TOKEN` and `ORG_NAME`
3. Run `npm install`
4. Run `npm run dev`
5. Open http://localhost:3000

## Code Style
- Use `async/await` for all async operations
- Error handling with try/catch blocks
- Numbers formatted with `.toLocaleString()`
- CSS variables for design tokens
- No secrets in frontend code

## Common Tasks

### Add new API endpoint
1. Add route handler in `routes/github.js`
2. Export from router
3. Call from `public/app.js` via `apiFetch('/new-endpoint')`

### Update dashboard UI
1. Edit `public/index.html` for structure
2. Edit `public/style.css` for styling
3. Edit `public/app.js` for behavior

### Debug API issues
1. Check server console for `[API CALL]` logs
2. Verify `.env` has valid `GITHUB_TOKEN`
3. Test endpoint directly: `curl http://localhost:3000/api/repos`

## Deployment Notes
- Never commit `.env` file
- Use PM2 or similar for production
- Set `NODE_ENV=production`
- GitHub token needs `repo` and `read:org` scopes