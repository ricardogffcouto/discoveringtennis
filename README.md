# discoveringtennis Point Roulette

A lightweight, mobile-first tennis roulette that helps players pick the next shot idea on the go. The experience is optimised for GitHub Pages deployments under `/pointroulette` and ships with automated Playwright tests.

## Getting started

```bash
npm install
```

## Build

The project is a static site, but we keep a build hook to comply with CI flows:

```bash
npm run build
```

## Test

Run the Playwright suite to ensure spin timing, probability mapping, and status messaging keep behaving as expected.

```bash
npx playwright install --with-deps
npm test
```

## GitHub Pages deployment

1. Push the contents of this repository to the `main` branch.
2. Enable GitHub Pages in the repository settings, choosing **Deploy from branch** and the `main` branch with the `/` (root) directory.
3. Visit `https://<username>.github.io/pointroulette/` to load the roulette interface.

## Project structure

- `index.html` – main markup for the roulette experience.
- `styles.css` – gradient-rich, responsive styling and animations.
- `script.js` – spin timing, probability handling, and messaging logic.
- `tests/` – Playwright UI tests for timing, mapping, and messaging.
