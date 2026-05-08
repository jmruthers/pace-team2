import type { ReactNode } from 'react';
import { Badge, Button } from '@solvera/pace-core/components';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  formatMembershipNumber,
  formatShortDate,
  getMemberDisplayName,
} from './memberDirectory.display';
import type { MemberDirectoryRow, PendingDirectoryRow } from './memberDirectory.types';

interface MemberColumnOptions {
  pickerMode: boolean;
  onPrimaryAction: (row: MemberDirectoryRow) => void;
}

interface PendingColumnOptions {
  onPrimaryAction: (row: PendingDirectoryRow) => void;
}

function renderPrimaryActionCell<T extends MemberDirectoryRow>(
  row: T,
  content: ReactNode,
  pickerMode: boolean,
  onPrimaryAction: (member: T) => void
) {
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0"
      onClick={() => onPrimaryAction(row)}
      aria-label={pickerMode ? `Select ${getMemberDisplayName(row)}` : `Open ${getMemberDisplayName(row)}`}
    >
      {content}
    </Button>
  );
}

export function buildMemberColumns(options: MemberColumnOptions): DataTableColumn<MemberDirectoryRow>[] {
  const { pickerMode, onPrimaryAction } = options;

  return [
    {
      id: 'lastName',
      accessorKey: 'lastName',
      header: 'Name',
      sortable: true,
      cell: ({ row }) => renderPrimaryActionCell(row, getMemberDisplayName(row), pickerMode, onPrimaryAction),
    },
    {
      id: 'firstName',
      accessorKey: 'firstName',
      header: 'First name (search)',
      searchable: true,
    },
    {
      id: 'preferredName',
      accessorKey: 'preferredName',
      header: 'Preferred name (search)',
      searchable: true,
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: 'Email (search)',
      searchable: true,
    },
    {
      id: 'membershipNumber',
      accessorKey: 'membershipNumber',
      header: 'Membership #',
      sortable: true,
      cell: ({ row }) =>
        renderPrimaryActionCell(row, formatMembershipNumber(row.membershipNumber), pickerMode, onPrimaryAction),
    },
    {
      id: 'membershipStatus',
      accessorKey: 'membershipStatus',
      header: 'Membership status',
      sortable: true,
      cell: ({ row }) => (
        renderPrimaryActionCell(
          row,
          <Badge variant={row.membershipStatus === 'Active' ? 'soft-main-normal' : 'soft-sec-normal'}>
            {row.membershipStatus}
          </Badge>,
          pickerMode,
          onPrimaryAction
        )
      ),
    },
    {
      id: 'membershipTypeName',
      accessorKey: 'membershipTypeName',
      header: 'Membership type',
      sortable: true,
      cell: ({ row }) => renderPrimaryActionCell(row, row.membershipTypeName ?? '—', pickerMode, onPrimaryAction),
    },
  ];
}

export function buildPendingColumns(options: PendingColumnOptions): DataTableColumn<PendingDirectoryRow>[] {
  const { onPrimaryAction } = options;

  return [
    {
      id: 'lastName',
      accessorKey: 'lastName',
      header: 'Name',
      sortable: true,
      cell: ({ row }) => renderPrimaryActionCell(row, getMemberDisplayName(row), false, onPrimaryAction),
    },
    {
      id: 'firstName',
      accessorKey: 'firstName',
      header: 'First name (search)',
      searchable: true,
    },
    {
      id: 'preferredName',
      accessorKey: 'preferredName',
      header: 'Preferred name (search)',
      searchable: true,
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: 'Email (search)',
      searchable: true,
    },
    {
      id: 'membershipNumber',
      accessorKey: 'membershipNumber',
      header: 'Membership #',
      sortable: true,
      cell: ({ row }) => renderPrimaryActionCell(row, formatMembershipNumber(row.membershipNumber), false, onPrimaryAction),
    },
    {
      id: 'membershipTypeName',
      accessorKey: 'membershipTypeName',
      header: 'Membership type',
      sortable: true,
      cell: ({ row }) => renderPrimaryActionCell(row, row.membershipTypeName ?? '—', false, onPrimaryAction),
    },
    {
      id: 'requestedAt',
      accessorKey: 'requestedAt',
      header: 'Requested',
      sortable: true,
      cell: ({ row }) => renderPrimaryActionCell(row, formatShortDate(row.requestedAt), false, onPrimaryAction),
    },
    {
      id: 'requestType',
      accessorKey: 'requestType',
      header: 'Request type',
      sortable: true,
      cell: ({ row }) => (
        renderPrimaryActionCell(
          row,
          <Badge variant="outline-main-normal">
            {row.requestType === 'join' ? 'Join' : 'Transfer'}
          </Badge>,
          false,
          onPrimaryAction
        )
      ),
    },
  ];
}
