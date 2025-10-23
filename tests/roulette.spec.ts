import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pageUrl = pathToFileURL(
  path.resolve(__dirname, '..', 'projects', 'point-roulette', 'index.html'),
).toString();

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

test('manual stop before the one-second loop lands on the expected message', async ({ page }) => {
  await openRoulette(page);
  await page.evaluate(() => window.pointroulette.start());
  await page.waitForTimeout(320);
  const result = await page.evaluate(() => window.pointroulette.stop());

  expect(result?.timedOut).toBe(false);
  expect(result?.segment?.label).toBe('high-percentage');
  expect(result?.elapsed).toBeGreaterThanOrEqual(200);
  expect(result?.elapsed).toBeLessThan(600);

  const text = (await page.locator('#roulette-status').textContent())?.trim();
  expect(text).toBe(result?.message);
});

test('late action after one second locks in the unforced error message', async ({ page }) => {
  await openRoulette(page);
  await page.evaluate(() => window.pointroulette.start());
  await page.waitForTimeout(1100);

  const result = await page.evaluate(() => window.pointroulette.lastResult());
  expect(result?.timedOut).toBe(true);
  expect(result?.elapsed).toBe(1000);
  expect(result?.message).toBe(await page.evaluate(() => window.pointroulette.lateMessage));

  const text = (await page.locator('#roulette-status').textContent())?.trim();
  expect(text).toBe(result?.message);
});

test('wheel shakes during the pressure window', async ({ page }) => {
  await openRoulette(page);
  await page.evaluate(() => window.pointroulette.start());

  await page.waitForTimeout(600);
  const hasShake = await page.locator('.roulette__wheel-container').evaluate((el) =>
    el.classList.contains('roulette__wheel-container--shake'),
  );
  expect(hasShake).toBe(true);

  await page.waitForTimeout(600);
  const stillShaking = await page.locator('.roulette__wheel-container').evaluate((el) =>
    el.classList.contains('roulette__wheel-container--shake'),
  );
  expect(stillShaking).toBe(false);
});
