---
name: Pastel Ledger Clean
colors:
  surface: '#fefafc'
  surface-dim: '#f6d0e1'
  surface-bright: '#fff8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0f5'
  surface-container: '#ffe8f1'
  surface-container-high: '#ffe0ed'
  surface-container-highest: '#ffd8ea'
  on-surface: '#2b1421'
  on-surface-variant: '#574147'
  inverse-surface: '#422936'
  inverse-on-surface: '#ffecf3'
  outline: '#8b7078'
  outline-variant: '#debec7'
  surface-tint: '#b21d66'
  primary: '#ae1a64'
  on-primary: '#ffffff'
  primary-container: '#cf387d'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb0ca'
  secondary: '#aa2b66'
  on-secondary: '#ffffff'
  secondary-container: '#fe6faa'
  on-secondary-container: '#71003e'
  tertiary: '#9c3668'
  on-tertiary: '#ffffff'
  tertiary-container: '#ba4e81'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e3'
  primary-fixed-dim: '#ffb0ca'
  on-primary-fixed: '#3e001f'
  on-primary-fixed-variant: '#8d004d'
  secondary-fixed: '#ffd9e3'
  secondary-fixed-dim: '#ffb0cb'
  on-secondary-fixed: '#3e001f'
  on-secondary-fixed-variant: '#8a0c4e'
  tertiary-fixed: '#ffd9e5'
  tertiary-fixed-dim: '#ffb0cf'
  on-tertiary-fixed: '#3d0023'
  on-tertiary-fixed-variant: '#811f52'
  background: '#fff8f8'
  on-background: '#2b1421'
  surface-variant: '#ffd8ea'
  plane: '#fbf3f6'
  surface-hero: '#fdeef5'
  text-primary: '#3d2230'
  text-secondary: '#7a5c6b'
  text-muted: '#9d8392'
  cta-label: '#4a1029'
  gridline: '#f2dfe7'
  border-hairline: rgba(61, 34, 48, 0.10)
  track-unfilled: '#f6e7ee'
  flow-expense: '#c22e4e'
  flow-income: '#1a7a42'
  status-safe: '#2fa254'
  status-caution: '#d99e14'
  status-warning: '#e06a2a'
  status-danger: '#d64560'
  cat-dining: '#e8752e'
  cat-transport: '#4292e8'
  cat-shopping: '#9a5cd8'
  cat-housing: '#2ca257'
  cat-entertainment: '#e65697'
  cat-medical: '#d43f56'
  cat-education: '#17a091'
  cat-social: '#c99510'
  cat-other: '#9d8392'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 52px
    fontWeight: '600'
    lineHeight: 60px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system delivers a sweet, playful, and restrained minimalist desktop aesthetic for everyday financial clarity. By rejecting ornamental mascots, cartoon stickers, and fussy decorative graphics, the identity achieves maturity and warmth solely through deliberate color harmony, 16px soft containers, tactile pill-shaped action triggers, and delicate chromatic surface rinses.

The personality balances tenderness with numerical precision:
- **Gentle & Playful:** A delicate cherry-blossom and sweet-plum base makes financial accounting comforting rather than stressful.
- **Utilitarian & Restrained:** Adheres to the principle of "one single monumental metric per view" and guarantees swift 3-step transaction entry within 5 seconds.
- **Accessible & Contrast-Guaranteed:** Strict contrast discipline ensures playful pink fields never compromise readability, explicitly replacing inaccessible white typography on pink fills with deep plum ink.

## Colors

The palette establishes a soft pink plane with deep plum inks to satisfy AAA/AA legibility benchmarks across all light surfaces.

### Essential Rules
- **CTA Rule:** White text on pink backgrounds is strictly forbidden. The primary CTA uses fill `tertiary` (`#f981b6`) with `cta-label` (`#4a1029`).
- **Semantic Financial Flows:** Red indicates spending/upward growth (`flow-expense` `#c22e4e`), while green indicates income/downward savings trends (`flow-income` `#1a7a42`). Directional glyphs (`▲`, `▼`) must accompany numerical values.
- **Category Iconography:** Categorical colors are applied to data marks and inner iconography only. Category badge containers use a 12% alpha tint of their respective categorical color over card surfaces. Text never takes categorical colors.

## Typography

The type system uses **Plus Jakarta Sans** for its friendly, rounded geometry, approachable rhythm, and clear tabular-ready figures.

- **Focal Rhythm:** Exactly one `display-hero` is permitted per screen layout to anchor current aggregate expenditure without visual competition.
- **Numerical Alignment:** Financial values in lists and tables rely on proportional spacing with clean baseline alignment alongside currency symbols.
- **Secondary Metas:** Delta notations, percentage counters, and status tags pair `label-sm` or `caption` directly adjacent to values.

## Layout & Spacing

The desktop architecture uses a fixed top navigation bar (`56px`) with a centered, constraint-driven primary application canvas:

- **Desktop Shell:** Viewport width scales fluidly, while the core interactive workflow is anchored within a centered card container constrained to `max-width: 520px` for single-column desktop focus. Analytical dashboards expand across a multi-column fluid grid up to `1200px`.
- **Vertical Rhythm:** Top-level sections maintain `1.5rem` (`space-xl`) margins, while ledger rows enforce a strict `48px` structural touch height.
- **Chart Layouts:** Donut slices maintain a distinct `2px` separator gap tinted to match the parent card surface (`#fefafc`).

## Elevation & Depth

Visual hierarchy is conveyed through tonal surface layering and delicate plum-tinted atmospheric boundaries rather than deep skeuomorphic drop shadows.

- **Surface Tiers:**
  - Base Plane: `#fbf3f6` canvas backdrop.
  - Standard Surface: `#fefafc` for secondary lists and cards.
  - Hero Highlight: Tinted `#fdeef5` for the core financial status container.
- **Atmospheric Boundaries:** Containers rely on a subtle alpha hairline border: `1px solid rgba(61, 34, 48, 0.10)`.
- **Card Shadows:** Soft, ambient plum glow: `box-shadow: 0 4px 16px -2px rgba(61, 34, 48, 0.04), 0 2px 6px -1px rgba(61, 34, 48, 0.02)`.
- **Modal Overlays:** Centered desktop dialogs cast a plum-tinted backdrop blur with `box-shadow: 0 12px 32px -4px rgba(61, 34, 48, 0.12)`.

## Shapes

The geometric signature combines generous 16px corner radii on containers with capsule pill geometry on interactive controls:

- **Container Surfaces (`rounded-lg` / 16px):** Used on all primary cards, the hero spending overview card, and modal sheets.
- **Capsule Contours (`rounded-full` / 9999px):** Applied to primary CTA buttons, filter chips, category pills, budget track indicators, and user account selectors.
- **Data Icon Badges:** `28px × 28px` rounded squares with an 8px (`rounded-md`) inner radius.

## Components

### Buttons
- **Primary CTA ("🌸 记一笔"):** Capsule-shaped (`border-radius: 9999px`), height `52px`, min-width `40%` of container. Fill `#f981b6`, text color `#4a1029` font-weight 600. Active press state triggers `transform: scale(0.97)` over `120ms` ease-out. No bouncing beyond 200ms.
- **Secondary Button:** Capsule fill `rgba(236, 79, 147, 0.12)`, text `#b0306b`, height `40px`.
- **Tertiary / Ghost Button:** Transparent background, text `#7a5c6b`, hover state `#fdeef5`.

### Chips & Filter Pills
- Fully rounded capsule heights of `32px`. Unselected state uses surface `#fefafc` with hairline border `rgba(61, 34, 48, 0.10)` and `#7a5c6b` text. Active state fills with `#ec4f93` and `#ffffff` or `#fdeef5` with `#b0306b` text.

### Category Icon Badges
- Dimensions: `28px × 28px` square with 8px corner radius.
- Background: 12% alpha tint of category color. Icon glyph rendered in 100% saturation category color. Never use pure black or pure white within category icons.

### Ledger List Rows
- Uniform `48px` row height. Borderless or separated with 1px `border-hairline`. Left: Category badge + primary title (`#3d2230`). Right: Amount (`#c22e4e` for expenses, `#1a7a42` for income) with micro-date caption (`#9d8392`).

### Input Fields
- Height `44px`, 12px corner radius. Background `#fefafc`, border 1px solid `rgba(61, 34, 48, 0.10)`. Focus ring: 2px solid `#ec4f93` with zero offset. Placeholder text in `#9d8392`.

### Budget Progress Track
- Track height `6px`, pill-shaped radius. Track background `#f6e7ee`. Indicator fill governed by budget rules:
  - ≤ 60%: `#2fa254`
  - 61%–89%: `#d99e14`
  - 90%–100%: `#e06a2a`
  - > 100%: `#d64560`
- Percentage progress text must always sit beside or above the indicator to ensure full accessibility.