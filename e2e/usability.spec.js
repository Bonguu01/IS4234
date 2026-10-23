import { test, expect } from '@playwright/test';

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ledgerwatch.phase1.v1')));
async function sample(page, label = '01 · Matching records') {
  await page.getByRole('textbox', { name: 'Sample scenario', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
}
async function run(page) { await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click(); }

test('dashboard actions open their intended tab and tabs survive reload and browser history', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Open delivery monitor', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Delivery monitoring' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start monitoring demo' })).toBeVisible();
  await page.getByRole('tab', { name: 'Manual CSV records' }).click();
  await expect(page.getByRole('button', { name: 'Load Sample Scenario' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Delivery monitoring' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Start monitoring demo' }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'Run reconciliation', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Manual CSV records' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Manual CSV records' })).toHaveAttribute('aria-selected', 'true');
});

test('result guidance and historical selection distinguish a previous pass from current blocked evidence', async ({ page }) => {
  await page.goto('/#/reconciliation?mode=manual');
  await sample(page); await run(page);
  await expect(page.getByText('Records agree for this run', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Source readiness' })).toContainText('5 / 5 passed');
  await expect(page.getByRole('region', { name: 'Financial agreement' })).toContainText('6 / 6 passed');
  await sample(page, '05 · Missing intermediary feed');
  await expect(page.getByText('Staged records differ from this run', { exact: true })).toBeVisible();
  await run(page);
  await expect(page.getByText('Required checks could not complete', { exact: true })).toBeVisible();
  expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
  await page.getByRole('textbox', { name: 'View reconciliation run' }).click();
  await page.getByRole('option', { name: 'Run 1 · Manual · 2026-10-20 · Passed', exact: true }).click();
  await expect(page.getByText('Historical run · Manual CSV records', { exact: true })).toBeVisible();
  await expect(page.getByText('Staged records differ from this run', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Blocked', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Not assessable', { exact: true })).toBeVisible();
});

test('investigation requirements, filters and evidence panels remain usable', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await sample(page, '02 · $400 discrepancy'); await run(page);
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search exceptions' }).fill('not-a-reference');
  await expect(page.getByText('No cases match these filters', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search exceptions' }).fill('EX-001');
  await page.getByRole('button', { name: 'View EX-001' }).click();
  await expect(page.getByLabel('Resolution requirements')).toContainText('Responsible owner assigned · Required');
  await expect(page.getByRole('button', { name: 'Start investigation', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Assigned owner' }).click();
  await page.getByRole('option', { name: 'Alex Carter' }).click();
  await expect(page.getByLabel('Resolution requirements')).toContainText('Responsible owner assigned · Ready');
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('   ');
  await expect(page.getByRole('button', { name: 'Resolve exception', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /Source evidence at last detection/ }).click();
  await expect(page.getByText(/Bank balances · CSV row/)).toBeVisible();
  await page.getByRole('button', { name: 'Evidence & activity history' }).click();
  await expect(page.getByRole('button', { name: 'Evidence & activity history' })).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: 'test-results/refined-investigation.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Search exceptions' }).fill('');
  await page.screenshot({ path: 'test-results/refined-exceptions.png', fullPage: true });
});

test('a failed delivery replacement cannot present an old Passed result as a current recheck', async ({ page }) => {
  await page.goto('/#/reconciliation?mode=monitoring');
  await page.getByRole('textbox', { name: 'Monitoring scenario', exact: true }).click();
  await page.getByRole('option', { name: 'On-time delivery', exact: true }).click();
  await page.getByRole('button', { name: 'Start monitoring demo' }).click();
  await page.getByRole('button', { name: 'Next replay event' }).click();
  await page.getByRole('button', { name: 'Next replay event' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByLabel('Upload intermediary balances delivery', { exact: true }).click();
  await (await chooser).setFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('bad CSV') });
  await expect(page.getByText('Invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Not assessed yet', { exact: true })).toBeVisible();
  expect((await saved(page)).runs).toHaveLength(1);
  expect((await saved(page)).cases[0].verifiedClear).toBe(false);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Needs attention', { exact: true })).toBeVisible();
  await expect(page.getByText('Awaiting usable records', { exact: true })).toBeVisible();
  await expect(page.getByText('Previous result — current evidence awaits recheck', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/refined-dashboard.png', fullPage: true });
});

test('mobile controls support all screens, keyboard tabs and cancel-safe reset', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/reconciliation?mode=manual');
  await sample(page, '02 · $400 discrepancy'); await run(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Manual CSV records' }).focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Delivery monitoring' })).toHaveAttribute('aria-selected', 'true');
  for (const screen of ['Dashboard', 'Exceptions']) {
    await page.getByRole('link', { name: screen, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole('article', { name: 'Investigation EX-001', exact: true })).toBeVisible();
  await page.getByRole('article', { name: 'Investigation EX-001', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'View EX-001' })).toBeInViewport();
  await page.getByRole('button', { name: 'View EX-001' }).click();
  await expect(page.getByLabel('Resolution requirements')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  const before = await saved(page);
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Clear workspace', exact: true }).click();
  expect((await saved(page)).cases).toEqual([]);
  await page.screenshot({ path: 'test-results/refined-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
