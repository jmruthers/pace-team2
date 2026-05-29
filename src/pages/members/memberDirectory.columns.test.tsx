// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { setupUser } from '@test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMemberColumns } from '@/lib/members/memberDirectory.columns';
import type { MemberDirectoryRow } from '@/lib/members/memberDirectory.types';

const baseRow: MemberDirectoryRow = {
  id: 'member-1',
  personId: 'person-1',
  membershipNumber: 'A001',
  membershipStatus: 'Active',
  membershipTypeId: 1,
  membershipTypeName: 'Adult',
  organisationId: 'org-1',
  firstName: 'Ava',
  lastName: 'Adams',
  preferredName: null,
  email: 'ava@example.com',
};

describe('memberDirectory.columns', () => {
  beforeEach(() => {
    cleanup();
  });

  it('invokes primary action from the Name cell in normal mode', async () => {
    const user = setupUser();
    const onPrimaryAction = vi.fn();
    const columns = buildMemberColumns({
      pickerMode: false,
      onPrimaryAction,
    });

    const nameColumn = columns.find((column) => column.id === 'lastName');
    if (nameColumn?.cell == null) {
      throw new Error('Expected Name column cell renderer');
    }

    render(<>{nameColumn.cell({ row: baseRow, getValue: () => baseRow.lastName, index: 0 })}</>);

    await user.click(screen.getByRole('button', { name: 'Open Ava Adams' }));

    expect(onPrimaryAction).toHaveBeenCalledWith(baseRow);
  });

  it('invokes primary action from the Name cell in picker mode', async () => {
    const user = setupUser();
    const onPrimaryAction = vi.fn();
    const columns = buildMemberColumns({
      pickerMode: true,
      onPrimaryAction,
    });

    const nameColumn = columns.find((column) => column.id === 'lastName');
    if (nameColumn?.cell == null) {
      throw new Error('Expected Name column cell renderer');
    }

    render(<>{nameColumn.cell({ row: baseRow, getValue: () => baseRow.lastName, index: 0 })}</>);

    await user.click(screen.getByRole('button', { name: 'Select Ava Adams' }));

    expect(onPrimaryAction).toHaveBeenCalledWith(baseRow);
  });

  it('invokes primary action from non-name cells for row-click parity', async () => {
    const user = setupUser();
    const onPrimaryAction = vi.fn();
    const columns = buildMemberColumns({
      pickerMode: false,
      onPrimaryAction,
    });

    const numberColumn = columns.find((column) => column.id === 'membershipNumber');
    if (numberColumn?.cell == null) {
      throw new Error('Expected Membership # column cell renderer');
    }

    render(<>{numberColumn.cell({ row: baseRow, getValue: () => baseRow.membershipNumber, index: 0 })}</>);

    await user.click(screen.getByRole('button', { name: 'Open Ava Adams' }));

    expect(onPrimaryAction).toHaveBeenCalledWith(baseRow);
  });

  it('includes BR-05 searchable fields including last name and membership number', () => {
    const columns = buildMemberColumns({
      pickerMode: false,
      onPrimaryAction: vi.fn(),
    });

    const searchableIds = columns.filter((column) => column.searchable === true).map((column) => column.id);
    expect(searchableIds).toEqual(
      expect.arrayContaining(['lastName', 'firstName', 'preferredName', 'email', 'membershipNumber'])
    );

    const membershipTypeColumn = columns.find((column) => column.id === 'membershipTypeName');
    expect(membershipTypeColumn?.enableColumnFilter).not.toBe(true);
  });
});
