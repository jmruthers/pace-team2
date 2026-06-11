import { useMemo } from 'react';
import { Badge, Button, toast } from '@solvera/pace-core/components';
import type { DataTableColumn } from '@solvera/pace-core/components';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import {
  applicationStatusBadgeVariant,
  applicationStatusLabel,
  cardActiveBadgeVariant,
  contactTierBadgeVariant,
  contactTierLabel,
} from '@/lib/members/member360.display.badges';
import { formatOptionalText, formatShortDate, getDisplayName } from '@/lib/members/member360.display.format';
import type { AdditionalContactRow, MemberApplicationRow, MemberCardRow } from '@/lib/members/member360.types';

interface UseMember360TableColumnsOptions {
  canUpdateMember: boolean;
  deactivateOrReactivateCard: (args: { cardId: string; isActive: boolean }) => Promise<unknown>;
  onDeactivateCard: (row: MemberCardRow) => void;
  onViewContact: (row: AdditionalContactRow) => void;
}

export function useMember360TableColumns({
  canUpdateMember,
  deactivateOrReactivateCard,
  onDeactivateCard,
  onViewContact,
}: UseMember360TableColumnsOptions) {
  const contactColumns = useMemo<DataTableColumn<AdditionalContactRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'lastName',
        header: 'Name',
        sortable: true,
        searchable: true,
        cell: ({ row }) => getDisplayName(row.firstName, row.lastName, row.preferredName),
      },
      {
        id: 'type',
        accessorKey: 'contactTypeName',
        header: 'Type',
        sortable: true,
        searchable: true,
        cell: ({ row }) => formatOptionalText(row.contactTypeName),
      },
      {
        id: 'tier',
        accessorKey: 'permissionType',
        header: 'Tier',
        sortable: true,
        cell: ({ row }) => <Badge variant={contactTierBadgeVariant(row.permissionType)}>{contactTierLabel(row.permissionType)}</Badge>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            onClick={() => onViewContact(row)}
          >
            View details
          </Button>
        ),
      },
    ],
    [onViewContact],
  );

  const cardColumns = useMemo<DataTableColumn<MemberCardRow>[]>(
    () => [
      {
        id: 'cardIdentifier',
        accessorKey: 'cardIdentifier',
        header: 'Identifier',
        sortable: true,
      },
      {
        id: 'isActive',
        accessorKey: 'isActive',
        header: 'Active',
        sortable: true,
        cell: ({ row }) => <Badge variant={cardActiveBadgeVariant(row.isActive)}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Created at',
        sortable: true,
        cell: ({ row }) => formatShortDate(row.createdAt),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          if (!canUpdateMember) {
            return null;
          }
          if (row.isActive) {
            return (
              <Button type="button" variant="outline" onClick={() => onDeactivateCard(row)}>
                Deactivate
              </Button>
            );
          }
          return (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await deactivateOrReactivateCard({ cardId: row.id, isActive: true });
                  toast({ title: `${row.cardIdentifier} reactivated.`, variant: 'success' });
                } catch (error: unknown) {
                  toast({
                    title: HandleSupabaseError(error, 'core_member_card').message,
                    variant: 'destructive',
                  });
                }
              }}
            >
              Reactivate
            </Button>
          );
        },
      },
    ],
    [canUpdateMember, deactivateOrReactivateCard, onDeactivateCard],
  );

  const applicationColumns = useMemo<DataTableColumn<MemberApplicationRow>[]>(
    () => [
      {
        id: 'eventName',
        accessorKey: 'eventName',
        header: 'Event name',
        sortable: true,
        searchable: true,
        cell: ({ row }) => formatOptionalText(row.eventName),
      },
      {
        id: 'eventDate',
        accessorKey: 'eventDate',
        header: 'Event date',
        sortable: true,
        cell: ({ row }) => formatShortDate(row.eventDate),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        sortable: true,
        cell: ({ row }) => (
          <Badge variant={applicationStatusBadgeVariant(row.status)}>{applicationStatusLabel(row.status)}</Badge>
        ),
      },
    ],
    []
  );

  return { contactColumns, cardColumns, applicationColumns };
}
