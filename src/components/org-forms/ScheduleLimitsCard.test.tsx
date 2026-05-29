// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { setupUser } from '@test-utils';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScheduleLimitsCard } from '@/components/org-forms/ScheduleLimitsCard';

vi.mock('@solvera/pace-core/components', async (importActual) => {
  const actual = await importActual<typeof import('@solvera/pace-core/components')>();
  return {
    ...actual,
    Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
    CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    CardContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  };
});

describe('ScheduleLimitsCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders "Form submission is required for this workflow" beside the Switch (F-34)', async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <ScheduleLimitsCard
        disabled={false}
        opensAtIso={null}
        closesAtIso={null}
        onOpensAtIsoChange={() => undefined}
        onClosesAtIsoChange={() => undefined}
        scheduleLimits={{
          maxSubmissionsInput: '',
          confirmationMessage: '',
          isRequired: false,
        }}
        onScheduleLimitsChange={onChange}
      />,
    );

    expect(
      screen.getByText('Form submission is required for this workflow'),
    ).toBeTruthy();

    const switchControl = screen.getByRole('switch');
    await user.click(switchControl);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ isRequired: true }),
    );
  });
});
