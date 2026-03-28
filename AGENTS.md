# AGENTS.md

## Repository Overview
GitHub Organization Stats Dashboard — a live, dynamic dashboard that calls GitHub REST API v3 and renders real data.

**Tech Stack**: Vanilla JS + HTML + CSS (no framework, no build step)

## File Structure
```
├── index.html       # Full dashboard layout
├── style.css        # Dark GitHub-style theme
├── app.js           # All API + render logic
├── .gitignore
└── AGENTS.md
```

## Design System
**Colors (Dark Theme)**
- Background: `#0d1117`
- Surface: `#161b22`
- Border: `#30363d`
- Text: `#e6edf3`
- Muted: `#8b949e`
- Green: `#3fb950` (commits)
- Blue: `#58a6ff` (PRs, info)
- Purple: `#a371f7` (merged)
- Amber: `#e3b341` (warnings)
- Coral: `#f85149` (issues, errors)

**Typography**
- Numbers/code: `JetBrains Mono`
- Labels: `system-ui`

## Build & Run Commands
```bash
# No build step required — works by opening index.html directly
# For linting (if needed)
npx eslint *.js

# For formatting
npx prettier --write *.js *.css *.html

# For testing (if tests are added)
npx jest  # or npx vitest
```

## GitHub API Configuration (Secure)
```javascript
// Token is entered at runtime via prompt (NOT hardcoded)
// Credentials stored in browser localStorage
// User can clear credentials via Logout button in top bar
```

All requests include: `Authorization: Bearer TOKEN` header via `ghFetch()` helper.

**Security Notes:**
- Token is entered via browser prompt on first load
- Credentials saved in localStorage for convenience
- Logout button clears stored credentials
- For production: use a backend proxy to hide token

## Dashboard Sections (Build All)
1. **Top bar** — org avatar, name, handle, badges (active/repos/members)
2. **Metric cards (4)** — total commits, active devs, open PRs, avg merge time
   - Each card: label, animated count-up value, trend delta badge
3. **Weekly commit bar chart** — 12 bars, hover tooltip, gradient green fill
4. **Two-column row**:
   - Left: Top contributors (ranked, avatar, streak, commit bar)
   - Right: Most active repos (lang dot, stars, commit count)
5. **Contribution heatmap** — 26 weeks × 7 days, 5 intensity levels, hover tooltip
6. **Language breakdown** — proportional segmented bar + legend dots
7. **Tabbed panel (3 tabs)**:
   - Tab 1: Activity feed (filterable: commits/PRs/issues/releases)
   - Tab 2: PR stats (status bar, key metrics)
   - Tab 3: Repo health (bar scores for coverage, CI, docs, review rate)

## GitHub API Endpoints
```javascript
GET /orgs/{org}/repos                         → repo list
GET /repos/{org}/{repo}/contributors          → commit counts per user  
GET /repos/{org}/{repo}/stats/commit_activity → weekly commit array
GET /repos/{org}/{repo}/pulls?state=open      → open PR count
GET /repos/{org}/{repo}/languages             → language bytes map
GET /orgs/{org}/members?per_page=1            → member count (parse Link header)
```

## Code Style Guidelines

### JavaScript
- **ES6+ syntax**: `const`/`let`, arrow functions, template literals
- **Descriptive names**: `fetchContributors()`, not `getCont()`
- **Error handling**: Try/catch around all async operations
- **DOM manipulation**: Use `querySelector`/`querySelectorAll` with clear selectors
- **Number formatting**: `toLocaleString()` for counts, `toFixed(1)` for decimals

### HTML
- Semantic elements where appropriate
- IDs must match JavaScript references exactly
- Accessible attributes (`aria-label`, `role`) for interactive elements

### CSS
- CSS variables for design tokens (see design system above)
- Mobile-first responsive approach
- Smooth transitions for hover states (200-300ms ease)
- Box shadows minimal (0-2px offset)

### File Organization
- Single `app.js` file with sections marked by comments
- Clear function ordering: config → API → aggregators → renderers → UI helpers → init

## Interaction Requirements
- ✅ Animated count-up on metric cards on page load
- ✅ Loading skeleton placeholders while API fetches
- ✅ Hover tooltips on every chart element and heatmap cell
- ✅ Filterable activity feed (chips: All / Commits / PRs / Issues / Releases)
- ✅ Tab switching for bottom panel
- ✅ All numbers formatted with `toLocaleString()` or `toFixed(1)`
- ✅ Graceful error state if API fails (banner + retry button)

## Quality Checklist
Before declaring complete:
- [ ] No hardcoded secrets
- [ ] Authorization header on every `fetch()` call
- [ ] Every displayed number formatted
- [ ] Tooltips on all interactive chart/heatmap cells
- [ ] Error handling on all fetch calls
- [ ] Works by opening `index.html` directly in browser

## JavaScript Architecture
Structure `app.js` in this order:
1. CONFIG (user fills ORG and TOKEN)
2. API HELPERS (`ghFetch()`)
3. DATA FETCHERS (one per endpoint)
4. AGGREGATORS (sort, filter, calculate)
5. RENDERERS (one per dashboard section)
6. UI HELPERS (tooltips, animations, tabs)
7. INIT function

## Common Pitfalls
- Don't hardcode repository names
- Don't forget `await` on async calls
- Don't skip error handling on fetches
- Don't leave `console.log` statements
- Don't use relative paths without base URL
- Don't forget to escape HTML when inserting dynamic content

## Debugging Tips
- Use browser Network tab to inspect API calls
- Check console for CORS errors (GitHub API should allow)
- Verify token has correct scopes (repo, read:org)
- Test with small `per_page` values first
- Use `JSON.stringify(data, null, 2)` for logging responses