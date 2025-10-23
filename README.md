# Discovering Tennis

Discovering Tennis is a hub for playful, self-contained tennis experiences. Each project lives in
its own directory under `projects/`, making it easy to add or iterate on games without impacting
others.

## Available experiences

| Experience | Description | Entry point |
| --- | --- | --- |
| Point Roulette | Tap to start and stop a one-second loop for weighted rally cues. | [`projects/point-roulette/`](projects/point-roulette/) |

## Getting started

```bash
npm install
```

## Build

The site is static, but we keep a build hook to cooperate with CI environments:

```bash
npm run build
```

## Test

Automated UI coverage is provided through Playwright. The suite mounts the Point Roulette project
directly from disk to verify the manual start/stop loop, the late-action messaging, the pressure
shake, and the probability mapping utilities.

```bash
npx playwright install --with-deps
npm test
```

## GitHub Pages deployment

1. Push the repository to GitHub (for example under `main`).
2. Enable GitHub Pages via **Settings → Pages**, choose **Deploy from branch**, select `main`, and use the `/` root.
3. Visit `https://<username>.github.io/discoveringtennis/` for the home page. Individual experiences live beneath `projects/`, e.g. `https://<username>.github.io/discoveringtennis/projects/point-roulette/`.

## Project structure

```
.
├── index.html                # Discovering Tennis landing page
├── home.css                  # Styling for the shared landing experience
├── projects/
│   └── point-roulette/
│       ├── index.html        # Roulette UI
│       ├── script.js         # Spin timing, probability mapping, status messaging
│       └── styles.css        # Visual design and animations for the roulette wheel
├── tests/                    # Playwright UI tests
├── package.json              # Scripts (build, test) and dependencies
└── playwright.config.ts      # Playwright configuration
```

## Out of scope

- Persisting spin history, analytics, or cross-experience state.
- Localisation, screen-reader audits, or alternative probability presets.
- Backend services—the site is entirely static.
