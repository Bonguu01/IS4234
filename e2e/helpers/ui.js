export async function openSource(page, label) {
  const control = page.getByRole('button', { name: new RegExp(`^${label} source controls$`, 'i') });
  if (await control.getAttribute('aria-expanded') === 'false') await control.click();
}

export async function windowAction(page, label) {
  await page.getByRole('button', { name: 'Window actions', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
