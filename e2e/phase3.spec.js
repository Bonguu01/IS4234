import { test, expect } from '@playwright/test';
import { openSource } from './helpers/ui';

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ledgerwatch.phase1.v1')));
async function guideLoad(page, name) {
  await page.getByRole('button', { name: 'Demo guide', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function run(page) { await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click(); }
async function dashboard(page) { await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); }
async function sample(page, label) {
  await page.getByRole('textbox', { name: 'Sample scenario', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
}

test('guided presentation: genuine checks, one $400 position, automatic review and verified closure', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Not assessable', { exact: true })).toBeVisible();
  await guideLoad(page, 'Load matching records');
  expect((await saved(page)).runs).toHaveLength(0);
  await run(page); await dashboard(page);
  await expect(page.getByText('Records agree', { exact: true })).toBeVisible();
  await guideLoad(page, 'Load $400 discrepancy'); await run(page);
  let state = await saved(page);
  expect(state.runs.at(-1).status).toBe('Exceptions');
  expect(state.cases).toHaveLength(3);
  expect(state.cases.every((item) => item.riskEscalation?.gapCents === 40000)).toBe(true);
  await dashboard(page);
  await expect(page.getByText('$400.00', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Management review required', { exact: true })).toBeVisible();
  await expect(page.getByText('$1,200.00', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/phase3-dashboard.png', fullPage: true });
  await page.getByRole('link', { name: /Review with Risk \/ Compliance/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox', { name: 'Assigned owner' }).click();
  await page.getByRole('option', { name: 'Alex Carter', exact: true }).click();
  await page.getByRole('button', { name: 'Start investigation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Investigation note', exact: true }).fill('Compared independent bank evidence with the intermediary ledger.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resolve exception', exact: true })).toBeDisabled();
  const caseId = (await saved(page)).cases.find((item) => item.owner === 'Alex Carter').id;
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Assigned owner' })).toHaveValue('Alex Carter');
  await page.getByRole('link', { name: 'View supporting run', exact: true }).click();
  await expect(page.getByText('Differences need investigation', { exact: true })).toBeInViewport();
  await guideLoad(page, 'Load corrected records'); await run(page); await dashboard(page);
  await expect(page.getByText('Records agree', { exact: true })).toBeVisible();
  await expect(page.getByText('$0.00', { exact: true })).toBeVisible();
  state = await saved(page);
  expect(state.cases.filter((item) => item.status !== 'Resolved')).toHaveLength(3);
  await page.getByRole('link', { name: /Document verified closure/ }).click();
  await expect(page.getByRole('link', { name: 'View verified correction', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Corrected deposit verified by a fresh reconciliation.');
  await page.getByRole('button', { name: 'Resolve exception', exact: true }).click();
  expect((await saved(page)).cases.find((item) => item.id === caseId).status).toBe('Resolved');
  expect(errors).toEqual([]);
});

test('allocation mismatch shows zero pooled gap, two flagged customers and evidence-linked investigations', async ({ page }) => {
  await page.goto('/#/reconciliation?mode=manual');
  await sample(page, '04 · Customer allocation error'); await run(page); await dashboard(page);
  await expect(page.getByText('$0.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Management review required', { exact: true })).toBeVisible();
  await expect(page.getByText(/1 transaction allocation mismatch/)).toBeVisible();
  await page.getByRole('button', { name: 'How is this assessed?', exact: true }).click();
  await expect(page.getByText('Customer references: CUS-001, CUS-002', { exact: true })).toBeVisible();
  const state = await saved(page);
  const item = state.cases.find((record) => record.checkId === 'transactions');
  await page.goto(`/#/exceptions?case=${encodeURIComponent(item.id)}`);
  await page.getByRole('button', { name: /Source evidence at last detection/ }).click();
  await expect(page.getByText('Bank transactions · CSV row 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Intermediary transactions · CSV row 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Technical record', exact: true }).first()).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: /Related investigations/ }).click();
  await page.getByRole('link', { name: /Shared transaction TX-001/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Customer balance mismatch', { exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/phase3-investigation.png', fullPage: true });
});

test('risk referrals survive repeat runs and reload without duplicated management referrals', async ({ page }) => {
  await page.goto('/#/reconciliation'); await sample(page, '02 · $400 discrepancy'); await run(page);
  const first = await saved(page);
  await run(page); await page.reload();
  const after = await saved(page);
  expect(after.cases.map((item) => item.id)).toEqual(first.cases.map((item) => item.id));
  expect(after.events.filter((event) => event.riskPolicy)).toHaveLength(3);
  expect(after.cases.map((item) => item.riskEscalation)).toEqual(first.cases.map((item) => item.riskEscalation));
});

test('late historical replay does not hide the newer business-date position', async ({ page }) => {
  await page.goto('/#/reconciliation'); await sample(page, '02 · $400 discrepancy');
  const bundle = (await saved(page)).dataset;
  await page.getByLabel('Reconciliation business date', { exact: true }).fill('2026-10-21');
  const labels = { bank_balances: 'bank balances', customer_opening_balances: 'customer opening baseline', bank_transactions: 'bank transactions', intermediary_transactions: 'intermediary transactions', intermediary_balances: 'intermediary balances' };
  for (const [id, source] of Object.entries(bundle.feeds)) {
    await openSource(page, labels[id]);
    const chooser = page.waitForEvent('filechooser');
    await page.getByLabel(`Upload ${labels[id]}`, { exact: true }).click();
    await (await chooser).setFiles({ name: `${id}.csv`, mimeType: 'text/csv', buffer: Buffer.from(source.text.replaceAll('2026-10-20', '2026-10-21')) });
    await expect.poll(async () => (await saved(page)).dataset.feeds[id]?.coverageDate).toBe('2026-10-21');
  }
  await run(page);
  await sample(page, '01 · Matching records'); await run(page); await dashboard(page);
  await expect(page.getByText('$400.00', { exact: true })).toBeVisible();
  await expect(page.getByText(/2026-10-21 · Manual records/)).toBeVisible();
  await page.getByRole('link', { name: 'View checks', exact: true }).click();
  await expect(page.getByText('Historical run · Manual CSV records', { exact: true })).toBeVisible();
  expect((await saved(page)).runs.at(-1).status).toBe('Passed');
});

test('missing records and an unrechecked delivery replacement remain unknown instead of zero', async ({ page }) => {
  await page.goto('/#/reconciliation'); await sample(page, '05 · Missing intermediary feed'); await run(page); await dashboard(page);
  await expect(page.getByText('Not assessable', { exact: true })).toBeVisible();
  await expect(page.getByText('Unknown', { exact: true })).toBeVisible();
  await expect(page.getByText('$0.00', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Demo guide', exact: true }).click();
  await page.getByRole('button', { name: 'Show a missed delivery', exact: true }).click();
  await page.getByRole('button', { name: 'Start missed-delivery demo', exact: true }).click();
  await page.getByRole('button', { name: 'Next replay event', exact: true }).click();
  await dashboard(page);
  await expect(page.getByText('Not assessable', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Restore required records/ })).toBeVisible();
});

test('mobile and tablet demo flows keep primary actions and evidence accessible', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await guideLoad(page, 'Load $400 discrepancy'); await run(page); await dashboard(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phase3-mobile-dashboard.png', fullPage: true });
  await page.getByRole('link', { name: /Review with Risk \/ Compliance/ }).click();
  await expect(page.getByRole('textbox', { name: 'Assigned owner' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1024, height: 768 });
  await dashboard(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Demo guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('missing links recover gracefully and explanations are available by keyboard', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/exceptions?case=not-in-this-workspace');
  await expect(page.getByText('Case unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#/reconciliation?mode=manual&run=not-in-this-workspace');
  await expect(page.getByText('Run unavailable', { exact: true })).toBeVisible();
  await sample(page, '01 · Matching records'); await run(page);
  await page.getByRole('button', { name: 'Explain Bank movement consistency', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Explain Aggregate balance reconciliation', exact: true })).toBeFocused();
  await expect(page.getByRole('tooltip')).toContainText('customer closing balances');
  await page.getByRole('button', { name: 'Demo guide', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Demo guide', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('changed correction evidence blocks closure until a successful fresh recheck', async ({ page }) => {
  await page.goto('/#/reconciliation'); await sample(page, '02 · $400 discrepancy'); await run(page);
  const id = (await saved(page)).cases[0].id;
  await sample(page, '03 · Corrected records'); await run(page);
  expect((await saved(page)).cases[0].verifiedClear).toBe(true);
  await sample(page, '02 · $400 discrepancy');
  await page.goto(`/#/exceptions?case=${encodeURIComponent(id)}`);
  await page.getByRole('textbox', { name: 'Assigned owner' }).click();
  await page.getByRole('option', { name: 'Alex Carter', exact: true }).click();
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Old proof cannot clear new evidence.');
  await expect(page.getByRole('button', { name: 'Resolve exception', exact: true })).toBeDisabled();
  await expect(page.getByText('Correction not yet verified', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await guideLoad(page, 'Load corrected records'); await run(page);
  await page.goto(`/#/exceptions?case=${encodeURIComponent(id)}`);
  await page.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Fresh correction verified.');
  await page.getByRole('button', { name: 'Resolve exception', exact: true }).click();
  expect((await saved(page)).cases[0].status).toBe('Resolved');
});
