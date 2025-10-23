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
  await page.evaluate(() => window.pointroulette.reset());
}

async function readBallScale(page) {
  return page.locator('.roulette__ball').evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.hypot(matrix.a, matrix.b);
  });
}

async function readBallRotation(page) {
  return page.locator('.roulette__ball').evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const radians = Math.atan2(matrix.b, matrix.a);
    const degrees = (radians * 180) / Math.PI;
    return (degrees + 360) % 360;
  });
}

async function readWheelRotation(page) {
  return page.locator('.roulette__wheel').evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const radians = Math.atan2(matrix.b, matrix.a);
    const degrees = (radians * 180) / Math.PI;
    return (degrees + 360) % 360;
  });
}

test('probability ranges map to the correct labels', async ({ page }) => {
  await openRoulette(page);
  const observed = await page.evaluate((checks) =>
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
  const hasShake = await page
    .locator('.roulette__wheel-container')
    .evaluate((el) => el.classList.contains('roulette__wheel-container--shake'));
  expect(hasShake).toBe(true);

  await page.waitForTimeout(600);
  const stillShaking = await page
    .locator('.roulette__wheel-container')
    .evaluate((el) => el.classList.contains('roulette__wheel-container--shake'));
  expect(stillShaking).toBe(false);
});

test('tennis ball grows as the spin approaches the deadline', async ({ page }) => {
  await openRoulette(page);

  const idleScale = await readBallScale(page);
  await page.evaluate(() => window.pointroulette.start());
  await page.waitForTimeout(400);
  const midScale = await readBallScale(page);
  await page.waitForTimeout(350);
  const lateScale = await readBallScale(page);

  expect(midScale).toBeGreaterThan(idleScale);
  expect(lateScale).toBeGreaterThan(midScale);
});

test('ball stays expanded when time runs out instead of resetting', async ({ page }) => {
  await openRoulette(page);
  await page.evaluate(() => window.pointroulette.start());
  await page.waitForTimeout(1200);

  const finalScale = await readBallScale(page);
  expect(finalScale).toBeGreaterThan(0.9);
});

test('tennis ball rotates clockwise as the wheel spins', async ({ page }) => {
  await openRoulette(page);

  const idleRotation = await readBallRotation(page);
  await page.evaluate(() => window.pointroulette.start());
  await page.waitForTimeout(300);
  const midRotation = await readBallRotation(page);
  await page.waitForTimeout(300);
  const lateRotation = await readBallRotation(page);

  expect(midRotation).toBeGreaterThan(idleRotation);
  expect(lateRotation).toBeGreaterThan(midRotation);
});

test('button cycles through start, hit, reset, then back to start', async ({ page }) => {
  await openRoulette(page);

  const button = page.locator('#spin-button');
  await expect(button).toHaveText('Start');

  await button.click();
  await expect(button).toHaveText('Hit');

  await page.waitForTimeout(320);
  await button.click();
  await expect(button).toHaveText('Reset');

  await button.click();
  await expect(button).toHaveText('Start');
});

test('reset snaps the wheel back to its initial orientation without animation', async ({ page }) => {
  await openRoulette(page);

  const button = page.locator('#spin-button');
  await button.click();
  await page.waitForTimeout(450);
  await button.click();

  const rotationBeforeReset = await readWheelRotation(page);
  await expect(button).toHaveText('Reset');

  await button.click();
  const rotationAfterReset = await readWheelRotation(page);

  expect(rotationBeforeReset).not.toBeCloseTo(rotationAfterReset, 1);
  expect(rotationAfterReset).toBeCloseTo(90, 0);

  await page.waitForTimeout(40);
  const rotationAfterWait = await readWheelRotation(page);
  expect(rotationAfterWait).toBeCloseTo(rotationAfterReset, 2);
});

test('pointer anchors above the wheel and points toward its centre', async ({ page }) => {
  await openRoulette(page);

  const pointerBox = await page.locator('.roulette__pointer').boundingBox();
  const wheelBox = await page.locator('.roulette__wheel').boundingBox();

  expect(pointerBox).not.toBeNull();
  expect(wheelBox).not.toBeNull();

  if (!pointerBox || !wheelBox) {
    throw new Error('Expected pointer and wheel to have bounding boxes');
  }

  const pointerCenterX = pointerBox.x + pointerBox.width / 2;
  const wheelCenterX = wheelBox.x + wheelBox.width / 2;
  expect(Math.abs(pointerCenterX - wheelCenterX)).toBeLessThan(2);

  const pointerTipY = pointerBox.y + pointerBox.height;
  expect(pointerTipY).toBeLessThanOrEqual(wheelBox.y + 4);
});
