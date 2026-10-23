import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import App from '../App';
import { AppStateProvider } from '../state/AppState';
import { STORAGE_KEY } from '../state/storage';

function renderApp() {
  window.location.hash = '#/reconciliation';
  return render(<MantineProvider><AppStateProvider><App /></AppStateProvider></MantineProvider>);
}

describe('connected reconciliation screen', () => {
  it('loads all five sources, runs real checks and persists results', async () => {
    const user = userEvent.setup(); renderApp();
    await user.click(screen.getByRole('button', { name: 'Load Sample Scenario' }));
    expect(screen.getAllByText('Ready')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Run reconciliation' }));
    await waitFor(() => expect(screen.getAllByText('Passed').length).toBeGreaterThan(1));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.runs[0].status).toBe('Passed');
    expect(Object.values(saved.dataset.feeds).every(Boolean)).toBe(true);
    expect(saved.cases).toEqual([]);
  });
  it('shows Blocked for absent evidence rather than a successful result', async () => {
    const user = userEvent.setup(); renderApp();
    await user.click(screen.getByRole('button', { name: 'Run reconciliation' }));
    await waitFor(() => expect(screen.getAllByText('Blocked').length).toBeGreaterThan(1));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.runs[0].status).toBe('Blocked');
    expect(saved.cases).toHaveLength(5);
    expect(saved.cases.every((item) => item.escalatedAt)).toBe(true);
  });
});
