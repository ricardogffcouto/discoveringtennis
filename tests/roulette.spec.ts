import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pageUrl = pathToFileURL(
  path.resolve(__dirname, '..', 'projects', 'point-roulette', 'index.html'),
).toString();

const durationLowerBound = 950;
const durationUpperBound = 1150;

const probabilityExpectations = [
  { probe: 0.0, label: 'weak-ball-A' },
  { probe: 0.21, label: 'high-percentage' },
  { probe: 0.55, label: 'unforced-error' },
  { probe: 0.62, label: 'winner' },
  { probe: 0.7, label: 'double-fault' },
  { probe: 0.92, label: 'weak-ball-B' },
];

async function openRoulette(page) {
  await page.goto(pageUrl);
  await page.waitForFunction(() => Boolean(window.pointroulette));
}

test('spin resolves in roughly one second', async ({ page }) => {
  await openRoulette(page);
  const result = await page.evaluate(() => window.pointroulette.spin({ randomValue: 0.1 }));
  expect(result).not.toBeNull();
  expect(result.duration).toBeGreaterThanOrEqual(durationLowerBound);
  expect(result.duration).toBeLessThanOrEqual(durationUpperBound);
});

test('probability ranges map to the correct labels', async ({ page }) => {
  await openRoulette(page);
  const observed = await page.evaluate(
    (checks) =>
      checks.map((entry) => ({
        probe: entry.probe,
        label: window.pointroulette.segmentForValue(entry.probe).label,
      })),
    probabilityExpectations,
  );

  for (const [index, expectation] of probabilityExpectations.entries()) {
    expect(observed[index].label).toBe(expectation.label);
  }
});

test('status message updates to a valid result after tapping the button', async ({ page }) => {
  await openRoulette(page);
  await page.getByRole('button', { name: /tap to spin/i }).click();
  await page.waitForTimeout(durationUpperBound + 150);
  const text = (await page.locator('#roulette-status').textContent())?.trim();
  const validMessages = await page.evaluate(() => window.pointroulette.messages);
  expect(validMessages).toContain(text);
});
