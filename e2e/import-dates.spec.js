import { test, expect } from '@playwright/test';
import { openSource } from './helpers/ui';

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ledgerwatch.phase1.v1')));

test('Excel CSV dates require explicit interpretation, persist, and reconcile real cents', async ({ page }) => {
  await page.goto('/#/reconciliation?mode=manual');
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
  const source = (await saved(page)).dataset.feeds.intermediary_balances;
  await openSource(page, 'Intermediary balances');
  const csv = source.text.replaceAll('2026-10-20', '10/20/2026').replace('1500.00', '1501.23');
  const chooser = page.waitForEvent('filechooser');
  await page.getByLabel('Upload intermediary balances', { exact: true }).click();
  await (await chooser).setFiles({ name: 'excel-balances.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('Invalid', { exact: true })).toBeVisible();
  await expect(page.getByText(/Row 2: business_date must be a valid YYYY-MM-DD/)).toBeVisible();
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
  await page.getByRole('textbox', { name: 'Intermediary balances CSV date format', exact: true }).click();
  await page.getByRole('option', { name: 'MM/DD/YYYY (month first)', exact: true }).click();
  await expect(page.getByText('Ready', { exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  let state = await saved(page);
  expect(state.runs.at(-1).status).toBe('Exceptions');
  expect(state.runs.at(-1).checks.find((check) => check.id === 'aggregate').detail.differenceCents).toBe(123);
  await page.reload(); await openSource(page, 'Intermediary balances');
  await expect(page.getByRole('textbox', { name: 'Intermediary balances CSV date format', exact: true })).toHaveValue('MM/DD/YYYY (month first)');
  state = await saved(page);
  expect(state.dataset.feeds.intermediary_balances.text).toBe(csv);
  expect(state.dataset.feeds.intermediary_balances.dateFormat).toBe('us');
});
