export function parseCents(value) {
  const text = String(value ?? '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error('Use a decimal amount with at most two decimal places (no separators).');
  }
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds the safe monetary range.');
  return Number(negative ? -cents : cents);
}

export function sumCents(values) {
  const sum = values.reduce((total, value) => total + BigInt(value), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Calculated total exceeds the safe monetary range.');
  }
  return Number(sum);
}

export function difference(a, b) { return sumCents([a, -b]); }

export function formatMoney(cents) {
  if (cents === null || cents === undefined) return '—';
  const value = BigInt(cents);
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}$${(absolute / 100n).toLocaleString('en-US')}.${String(absolute % 100n).padStart(2, '0')}`;
}
