---
name: testing-color-palette-theming
description: Test color palette changes and light/dark mode theming in the Eight25 Assessment WebCrawler frontend. Use when verifying theme switching, CSS custom properties, Tailwind dark mode classes, or color consistency across pages.
---

# Testing Color Palette & Theming

## Prerequisites

### Backend
The FastAPI backend must be running on `localhost:8000`. Start it from the repo root:
```bash
cd /home/ubuntu/repos/Eight25-Assessment
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
```

### Frontend
```bash
cd /home/ubuntu/repos/Eight25-Assessment/frontend
npm install
npm run dev
```
Dev server runs on `localhost:3000`.

### Authentication
Most pages require authentication (only `/login` and `/register` are public). Create a test user via the backend API:
```bash
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}'
```
Then log in through the UI at `/login` before testing protected pages.

## Devin Secrets Needed
None required for local testing. The test user credentials above are for local dev only.

## Key Files
- `frontend/app/globals.css` - CSS custom properties (`:root` and `html.dark`) and Tailwind v4 dark variant
- `frontend/tailwind.config.ts` - Semantic color aliases (`light-bg`, `dark-bg`, `primary`, etc.)
- `frontend/components/ThemeToggle.tsx` - Theme toggle button using `next-themes`
- `frontend/app/layout.tsx` - ThemeProvider configuration (`attribute="class"`, `defaultTheme="system"`)
- `frontend/context/AuthContext.tsx` - Auth routing (redirects unauthenticated users to `/login`)

## Theme System Architecture
- **CSS Custom Properties**: `:root` defines light mode values, `html.dark` overrides for dark mode
- **next-themes**: Manages theme state, toggles `.dark` class on `<html>` element
- **Tailwind v4**: Requires `@custom-variant dark (&:is(.dark *));` in `globals.css` to enable class-based dark mode (v4 ignores the v3 `darkMode: "class"` config)
- **Semantic tokens**: Pages use classes like `bg-light-bg dark:bg-dark-bg` instead of hardcoded colors

## Color Verification Technique
Use `getComputedStyle()` in the browser console to verify exact color values:
```javascript
// Check page background
getComputedStyle(document.body).backgroundColor
// Check specific element
getComputedStyle(document.querySelector('button[type="submit"]')).backgroundColor
// Check html class for dark mode
document.documentElement.classList.contains('dark')
// Check CSS custom property values
getComputedStyle(document.documentElement).getPropertyValue('--bg-color')
```

Convert RGB to hex for comparison:
- `rgb(99, 102, 241)` = `#6366F1` (primary indigo)
- `rgb(100, 116, 139)` = `#64748B` (secondary/muted)
- `rgb(248, 250, 252)` = `#F8FAFC` (light bg)
- `rgb(15, 23, 42)` = `#0F172A` (dark bg)
- `rgb(255, 255, 255)` = `#FFFFFF` (light surface)
- `rgb(30, 41, 59)` = `#1E293B` (dark surface)
- `rgb(226, 232, 240)` = `#E2E8F0` (light border)
- `rgb(51, 65, 85)` = `#334155` (dark border)

## Test Scenarios

### 1. Landing Page Colors
- Navigate to `/` (requires auth)
- Verify primary buttons are the expected primary color
- Verify heading accent text uses primary color
- Verify page background matches current mode

### 2. Theme Toggle
- Locate ThemeToggle at bottom of sidebar (next to "Backend :8000")
- Click to toggle; verify `<html>` class changes
- Verify page bg, sidebar bg, text color, and border color all switch
- Verify icon changes (Moon = light mode, Sun = dark mode)
- Verify primary color remains consistent across modes

### 3. Login Page
- Navigate to `/login` (public, no auth needed)
- Verify form elements use theme-aware colors
- Toggle theme and verify all colors invert properly
- Verify primary-colored elements (buttons, icons) stay consistent

### 4. Drift Page
- Navigate to `/drift` (requires auth)
- Verify page uses theme tokens, not hardcoded colors
- Toggle theme and verify all elements respond
- Watch for elements stuck in single-mode colors (common regression)

### 5. Sidebar Navigation
- Verify active nav item uses primary color with opacity bg
- Verify inactive items use secondary/muted color
- Navigate between pages and verify active indicator moves
- Verify sidebar bg/border change with theme

## Common Issues

### Tailwind v4 Dark Mode Not Working
If `dark:` prefixed classes don't respond to theme toggle but CSS custom properties do work, the Tailwind v4 dark variant directive might be missing. Check that `globals.css` contains:
```css
@custom-variant dark (&:is(.dark *));
```
This must come after `@import "tailwindcss";`. Without it, Tailwind v4 uses `@media (prefers-color-scheme: dark)` instead of the `.dark` class.

### Auth Redirects During Testing
If navigating to `/` or other pages keeps redirecting to `/login`, you need to authenticate first. The `AuthContext` checks for a logged-in user and redirects to `/login` for all non-public paths.

### Elements With Hardcoded Colors
If some elements don't change with theme toggle, they may be using hardcoded Tailwind classes (e.g., `bg-slate-950`) instead of semantic tokens (`bg-light-bg dark:bg-dark-bg`). Check the component source for non-theme-aware classes.

## Recording Methodology
When screen-recording tests:
1. Maximize browser window before starting
2. Use `annotate_recording` with `type="setup"` before test execution
3. Use `type="test_start"` at the beginning of each test scenario
4. Use `type="assertion"` after each verification with pass/fail result
5. Write consolidated assertions (group related checks, keep under 80 chars)
