# Clean Admin UI Style

This document defines the preferred frontend style for the `manager` project.
Read this before building new pages, redesigning old pages, or touching shared layout/components.

## Design Goal

Build admin pages that feel:

- clean
- calm
- structured
- easy to scan
- light and professional

The reference direction is a traditional admin web layout:

- left sidebar
- thin top header
- wide content area
- white or near-white surfaces
- restrained green as the main accent
- dense tables and forms, but with enough spacing to stay readable

This is not a flashy marketing site.
It should feel operational, practical, and low-noise.

## Core Rules

- Use very few colors
- Use very little animation
- Prefer stability and clarity over visual effects
- Keep screens simple even when the data is dense
- Make tables, filters, forms, and modals feel consistent across pages

## Visual Direction

### Color System

Use a restrained palette:

- primary accent: green / teal-green family
- background: white, warm white, or very light gray
- borders: soft gray or very pale green-gray
- text: dark gray, not pure black
- success/error: muted semantic colors only when needed

Avoid:

- rainbow accents
- neon cyan/purple gradients
- many saturated colors on one screen
- heavy dark themes for backoffice pages unless explicitly required

### Suggested Feel

The screenshots point to this balance:

- dark green top bar
- very light content background
- pale green selected navigation state
- white cards with soft gray borders
- green table headers as the strongest accent

That should be the dominant visual language.

## Motion Rules

Motion should be minimal.

Allowed:

- subtle hover state
- light fade for modal open/close
- short state transition on buttons or inputs

Preferred limits:

- duration around `120ms` to `180ms`
- ease-out
- no bounce
- no large translate or scale effects

Avoid:

- page hero animations
- floating cards
- parallax
- animated gradients
- repeated skeleton shimmer everywhere
- decorative motion that does not help a task

If an animation can be removed without hurting usability, remove it.

## Layout Rules

### App Shell

Use a stable admin layout:

- fixed or sticky top bar
- fixed left sidebar on desktop
- content panel with clear max width and generous padding
- large empty space is acceptable if it improves readability

The page should feel orderly, not dramatic.

### Spacing

Use consistent spacing:

- page padding: `20px` to `32px`
- card padding: `16px` to `24px`
- form gap: `12px` to `16px`
- section gap: `20px` to `32px`

Do not compress everything just to fit more data.
Do not overspace like a landing page either.

## Component Style

### Sidebar

- simple background
- small icons
- compact item height
- one active state using pale green background and darker text
- avoid glowing borders, glassmorphism, or animated highlights

### Topbar

- thin and consistent
- logo left, account/status tools right
- avoid oversized shadows and layered backgrounds
- keep text and icons small, sharp, and aligned

### Cards and Panels

- white surface
- 1 subtle border
- small or medium radius
- very soft shadow only if needed

Preferred:

- radius around `8px` to `12px`
- border before shadow

Avoid:

- deep shadows
- translucent glass panels
- heavy blur effects

### Forms

- keep labels visible and direct
- inputs should look plain and reliable
- use 1 or 2 column layout depending on screen width
- group related fields inside clean sections

Avoid:

- oversized rounded pill inputs
- decorative icons in every input
- bright outlines unless focused

### Buttons

- primary button in muted green
- secondary button white or light gray with border
- destructive button only when needed

Buttons should feel functional, not promotional.

Avoid:

- gradient buttons
- glowing buttons
- oversized icon-heavy buttons

### Tables

Tables are a major part of this product.
They should be one of the cleanest components in the system.

Rules:

- clear header row
- compact but readable row height
- thin borders
- numeric values aligned consistently
- status/actions grouped clearly
- pagination simple and quiet

Preferred:

- green or dark header row
- white body rows
- very light zebra striping only if it helps
- red numbers only for negative values or alerts

Avoid:

- too many badge colors in one row
- noisy row hover animations
- giant action button groups inside cells

### Modals

- centered
- white background
- clear title
- modest shadow
- enough breathing room

Use modals for short focused tasks only.
If the content becomes long, use a full page instead.

## Typography

Typography should stay neutral and readable.

Preferred:

- Thai/Lao-friendly sans-serif
- medium weight for titles
- regular weight for body
- stable font sizes across tables and forms

Suggested scale:

- page title: `24px` to `28px`
- section title: `18px` to `20px`
- body: `14px`
- table text: `13px` to `14px`
- helper text: `12px`

Avoid:

- decorative fonts
- large heading drama
- inconsistent font sizing between pages

## Content Density

This product can be data-heavy.
The answer is not more color or more animation.
The answer is better grouping.

Use:

- section titles
- spacing
- cards
- tabs
- filter rows
- modal focus

Do not try to make admin pages feel like dashboards for investors or landing pages for consumers.

## Styling Decisions For This Project

When working in `manager`, prefer:

- light mode
- green accent
- white surfaces
- minimal gradients
- minimal motion
- simple shadows
- clean MUI or Tailwind composition

When touching old screens that use dark backgrounds, cyan glow, animated gradients, or glossy cards:

- do not expand that style further
- gradually move touched screens toward this guide
- prioritize layout cleanup before cosmetic decoration

## Implementation Guidance

### Tailwind

Prefer utility usage that supports a quiet UI:

- neutral backgrounds
- subtle borders
- restrained radius
- simple flex/grid layout

Avoid building a new layer of custom flashy utility classes unless the system truly needs them.

### MUI

When using MUI components:

- keep elevation low
- prefer outlined or lightly filled inputs
- unify border radius
- override noisy defaults if they break the clean style

### Reuse

Before creating a new page, try to reuse:

- shared page container
- table wrapper
- filter row
- modal shell
- section header
- form field styles

The goal is consistency, not one-off page styling.

## Quick Checklist

Before shipping a screen, check:

- Is the page mostly white/light rather than dark/glossy?
- Is green the only strong accent?
- Is motion subtle and sparse?
- Are borders/shadows restrained?
- Are forms and tables easy to scan?
- Does the page feel like a clean admin tool rather than a promo site?

If any answer is no, simplify it.
