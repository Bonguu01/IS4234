import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openSource } from './helpers/ui';

async function scenario(page, label) {
  await page.getByRole('textbox', { name: 'Sample scenario', exact: true }).click();
  await page.getByRole('option', { name: label }).click();
  await page.getByRole('button', { name: 'Load Sample Scenario' }).click();
}
async function saved(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('ledgerwatch.phase1.v1'))); }
async function upload(page, label, name, contents) {
  await openSource(page, label);
  const chooser = page.waitForEvent('filechooser');
  await page.getByLabel(`Upload ${label}`, { exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(contents) ? contents : Buffer.from(contents) });
}

test('computed outcomes, investigation, independent clock, persistence and correction', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/reconciliation');
  await scenario(page, '01 · Matching records');
  await expect(page.getByText('Ready', { exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Passed');
  await scenario(page, '02 · $400 discrepancy');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  const first = await saved(page); expect(first.runs.at(-1).status).toBe('Exceptions');
  expect(first.cases.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).cases).toHaveLength(first.cases.length);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('$400.00', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  await page.getByRole('textbox', { name: 'Assigned owner' }).click();
  await page.getByRole('option', { name: 'Alex Carter' }).click();
  await page.getByRole('button', { name: 'Start investigation' }).click();
  await page.getByRole('textbox', { name: 'Investigation note', exact: true }).fill('Reviewed independent bank evidence.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Verify corrected source records.');
  await expect(page.getByRole('button', { name: 'Resolve exception', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Demo deadline clock', exact: true }).click();
  await page.getByRole('button', { name: 'Advance 25 hours' }).click();
  const advanced = await saved(page);
  expect(advanced.dataset).toEqual(first.dataset);
  expect(advanced.runs[1].systemAt).toBe(first.runs[1].systemAt);
  expect(advanced.cases.every((item) => item.escalatedAt)).toBe(true);
  await page.keyboard.press('Escape');
  await page.reload();
  expect((await saved(page)).cases[0].notes[0].text).toBe('Reviewed independent bank evidence.');
  await page.getByRole('link', { name: 'Reconciliation', exact: true }).click();
  await scenario(page, '03 · Corrected records');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Passed');
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Corrected records successfully rechecked.');
  await page.getByRole('button', { name: 'Resolve exception', exact: true }).click();
  expect((await saved(page)).cases[0].status).toBe('Resolved');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Reconciliation', exact: true }).click();
  await scenario(page, '05 · Missing intermediary feed');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/reconciliation-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.screenshot({ path: 'test-results/exceptions-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('invalid CSV uploads and oversized files block checks without reusing earlier evidence', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/reconciliation');
  await scenario(page, '01 · Matching records');
  const original = (await saved(page)).dataset.feeds.intermediary_balances.text;
  for (const contents of [original.replace('1500.00', '1500.001'), original + '\r\n' + original.split(/\r?\n/)[1], original.replace('CUS-001', 'UNKNOWN')]) {
    await upload(page, 'intermediary balances', 'invalid-ledger.csv', contents);
    await expect.poll(async () => (await saved(page)).dataset.feeds.intermediary_balances?.text).toBe(contents);
    await page.getByRole('button', { name: 'Run reconciliation' }).click();
    expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
    await expect(page.getByText('Invalid', { exact: true })).toBeVisible();
  }
  await scenario(page, '01 · Matching records');
  await upload(page, 'intermediary balances', 'too-large.csv', Buffer.alloc(1024 * 1024, 'x'));
  await expect(page.getByRole('alert', { name: 'Workspace notice' })).toContainText('1 MB');
  expect((await saved(page)).dataset.feeds.intermediary_balances).toBeNull();
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Blocked', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('stale feeds and allocation errors have distinct outcomes', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await scenario(page, '06 · Stale intermediary feed');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Blocked');
  await expect(page.getByText('Stale', { exact: true })).toBeVisible();
  await scenario(page, '04 · Customer allocation error');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  const result = (await saved(page)).runs.at(-1);
  expect(result.status).toBe('Exceptions');
  expect(result.checks.find((check) => check.id === 'aggregate').status).toBe('Passed');
  expect(result.findings.some((finding) => finding.type === 'Customer allocation mismatch')).toBe(true);
});

test('damaged stored runs show a recoverable warning and are preserved until explicit reset', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/reconciliation');
  await scenario(page, '01 · Matching records');
  const damaged = await saved(page); damaged.runs = [{}];
  const raw = JSON.stringify(damaged);
  await page.evaluate((value) => localStorage.setItem('ledgerwatch.phase1.v1', value), raw);
  await page.reload();
  await expect(page.getByRole('alert', { name: 'Workspace notice' })).toContainText('not been overwritten');
  await page.getByRole('button', { name: 'Load Sample Scenario' }).click();
  expect(await page.evaluate(() => localStorage.getItem('ledgerwatch.phase1.v1'))).toBe(raw);
  await page.getByRole('button', { name: 'Reset workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Clear workspace', exact: true }).click();
  await expect(page.getByRole('alert', { name: 'Workspace notice' })).toHaveCount(0);
  expect((await saved(page)).runs).toEqual([]);
  expect(errors).toEqual([]);
});

test('quota failure keeps the app usable and clearly warns that data is only in memory', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ledgerwatch.phase1.v1') throw new DOMException('Storage quota reached', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/#/reconciliation');
  await scenario(page, '01 · Matching records');
  await expect(page.getByRole('alert', { name: 'Workspace notice' })).toContainText('only in memory');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  await expect(page.getByText('Passed', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('alert', { name: 'Workspace notice' })).toContainText('only in memory');
  expect(await saved(page)).toBeNull();
});

test('manual CSV uploads use actual records and the mobile layout remains usable', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await page.getByLabel('Reconciliation business date', { exact: true }).fill('2026-10-20');
  const feeds = [
    ['bank_balances', 'bank balances'],
    ['customer_opening_balances', 'customer opening baseline'],
    ['bank_transactions', 'bank transactions'],
    ['intermediary_transactions', 'intermediary transactions'],
    ['intermediary_balances', 'intermediary balances'],
  ];
  for (const [file, label] of feeds) {
    await openSource(page, label);
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByLabel(`Upload ${label}`, { exact: true }).click();
    await (await fileChooser).setFiles({ name: `${file}.csv`, mimeType: 'text/csv', buffer: await readFile(`public/samples/matching/${file}.csv`) });
    await expect.poll(async () => (await saved(page)).dataset.feeds[file]?.filename).toBe(`${file}.csv`);
  }
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  expect((await saved(page)).runs.at(-1).status).toBe('Passed');
  // Replace one source through the actual file input, with a changed customer balance.
  const state = await saved(page);
  const csv = state.dataset.feeds.intermediary_balances.text.replace('1500.00', '1501.23');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('Upload intermediary balances', { exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'changed-ledger.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect.poll(async () => (await saved(page)).dataset.feeds.intermediary_balances.filename).toBe('changed-ledger.csv');
  await page.getByRole('button', { name: 'Run reconciliation' }).click();
  const result = (await saved(page)).runs.at(-1);
  expect(result.status).toBe('Exceptions');
  expect(result.findings.find((finding) => finding.checkId === 'aggregate').amountCents).toBe(123);
  // Loading a new bundle must replace the displayed upload names as well as the data.
  await scenario(page, '01 · Matching records');
  await expect(page.getByLabel('Upload intermediary balances', { exact: true })).toHaveText('intermediary_balances.csv');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Run reconciliation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.screenshot({ path: 'test-results/exceptions-mobile.png', fullPage: true });
});
