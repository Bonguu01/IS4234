import { test, expect } from '@playwright/test';

async function sample(page, label) {
  await page.getByRole('textbox', { name: 'Sample scenario', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Load Sample Scenario', exact: true }).click();
  await page.getByRole('button', { name: 'Run reconciliation', exact: true }).click();
}
async function queueView(page, name) {
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('textbox', { name: 'Filter status' }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

test('overdue badges, queue views and closure follow the deadline clock on desktop and mobile', async ({ page }) => {
  await page.goto('/#/reconciliation');
  await sample(page, '02 · $400 discrepancy');
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  // Financial risk can escalate cases before the deadline.
  await expect(page.getByText('Overdue', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Compared with bank transactions', { exact: true }).filter({ visible: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Demo deadline clock', exact: true }).click();
  await page.getByRole('button', { name: 'Advance 25 hours', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Overdue', { exact: true }).filter({ visible: true })).toHaveCount(3);
  await queueView(page, 'Overdue');
  await expect(page.getByRole('heading', { name: 'Exception queue (3)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(/Overdue by 1h/)).toBeVisible();
  await drawer.getByRole('textbox', { name: 'Assigned owner' }).click();
  await page.getByRole('option', { name: 'Alex Carter', exact: true }).click();
  await page.keyboard.press('Escape');
  await queueView(page, 'Unassigned');
  await expect(page.getByRole('heading', { name: 'Exception queue (2)', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search exceptions' }).fill('does not exist');
  await expect(page.getByText('No cases match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exception queue (3)', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Overdue', { exact: true }).filter({ visible: true })).toHaveCount(3);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Reconciliation', exact: true }).click();
  await sample(page, '03 · Corrected records');
  await page.getByRole('link', { name: 'Exceptions', exact: true }).click();
  await queueView(page, 'Ready to close');
  await expect(page.getByRole('heading', { name: 'Exception queue (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View EX-001', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Escalation or resolution reason' }).fill('Corrected records rechecked; documented closure.');
  await drawer.getByRole('button', { name: 'Resolve exception', exact: true }).click();
  await expect(drawer.getByText('Overdue', { exact: true })).toHaveCount(0);
  await expect(drawer.getByText('Resolved — deadline no longer active')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
  await expect(page.getByText('Overdue', { exact: true }).filter({ visible: true })).toHaveCount(2);
  await page.reload();
  await expect(page.getByText('Overdue', { exact: true }).filter({ visible: true })).toHaveCount(2);
});
