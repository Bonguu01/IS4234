import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { windowAction } from './helpers/ui';

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ledgerwatch.phase1.v1')));
async function start(page, label) {
  await page.getByRole('tab', { name: 'Delivery monitoring', exact: true }).click();
  await page.getByRole('textbox', { name: 'Monitoring scenario', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Start monitoring demo', exact: true }).click();
}
async function step(page) { await page.getByRole('button', { name: 'Next replay event', exact: true }).click(); }

test('missing delivery is detected without a manual run, then recovered and investigated', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/reconciliation');
  await start(page, 'Missing delivery and recovery');
  const manual = (await saved(page)).dataset;
  await step(page);
  expect((await saved(page)).runs).toHaveLength(0);
  await step(page);
  let state = await saved(page);
  expect(state.runs).toHaveLength(0); expect(state.cases).toHaveLength(1);
  expect(state.cases[0].kind).toBe('delivery'); expect(state.cases[0].escalatedAt).toBeTruthy();
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  await page.getByRole('textbox', { name: 'Assigned owner' }).click();
  await page.getByRole('option', { name: 'Alex Carter' }).click();
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Awaiting the closing ledger.');
  await expect(page.getByRole('button', { name: 'Resolve exception', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Needs attention', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reconciliation', exact: true }).click();
  await page.reload();
  expect((await saved(page)).monitoring.session.replayIndex).toBe(2);
  await step(page);
  state = await saved(page);
  expect(state.dataset).toEqual(manual);
  expect(state.runs.at(-1).status).toBe('Passed'); expect(state.runs.at(-1).origin).toBe('monitoring');
  expect(state.cases[0].verifiedClear).toBe(true); expect(state.cases[0].status).toBe('Open');
  await expect(page.getByText('Delivery complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next replay event', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Delivered records received and automatically reconciled.');
  await page.getByRole('button', { name: 'Resolve exception', exact: true }).click();
  expect((await saved(page)).cases[0].status).toBe('Resolved');
  expect(errors).toEqual([]);
});

test('quiet-day delivery passes, while complete but discrepant feeds remain Exceptions', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await start(page, 'Quiet day with zero transactions');
  await step(page); await step(page);
  expect((await saved(page)).cases).toHaveLength(0);
  expect((await saved(page)).runs.at(-1).status).toBe('Passed');
  await start(page, 'Delivered records with a discrepancy');
  await step(page); await step(page);
  expect((await saved(page)).runs.at(-1).status).toBe('Exceptions');
  await expect(page.getByText('Delivery complete', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('$400.00', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/phase2-dashboard.png', fullPage: true });
});

test('stop/resume keeps deadlines, and invalid recovery does not clear delivery cases', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await start(page, 'Invalid delivery and recovery');
  await windowAction(page, 'Stop monitoring');
  await windowAction(page, 'Advance 5 minutes');
  expect((await saved(page)).cases).toHaveLength(0);
  await windowAction(page, 'Resume monitoring');
  expect((await saved(page)).cases).toHaveLength(2);
  await step(page); await step(page);
  expect((await saved(page)).cases.every((item) => !item.verifiedClear)).toBe(true);
  await expect(page.getByText('Invalid', { exact: true }).first()).toBeVisible();
  await step(page);
  expect((await saved(page)).cases.every((item) => item.verifiedClear)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phase2-mobile.png', fullPage: true });
});

test('custom monitored snapshots accept manual deliveries and persist separately', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
  const before = (await saved(page)).dataset;
  await page.getByRole('tab', { name: 'Delivery monitoring', exact: true }).click();
  await page.getByRole('button', { name: 'Monitor staged bank records', exact: true }).click();
  for (const [id, label] of [['intermediary_transactions', 'intermediary transactions'], ['intermediary_balances', 'intermediary balances']]) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByLabel(`Upload ${label} delivery`, { exact: true }).click();
    await (await chooser).setFiles({ name: `${id}.csv`, mimeType: 'text/csv', buffer: await readFile(`public/samples/matching/${id}.csv`) });
    await expect.poll(async () => (await saved(page)).monitoring.session.snapshot.feeds[id]?.filename).toBe(`${id}.csv`);
  }
  expect((await saved(page)).runs.at(-1).status).toBe('Passed');
  expect((await saved(page)).dataset).toEqual(before);
  await page.reload();
  await expect(page.getByText('Delivery complete', { exact: true })).toBeVisible();
  expect((await saved(page)).monitoring.session.scenario).toBeNull();
});

test('a legacy Phase 1 workspace migrates without losing cases or changing its clock', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await page.getByRole('textbox', { name: 'Sample scenario', exact: true }).click();
  await page.getByRole('option', { name: '02 · $400 discrepancy', exact: true }).click();
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  const legacy = await saved(page); legacy.version = 1; delete legacy.monitoring;
  await page.evaluate((data) => localStorage.setItem('ledgerwatch.phase1.v1', JSON.stringify(data)), legacy);
  await page.reload();
  await expect(page.getByRole('alert', { name: 'Workspace notice' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
  const migrated = await saved(page);
  expect(migrated.version).toBe(2); expect(migrated.monitoring).toEqual({ active: false, session: null });
  expect(migrated.cases.map((item) => item.id)).toEqual(legacy.cases.map((item) => item.id));
  expect(migrated.clock).toEqual(legacy.clock); expect(migrated.dataset).toEqual(legacy.dataset);
});
