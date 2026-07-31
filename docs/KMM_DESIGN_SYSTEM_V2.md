# KMM Design System v2.0

## Direction

KMM Design System v2.0 combines Apple-inspired clarity, Kubota orange identity, and compact enterprise analytics. It is a presentation system for the existing product, not a new product architecture.

Core principles:

- Data remains the dominant visual signal.
- Orange communicates brand, selection, focus, and primary action.
- White and neutral surfaces carry most content.
- Green and red are semantic, not decorative.
- Motion communicates state change and stays interruptible.
- Shared components consume semantic tokens before page-level migration.

## Tokens

### Brand

| Token | Value | Use |
| --- | --- | --- |
| `--brand-50` | `#FFF8F3` | Subtle hover and selected surfaces |
| `--brand-100` | `#FFF0E6` | Active navigation and soft emphasis |
| `--brand-500` | `#F56600` | Primary action, focus, map selection |
| `--brand-600` | `#E85D00` | Hover/pressed primary action |

### Surfaces and Text

| Token | Value |
| --- | --- |
| `--surface-canvas` | `#F5F5F7` |
| `--surface-default` | `#FFFFFF` |
| `--surface-subtle` | `#FAFAFC` |
| `--surface-elevated` | `rgba(255,255,255,0.92)` |
| `--text-primary` | `#1D1D1F` |
| `--text-secondary` | `#6E6E73` |
| `--text-tertiary` | `#86868B` |
| `--text-disabled` | `#A1A1A6` |

### Borders and Status

| Token | Value |
| --- | --- |
| `--border-default` | `#E5E5EA` |
| `--border-subtle` | `rgba(0,0,0,0.06)` |
| `--divider` | `#EDEDF2` |
| `--status-success` | `#168A45` |
| `--status-warning` | `#B76800` |
| `--status-danger` | `#D92D20` |
| `--status-info` | `#3B6EA8` |

Status color must always be accompanied by text, iconography, or another non-color cue.

### Spacing

The 4px scale is exposed as `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-7`, `--space-8`, `--space-10`, and `--space-12`.

Allowed values are 4, 8, 12, 16, 20, 24, 28, 32, 40, and 48px.

### Radius and Elevation

| Token | Value |
| --- | --- |
| `--radius-control` | `10px` |
| `--radius-control-lg` | `12px` |
| `--radius-card` | `16px` |
| `--radius-panel` | `20px` |
| `--radius-pill` | `999px` |
| `--shadow-card` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-hover` | `0 4px 16px rgba(0,0,0,0.06)` |
| `--shadow-floating` | `0 12px 32px rgba(0,0,0,0.12)` |
| `--shadow-overlay` | `0 18px 50px rgba(0,0,0,0.16)` |

Cards default to a border and minimal shadow. Floating panels and overlays own the stronger elevation levels.

### Typography

The application uses the local system stack:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Segoe UI", "Helvetica Neue", Arial, sans-serif
```

No proprietary font files or network font requests are required.

Recommended roles:

| Role | Size | Weight |
| --- | --- | --- |
| Page title | 28–32px | 600 |
| Section title | 18–20px | 600 |
| Card title | 14–16px | 600 |
| Primary KPI | 28–36px | 600–700 |
| Body | 14–15px | 400 |
| Label | 12–13px | 500 |
| Caption | 11–12px | 400 |

Numeric KPI, currency, percentage, unit, and table values use `.kmm-tabular`.

### Motion and Focus

| Token | Value |
| --- | --- |
| `--motion-fast` | `160ms` |
| `--motion-standard` | `200ms` |
| `--motion-slow` | `240ms` |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-state` | `cubic-bezier(0.4, 0, 0.2, 1)` |

Controls use a 2px orange focus outline plus a low-opacity outer ring. Existing reduced-motion handling remains global and active.

## Foundation Utilities

- `.kmm-surface`: standard bordered card surface.
- `.kmm-surface-subtle`: secondary grouped surface.
- `.kmm-floating-surface`: elevated panel or overlay.
- `.kmm-tabular`: stable tabular numeric rendering.

These utilities are opt-in. Existing page classes are not automatically overridden.

## Migration Rules

1. Update shared primitives before page-specific markup.
2. Preserve every label, KPI, filter, route, and interaction.
3. Keep Marketing map initialization and business layers untouched.
4. Replace hardcoded visual values only when a component is actively migrated and visually verified.
5. Maintain separate normal, fullscreen, tablet, and mobile checks.
6. Use Lucide icons and accessible names for icon-only buttons.
7. Do not introduce blue as a primary brand color.
8. Do not add decorative gradients, glows, or large empty hero areas.

## Planned Migration Order

1. App shell and shared components
2. Dashboard
3. Sales
4. Booking
5. Stock
6. Marketing
7. Sales Organization
8. Settings

Each page requires TypeScript, tests, build, responsive screenshots, content-preservation review, and console/network inspection before the next migration.
