import { Badge, Button } from '@solvera/pace-core/components';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  formatMembershipNumber,
  formatShortDate,
  getMemberDisplayName,
  type MemberDirectoryRow,
  type PendingDirectoryRow,
} from './memberDirectory.data';

interface MemberColumnOptions {
  pickerMode: boolean;
  onPrimaryAction: (row: MemberDirectoryRow) => void;
}

interface PendingColumnOptions {
  onPrimaryAction: (row: PendingDirectoryRow) => void;
}

function renderPrimaryActionCell<T extends MemberDirectoryRow>(
  row: T,
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
      {getMemberDisplayName(row)}
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
      cell: ({ row }) => renderPrimaryActionCell(row, pickerMode, onPrimaryAction),
    },
    {
      id: 'membershipNumber',
      accessorKey: 'membershipNumber',
      header: 'Membership #',
      sortable: true,
      cell: ({ row }) => formatMembershipNumber(row.membershipNumber),
    },
    {
      id: 'membershipStatus',
      accessorKey: 'membershipStatus',
      header: 'Membership status',
      sortable: true,
      cell: ({ row }) => (
        <Badge variant={row.membershipStatus === 'Active' ? 'soft-main-normal' : 'soft-sec-normal'}>
          {row.membershipStatus}
        </Badge>
      ),
    },
    {
      id: 'membershipTypeName',
      accessorKey: 'membershipTypeName',
      header: 'Membership type',
      sortable: true,
      cell: ({ row }) => row.membershipTypeName ?? '—',
      enableColumnFilter: true,
      filterType: 'select',
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
      cell: ({ row }) => renderPrimaryActionCell(row, false, onPrimaryAction),
    },
    {
      id: 'membershipNumber',
      accessorKey: 'membershipNumber',
      header: 'Membership #',
      sortable: true,
      cell: ({ row }) => formatMembershipNumber(row.membershipNumber),
    },
    {
      id: 'membershipTypeName',
      accessorKey: 'membershipTypeName',
      header: 'Membership type',
      sortable: true,
      cell: ({ row }) => row.membershipTypeName ?? '—',
    },
    {
      id: 'requestedAt',
      accessorKey: 'requestedAt',
      header: 'Requested',
      sortable: true,
      cell: ({ row }) => formatShortDate(row.requestedAt),
    },
    {
      id: 'requestType',
      accessorKey: 'requestType',
      header: 'Request type',
      sortable: true,
      cell: ({ row }) => (
        <Badge variant="outline-main-normal">
          {row.requestType === 'join' ? 'Join' : 'Transfer'}
        </Badge>
      ),
    },
  ];
}
