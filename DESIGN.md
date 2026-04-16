# Design System — Vaco Dashboard

## Product Context

- **What this is:** GitHub Organization Stats Dashboard for Vaco Binary Semantics LLP
- **Who it's for:** Engineering teams monitoring repo health, commit velocity, and developer activity
- **Space/industry:** B2B dev tools / engineering intelligence
- **Project type:** Data dashboard / web app

## Aesthetic Direction

- **Direction:** Supabase-inspired dark-mode-native developer aesthetic
- **Reference:** Supabase, Linear, Vercel — dark surfaces with strategic brand accents
- **Mood:** Premium code editor meets sophisticated marketing surface. Developer soul with refined execution.
- **Key Characteristic:** Depth created through border hierarchy, not shadows. Emerald green used sparingly as identity marker.

---

## Color Palette

### Brand Green
| Token | Hex | Usage |
|-------|-----|-------|
| `green-brand` | `#3ecf8e` | Primary brand accent, chart bars, active states |
| `green-link` | `#00c573` | Interactive links and actions |
| `green-border` | `rgba(62, 207, 142, 0.3)` | Subtle green border accent |

### Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-deepest` | `#0f0f0f` | Primary button background, deepest surface |
| `bg-primary` | `#171717` | Page background, primary canvas |
| `bg-surface` | `#1e1e1e` | Cards, panels, elevated elements |
| `bg-elevated` | `#252525` | Hover states, input backgrounds |

### Border Hierarchy (Depth Through Lines)
| Token | Hex | Usage |
|-------|-----|-------|
| `border-subtle` | `#242424` | Barely visible, subtle separation |
| `border-standard` | `#2e2e2e` | Default card/component borders |
| `border-prominent` | `#363636` | Interactive element hover borders |
| `border-light` | `#393939` | Secondary borders |
| `border-charcoal` | `#434343` | Tertiary, heavy accents |

### Text Scale
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#fafafa` | Primary text, headings |
| `text-secondary` | `#b4b4b4` | Secondary text, descriptions |
| `text-muted` | `#898989` | Tertiary text, metadata, captions |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#3ecf8e` | Positive metrics (uses brand green) |
| `warning` | `#f5a623` | Attention/warning states |
| `error` | `#ef4444` | Errors, negative trends |

---

## Typography

### Font Families
- **Primary:** `Inter` — geometric sans-serif with subtle rounding
  - Fallbacks: `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`
- **Monospace:** `Source Code Pro` — technical labels, data
  - Fallbacks: `'Menlo', 'Monaco', 'Monaco', monospace`

### Hierarchy
| Role | Font | Size | Weight | Letter Spacing | Notes |
|------|------|------|--------|---------------|-------|
| Display | Inter | 72px | 400 | normal | Hero only, line-height 1.00 |
| Section Heading | Inter | 36px | 400 | normal | Feature titles, line-height 1.25 |
| Card Title | Inter | 18px | 400 | normal | -0.16px tracking |
| Metric Value | Source Code Pro | 26px | 500 | normal | Tabular nums, high impact |
| Body | Inter | 14px | 400 | normal | Standard body text |
| Button | Inter | 13px | 500 | normal | Interactive labels |
| Caption | Inter | 12px | 400 | normal | Metadata, tags |
| Code Label | Source Code Pro | 11px | 400 | 0.5px | Uppercase technical markers |

### Principles
- **Weight restraint:** Weight 400 (regular) for nearly everything. Weight 500 only for buttons, labels, and emphasis.
- **No bold (700):** Hierarchy is created through size and color, not weight.
- **Monospace as ritual:** Source Code Pro uppercase labels create the "developer console" voice.

---

## Spacing

### Base Unit: 8px

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Ghost buttons, small elements |
| `--radius-md` | 8px | Cards, containers, inputs |
| `--radius-lg` | 12px | Mid-size panels |
| `--radius-xl` | 16px | Major containers, feature cards |
| `--radius-pill` | 9999px | Primary buttons, tabs |

### Scale (8px base)
```
2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48
```

---

## Component Styling

### Cards / Surfaces
```css
background: var(--bg-surface);   /* #1e1e1e */
border: 1px solid var(--border-standard);  /* #2e2e2e */
border-radius: var(--radius-lg);  /* 8px */
padding: 16px 18px;
```
**No shadows** — borders define edges and depth.

### Primary Pill Button
```css
background: var(--bg-deepest);    /* #0f0f0f */
color: var(--text-primary);      /* #fafafa */
border: 1px solid var(--border-prominent);  /* #363636 */
border-radius: 9999px;
padding: 8px 20px;
font-size: 13px;
font-weight: 500;
```
**On hover:** `border-color: var(--green-brand);`

### Metric Tile
```css
background: var(--bg-surface);
border: 1px solid var(--border-standard);
border-radius: var(--radius-lg);
padding: 16px 18px;
transition: border-color 0.2s;
```
**On hover:** `border-color: var(--border-prominent);`

### Green Icon Box
```css
background: rgba(62, 207, 142, 0.1);
color: var(--green-brand);
width: 32px; height: 32px;
border-radius: var(--radius-sm);
display: flex;
align-items: center;
justify-content: center;
```

### Chart Bars
```css
background: var(--green-brand);  /* #3ecf8e */
border-radius: 3px 3px 0 0;
transition: opacity 0.15s;
```
**On hover:** `opacity: 0.8;`

### Tabs (Pill Style)
```css
background: transparent;
color: var(--text-muted);
border-radius: 9999px;
padding: 8px 12px;
font-size: 13px;
font-weight: 500;
```
**Active:**
```css
background: var(--green-brand);
color: var(--bg-deepest);
```

### Activity Item
```css
background: var(--bg-elevated);
border: 1px solid var(--border-subtle);
border-radius: var(--radius-md);
padding: 12px;
```
**On hover:** `border-color: var(--border-standard);`

### PR Status Bar
```css
height: 36px;
border-radius: var(--radius-md);
background: var(--bg-elevated);
```
**Merged:** `background: var(--green-brand)`
**Open:** `background: #818cf8`
**Closed:** `background: var(--border-charcoal)`

---

## Layout

### Grid System
- **Max width:** 1000px
- **Metrics grid:** 4 columns → 2 columns (tablet) → 1 column (mobile)
- **Two column panels:** 1 column on mobile
- **Gap scale:** 12px (tight), 16px (default), 20px (loose)

### Page Structure
```
[Top Bar] - sticky, 14px 20px padding, rounded-lg
[Metrics Grid] - 4-column, 12px gap, 20px margin-bottom
[Chart Section] - full width, rounded-xl
[Two Column] - 1fr 1fr, 16px gap
[Heatmap] - full width, rounded-xl
[Language] - full width, rounded-xl
[Tabs] - full width, rounded-xl
[Footer] - rounded-lg top corners only
```

### Responsive Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop | >900px | Full 4-column metrics |
| Tablet | 768-900px | 2-column metrics, stacked layout |
| Mobile | <768px | Single column, collapsed nav |

---

## Motion

### Principles
- **Minimal:** Only transitions that aid comprehension
- **Functional:** No decorative animations
- **Fast:** Most transitions under 200ms

### Durations
| Type | Duration | Usage |
|------|----------|-------|
| Micro | 150ms | Hover states, opacity changes |
| Short | 200ms | Border color transitions |
| Medium | 300-500ms | Layout reveals, tab switches |

### Easing
```css
ease;  /* Default for most transitions */
/* No custom cubic-bezier needed — simple is better */
```

### Reveal Animation
```css
.reveal {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.5s ease, transform 0.5s ease;
}
.reveal.active {
    opacity: 1;
    transform: translateY(0);
}
```

---

## Focus States

```css
/* Minimal, functional focus only */
box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
```

**Note:** Shadows are rare in this system. Focus states are one of the few acceptable uses.

---

## Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (0) | No shadow, border `#2e2e2e` | Default state, most surfaces |
| Subtle (1) | Border `#363636` or `#393939` | Interactive elements, hover |
| Focus (2) | `rgba(0, 0, 0, 0.1) 0px 4px 12px` | Focus states only |
| Brand Accent (3) | Border `rgba(62, 207, 142, 0.3)` | Green-highlighted elements |

---

## Anti-Patterns

### Don't
- ❌ Add box-shadows for depth — borders define depth in this system
- ❌ Use bold (700) text weight — 400 and 500 only
- ❌ Apply green to large surfaces — it's for borders, links, and small accents only
- ❌ Use warm colors (crimson, orange) as primary — semantic tokens only
- ❌ Increase hero line-height above 1.00 — density is intentional
- ❌ Use large radius (16px+) on buttons — pills (9999px) or standard (6px) only
- ❌ Lighten background above `#171717` — darkness is structural

### Do
- ✅ Use near-black backgrounds (`#0f0f0f`, `#171717`)
- ✅ Apply green (`#3ecf8e`, `#00c573`) sparingly — it's an identity marker
- ✅ Use Inter at weight 400 for nearly everything
- ✅ Create depth through border color differences (`#242424` → `#2e2e2e` → `#363636`)
- ✅ Use pill shape (9999px) for primary CTAs and tabs
- ✅ Use Source Code Pro uppercase for technical labels

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-13 | Initial design system | Industrial/Data-Forward with cyan primary |
| 2026-04-16 | Redesign | Supabase-inspired dark-mode-native aesthetic with emerald green brand accent, border-defined depth system |
