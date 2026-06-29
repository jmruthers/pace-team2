// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationsLogPage } from '@/pages/communications/CommunicationsLogPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@solvera/pace-core/hooks', () => ({
  usePaceMain: () => undefined,
}));

vi.mock('@solvera/pace-core/components', async () => {
  const { buildPaceCoreComponentsMock } = await import('@/test-utils/paceCoreMocks');
  return buildPaceCoreComponentsMock(vi.fn());
});

describe('CommunicationsLogPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders send log stub and navigates back to compose', async () => {
    render(
      <MemoryRouter>
        <CommunicationsLogPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Send log' })).toBeTruthy();
    expect(screen.getByText('Send log is coming soon')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back to compose' }));
    expect(navigateMock).toHaveBeenCalledWith('/communications');
  });
});
