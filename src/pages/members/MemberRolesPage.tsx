import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  DatePickerWithTimezone,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Label,
  LoadingSpinner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@solvera/pace-core/components';
import { ChevronLeft } from '@solvera/pace-core/icons';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { useMemberRolesData } from '@/hooks/useMemberRolesData';
import {
  formatRoleDate,
  getMemberRolesDisplayName,
  getRoleStatusLabel,
  getRoleStatusVariant,
  toDateOnlyValue,
} from '@/lib/members/memberRoles.display';
import type { MemberRoleRow } from '@/lib/members/memberRoles.types';

function todayDateValue(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function parseDateValue(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00Z`);
}

function MemberRolesNotFoundState() {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-[50vh] place-items-center">
      <section className="grid gap-3 justify-items-center">
        <h1>Member not found</h1>
        <p>We couldn&apos;t find this member in your current organisation.</p>
        <Button type="button" variant="outline" onClick={() => navigate('/members')}>
          <ChevronLeft size={16} aria-hidden />
          Back to members
        </Button>
      </section>
    </main>
  );
}

function MemberRolesErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>Could not load member</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <nav aria-label="Retry member">
        <Button type="button" onClick={onRetry}>
          Retry
        </Button>
      </nav>
    </main>
  );
}

function MemberRolesPageContent() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { selectedOrganisation } = useOrganisationsContext();
  const rolesPermissions = useResourcePermissions('member-roles');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [endDialogRow, setEndDialogRow] = useState<MemberRoleRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(todayDateValue());
  const [endDate, setEndDate] = useState<Date>(todayDateValue());

  const organisationId = selectedOrganisation?.id ?? null;
  const {
    member,
    memberLoading,
    memberErrorMessage,
    refetchMember,
    roles,
    rolesLoading,
    rolesErrorMessage,
    refetchRoles,
    roleTypes,
    addRole,
    addRolePending,
    addRoleError,
    resetAddRole,
    endRole,
    endRolePending,
    resetEndRole,
  } = useMemberRolesData({
    memberId,
    organisationId,
  });

  const memberName = member == null ? 'Standing roles' : getMemberRolesDisplayName(member);
  usePaceMain({
    printTitle: member == null ? 'Standing roles' : `${memberName} — Standing roles`,
  });

  useEffect(() => {
    if (addRoleError == null) {
      return;
    }
    const description = addRoleError.isActiveDuplicate
      ? 'This member already has an active role of this type. Refresh the list and try again.'
      : addRoleError.message;
    toast({
      title: 'Could not add role',
      description,
      variant: 'destructive',
    });
  }, [addRoleError]);

  const isOrgMismatch = member != null && selectedOrganisation != null && member.organisationId !== selectedOrganisation.id;
  const selectedRoleIdNumber = Number.parseInt(selectedRoleId, 10);
  const hasSelectedRole = selectedRoleId.trim().length > 0 && Number.isFinite(selectedRoleIdNumber);
  const startDateValue = toDateOnlyValue(startDate);
  const selectedRoleHasActiveDuplicate = hasSelectedRole
    && roles.some((role) => role.roleId === selectedRoleIdNumber && role.endDate == null);

  const endDateInvalid = endDialogRow != null && endDate < parseDateValue(endDialogRow.startDate);

  const roleColumns = useMemo<DataTableColumn<MemberRoleRow>[]>(() => [
    {
      id: 'roleName',
      accessorKey: 'roleName',
      header: 'Role',
      sortable: true,
      searchable: true,
      cell: ({ row }) => row.roleName ?? '—',
    },
    {
      id: 'startDate',
      accessorKey: 'startDate',
      header: 'Start date',
      sortable: true,
      cell: ({ row }) => formatRoleDate(row.startDate),
    },
    {
      id: 'endDate',
      accessorKey: 'endDate',
      header: 'End date',
      sortable: true,
      cell: ({ row }) => formatRoleDate(row.endDate),
    },
    {
      id: 'status',
      accessorKey: 'endDate',
      header: 'Status',
      sortable: true,
      cell: ({ row }) => (
        <Badge variant={getRoleStatusVariant(row)}>
          {getRoleStatusLabel(row)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        if (!rolesPermissions.canUpdate || row.endDate != null) {
          return null;
        }
        return (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setEndDialogRow(row)}
          >
            End role
          </Button>
        );
      },
    },
  ], [rolesPermissions.canUpdate]);

  const roleTableFeatures = useMemo(() => ({
    import: false,
    export: false,
    hierarchical: false,
    grouping: false,
    creation: false,
    editing: false,
    deletion: false,
    deleteSelected: false,
    selection: false,
    search: true,
    pagination: true,
    sorting: true,
    filtering: true,
    columnVisibility: true,
    columnReordering: true,
  }), []);

  if (memberLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <LoadingSpinner label="Loading member" />
      </main>
    );
  }

  if (memberErrorMessage != null) {
    return (
      <MemberRolesErrorState
        message={memberErrorMessage}
        onRetry={() => {
          void refetchMember();
        }}
      />
    );
  }

  if (member == null) {
    return <MemberRolesNotFoundState />;
  }

  if (isOrgMismatch) {
    return (
      <main className="grid gap-3">
        <Alert variant="destructive">
          <AlertTitle>This member is not in the current organisation</AlertTitle>
          <AlertDescription>Switch back, or return to the members directory.</AlertDescription>
        </Alert>
        <nav aria-label="Back to members">
          <Button type="button" variant="outline" onClick={() => navigate('/members')}>
            Back to members
          </Button>
        </nav>
      </main>
    );
  }

  return (
    <main className="grid gap-4 pb-8">
      <header className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-start">
        <nav aria-label="Back to Member 360">
          <Button type="button" variant="outline" onClick={() => navigate(`/members/${member.id}`)}>
            <ChevronLeft size={16} aria-hidden />
            Back to Member 360
          </Button>
        </nav>
        <h1>{memberName} — Standing roles</h1>
        {rolesPermissions.canUpdate ? (
          <section className="grid justify-items-start md:justify-items-end">
            <Button type="button" onClick={() => setAddDialogOpen(true)} disabled={roleTypes.length === 0}>
              Add role
            </Button>
            {roleTypes.length === 0 && (
              <p>No role types configured for this organisation. Contact your administrator.</p>
            )}
          </section>
        ) : null}
      </header>

      <Card>
        <CardContent className="grid gap-3">
          {rolesErrorMessage != null ? (
            <section className="grid gap-3">
              <Alert variant="destructive">
                <AlertTitle>Could not load roles</AlertTitle>
                <AlertDescription>{rolesErrorMessage}</AlertDescription>
              </Alert>
              <nav aria-label="Retry roles">
                <Button type="button" onClick={() => void refetchRoles()}>
                  Retry
                </Button>
              </nav>
            </section>
          ) : (
            <DataTable<MemberRoleRow>
              data={roles}
              columns={roleColumns}
              rbac={{ pageName: 'member-roles' }}
              description={`${roles.length} roles`}
              isLoading={rolesLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'startDate', desc: true }]}
              emptyState={{
                title: 'No roles recorded for this member yet.',
                description: 'Use Add role to record this member\'s first standing role.',
              }}
              features={roleTableFeatures}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setSelectedRoleId('');
            setStartDate(todayDateValue());
            resetAddRole();
          }
        }}
      >
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add role</DialogTitle>
              <DialogDescription>Record a new standing role for this member.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <section className="grid gap-3">
                <Label htmlFor="add-role-role-type">
                  Role type
                  <Select value={selectedRoleId} onValueChange={(value) => setSelectedRoleId(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleTypes.map((roleType) => (
                        <SelectItem key={roleType.id} value={String(roleType.id)}>
                          {roleType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                {selectedRoleHasActiveDuplicate && (
                  <p>This member already has an active role of this type.</p>
                )}
                <Label htmlFor="add-role-start-date">
                  Start date
                  <DatePickerWithTimezone
                    value={startDate}
                    onChange={(nextDate) => setStartDate(nextDate)}
                  />
                </Label>
              </section>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (organisationId == null || memberId == null || !hasSelectedRole || selectedRoleHasActiveDuplicate) {
                    return;
                  }
                  await addRole({
                    memberId,
                    roleId: selectedRoleIdNumber,
                    organisationId,
                    startDate: startDateValue,
                  });
                  setAddDialogOpen(false);
                  toast({
                    title: 'Role added.',
                    variant: 'success',
                  });
                }}
                disabled={!hasSelectedRole || selectedRoleHasActiveDuplicate || addRolePending}
              >
                {addRolePending ? <LoadingSpinner /> : null}
                Add role
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog
        open={endDialogRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setEndDialogRow(null);
            setEndDate(todayDateValue());
            resetEndRole();
          }
        }}
      >
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End role?</DialogTitle>
              <DialogDescription>
                {(endDialogRow?.roleName ?? '—')} will be marked ended on {formatRoleDate(toDateOnlyValue(endDate))}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <section className="grid gap-3">
                <Label htmlFor="end-role-date">
                  End date
                  <DatePickerWithTimezone
                    value={endDate}
                    onChange={(nextDate) => setEndDate(nextDate)}
                  />
                </Label>
                <p>You can&apos;t reverse this from this page.</p>
                {endDateInvalid && <p>End date must be on or after start date.</p>}
              </section>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEndDialogRow(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (endDialogRow == null || organisationId == null || endDateInvalid) {
                    return;
                  }
                  try {
                    await endRole({
                      roleEntryId: endDialogRow.id,
                      organisationId,
                      endDate: toDateOnlyValue(endDate),
                    });
                    toast({
                      title: 'Role ended.',
                      variant: 'success',
                    });
                  } catch (error: unknown) {
                    toast({
                      title: 'Could not end role',
                      description: HandleSupabaseError(error, 'core_member_role').message,
                      variant: 'destructive',
                    });
                  } finally {
                    setEndDialogRow(null);
                  }
                }}
                disabled={endDateInvalid || endRolePending}
              >
                {endRolePending ? <LoadingSpinner /> : null}
                End role
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </main>
  );
}

export function MemberRolesPage() {
  return (
    <PagePermissionGuard pageName="member-roles" operation="read" fallback={<AccessDenied />}>
      <MemberRolesPageContent />
    </PagePermissionGuard>
  );
}
