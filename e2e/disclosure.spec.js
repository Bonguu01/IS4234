import { test, expect } from '@playwright/test';
import { openSource } from './helpers/ui';

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ledgerwatch.phase1.v1')));
async function load(page, label = '01 · Matching records') {
  await page.getByRole('textbox', { name: 'Sample scenario', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
}

test('source controls disclose on demand while errors stay visible after collapse', async ({ page }) => {
  await page.goto('/#/reconciliation?mode=manual'); await load(page);
  const before = await saved(page);
  await expect(page.getByText('Ready', { exact: true })).toHaveCount(5);
  await expect(page.getByLabel('Upload bank balances', { exact: true })).toBeHidden();
  const bank = page.getByRole('button', { name: 'Bank balances source controls', exact: true });
  await bank.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Upload bank balances', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('bank_balances.csv');
  await page.keyboard.press('Escape'); await bank.click();
  expect(await saved(page)).toEqual(before);
  await openSource(page, 'Intermediary balances');
  const chooser = page.waitForEvent('filechooser');
  await page.getByLabel('Upload intermediary balances', { exact: true }).click();
  await (await chooser).setFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('bad CSV') });
  await expect(page.getByText('Invalid', { exact: true })).toBeVisible();
  await openSource(page, 'Bank balances');
  await expect(page.getByLabel('Upload intermediary balances', { exact: true })).toBeHidden();
  await expect(page.getByText(/more in Inspect/)).toBeVisible();
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
  await page.screenshot({ path: 'test-results/disclosure-reconciliation.png', fullPage: true });
});

test('filter dropdown shows active criteria and restores the full queue when cleared', async ({ page }) => {
  await page.goto('/#/reconciliation'); await load(page, '02 · $400 discrepancy');
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  await load(page, '05 · Missing intermediary feed'); await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exception queue (4)', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Filter priority' })).toBeHidden();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('textbox', { name: 'Filter priority' }).click();
  await page.getByRole('option', { name: 'Critical', exact: true }).click();
  await page.getByRole('textbox', { name: 'Filter status' }).click();
  await page.getByRole('option', { name: 'Resolved', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filters (2)', exact: true })).toBeVisible();
  await expect(page.getByText('Active filters: Critical priority · Resolved', { exact: true })).toBeVisible();
  await expect(page.getByText('No cases match these filters', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exception queue (4)', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/disclosure-exceptions.png', fullPage: true });
});

test('monitoring menu supports keyboard dismissal and snapshot inspection without changing records', async ({ page }) => {
  await page.goto('/#/reconciliation?mode=monitoring');
  await page.getByRole('button', { name: 'Start monitoring demo', exact: true }).click();
  const before = await saved(page);
  const menu = page.getByRole('button', { name: 'Window actions', exact: true });
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Stop monitoring', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  expect(await saved(page)).toEqual(before);
  await menu.click(); await page.getByRole('menuitem', { name: 'Inspect monitored snapshot', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Expected business date: 2026-10-20');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Next replay event', exact: true })).toBeVisible();
  expect(await saved(page)).toEqual(before);
});

test('compact source rows and filter dropdown fit on mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/reconciliation?mode=manual'); await load(page, '02 · $400 discrepancy');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/disclosure-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Filter status' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Assigned owner' })).toBeVisible();
  expect(errors).toEqual([]);
});
