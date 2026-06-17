---
name: Azure Clarity
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadc'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#444652'
  inverse-surface: '#2f3133'
  inverse-on-surface: '#f0f0f3'
  outline: '#747683'
  outline-variant: '#c4c6d4'
  surface-tint: '#3959b0'
  primary: '#001d59'
  on-primary: '#ffffff'
  primary-container: '#003087'
  on-primary-container: '#7f9df8'
  inverse-primary: '#b4c5ff'
  secondary: '#5a5f64'
  on-secondary: '#ffffff'
  secondary-container: '#dce0e6'
  on-secondary-container: '#5e6368'
  tertiary: '#440f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#691c00'
  on-tertiary-container: '#f1815c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#1c4197'
  secondary-fixed: '#dfe3e9'
  secondary-fixed-dim: '#c2c7cd'
  on-secondary-fixed: '#171c20'
  on-secondary-fixed-variant: '#42474c'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59d'
  on-tertiary-fixed: '#390b00'
  on-tertiary-fixed-variant: '#7e2b0d'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  headline-lg:
    fontFamily: Work Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Work Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Work Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 16px
  gutter: 12px
---

## Brand & Style
The design system is centered on **high-clarity minimalism** and **trustworthy professionalism**. It is specifically optimized for mobile-first environments where information density must be balanced with extreme readability. The brand personality is dependable, efficient, and transparent.

The aesthetic leans into **Corporate Modernism** with a touch of **Soft Minimalism**. It prioritizes function over decoration, using generous whitespace to reduce cognitive load and subtle blue-tinted surfaces to create a sense of depth without relying on heavy shadows. The emotional response should be one of calm confidence—"everything is organized and easy to find."

## Colors
The palette is dominated by a high-contrast relationship between **Deep Blue (#003087)** and **Pure White (#FFFFFF)**. 

- **Primary:** Deep Blue is used for core brand elements, primary actions, and active states.
- **Surface/Secondary:** A very light blue tint (#F0F4FA) is used for background grouping and subtle differentiation of UI sections, ensuring the interface feels "airy" rather than clinical white.
- **Accent (Alert):** A clear, urgent Red (#D32F2F) is reserved strictly for destructive actions, price drops, or critical notifications.
- **Neutral:** A dark charcoal (#1A1C1E) is used for primary text to ensure maximum legibility while being softer than pure black.

## Typography
The typography strategy uses two distinct sans-serifs to balance personality with utility. 

**Work Sans** is used for headlines to provide a grounded, professional structure with its slightly wider apertures. **Inter** is used for body copy and labels because of its exceptional legibility on small screens and systematic design. 

For mobile views, headline sizes are scaled down to prevent excessive line-breaking, while body text maintains a minimum of 14px to ensure accessibility. High-contrast weights (Bold vs Regular) are used to create hierarchy instead of relying on color variations.

## Layout & Spacing
This design system utilizes a **fluid grid** based on a 4px baseline rhythm. For mobile devices, a standard **4-column grid** is employed with 16px side margins and 12px gutters.

- **Vertical Spacing:** Use `lg` (24px) for spacing between major sections and `sm` (12px) for related elements within a card or list item.
- **Safe Areas:** Ensure all critical interactive elements remain within the mobile safe-area insets, particularly for bottom navigation and "sticky" action buttons.
- **Density:** Maintain "generous whitespace" by ensuring no more than 60% of the screen is covered by active UI components at any time.

## Elevation & Depth
Depth is achieved through **Tonal Layering** rather than heavy shadows. This keeps the interface clean and "straight to the point."

- **Level 0 (Base):** White (#FFFFFF) or Tinted Blue (#F0F4FA).
- **Level 1 (Cards):** White surfaces resting on Tinted Blue backgrounds with a 1px soft border (#DEE5EF) or an extremely diffused, 2% opacity shadow.
- **Level 2 (Modals/Popovers):** Standard White with a slightly stronger shadow to indicate temporary focus.
- **Gradients:** Subtle linear gradients (Primary Blue to a 10% darker shade) may be used on primary buttons to give them a slight "tactile" presence without looking skeuomorphic.

## Shapes
The shape language uses **Soft Corners** to make the professional aesthetic feel approachable and modern. 

- **Standard Elements:** Buttons, Input fields, and Small Cards use an 8px (`rounded`) corner radius.
- **Large Containers:** Content cards or bottom sheets use a 16px (`rounded-lg`) corner radius.
- **Icons:** Should follow a similar soft-cornered geometric style, avoiding sharp 90-degree angles.

## Components
Consistent component styling ensures the app remains predictable and easy to navigate.

- **Buttons:** Primary buttons are solid Deep Blue with White text. Secondary buttons are "ghost" style with a Deep Blue outline. All buttons have a height of at least 48px to meet touch-target accessibility standards.
- **Chips:** Used for filtering or status labels. Use the Tinted Blue background with a Medium weight text for a subtle, non-intrusive look.
- **Input Fields:** Use a 1px light gray border that transitions to Deep Blue on focus. Labels should always be visible above the field (never hidden as placeholder text).
- **Cards:** Content is grouped into white cards with 8px-12px rounded corners. Use vertical stacking for information to suit the mobile scroll behavior.
- **Lists:** High-contrast text with 16px horizontal padding. Use thin #F0F4FA dividers between items to maintain the light, airy feel.
- **Price/Alert Tags:** When showing "Price Drops" or "Urgent Info," use a small Red tag with white text, placed in the top right corner of cards.