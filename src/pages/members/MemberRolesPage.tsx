import { PAGE_NAMES } from '@/lib/rbac/pageNames';
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
  LoadingSpinner,
  toast,
} from '@solvera/pace-core/components';
import { ChevronLeft } from '@solvera/pace-core/icons';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { useMemberRolesData } from '@/hooks/useMemberRolesData';
import { MemberRoleDialogs, runEndRoleWithToast } from '@/components/members/MemberRoleDialogs';
import { filterRoleTypesForMembership } from '@/lib/members/memberRoleTypes';
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
  const rolesPermissions = useResourcePermissions(PAGE_NAMES.memberRoles);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogRow, setEditDialogRow] = useState<MemberRoleRow | null>(null);
  const [endDialogRow, setEndDialogRow] = useState<MemberRoleRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [editRoleId, setEditRoleId] = useState<string>('');
  const [editAppointmentTitle, setEditAppointmentTitle] = useState('');
  const [startDate, setStartDate] = useState<Date>(todayDateValue());
  const [endDate, setEndDate] = useState<Date>(todayDateValue());

  const organisationId = selectedOrganisation?.id ?? null;
  const {
    member,
    memberAccessibleInSelectedOrg,
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
    editRole,
    editRolePending,
    editRoleErrorMessage,
    resetEditRole,
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

  const isOrgMismatch =
    member != null && selectedOrganisation != null && memberAccessibleInSelectedOrg === false;
  const filteredRoleTypes = useMemo(
    () => filterRoleTypesForMembership(roleTypes, member?.membershipTypeId ?? null),
    [member?.membershipTypeId, roleTypes]
  );
  const selectedRoleIdNumber = Number.parseInt(selectedRoleId, 10);
  const hasSelectedRole = selectedRoleId.trim().length > 0 && Number.isFinite(selectedRoleIdNumber);
  const editRoleIdNumber = Number.parseInt(editRoleId, 10);
  const hasEditRole = editRoleId.trim().length > 0 && Number.isFinite(editRoleIdNumber);
  const startDateValue = toDateOnlyValue(startDate);
  const selectedRoleHasActiveDuplicate = hasSelectedRole
    && roles.some((role) => role.roleId === selectedRoleIdNumber && role.endDate == null);
  const editRoleHasActiveDuplicate =
    editDialogRow != null &&
    hasEditRole &&
    roles.some(
      (role) =>
        role.id !== editDialogRow.id &&
        role.roleId === editRoleIdNumber &&
        role.endDate == null
    );

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
      id: 'title',
      accessorKey: 'title',
      header: 'Appointment title',
      sortable: true,
      searchable: true,
      cell: ({ row }) => row.title ?? '',
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
          <section className="grid grid-flow-col auto-cols-max gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditDialogRow(row);
                setEditRoleId(String(row.roleId));
                setEditAppointmentTitle(row.title ?? '');
                resetEditRole();
              }}
            >
              Edit role
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setEndDialogRow(row)}
            >
              End role
            </Button>
          </section>
        );
      },
    },
  ], [resetEditRole, rolesPermissions.canUpdate]);

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
            <Button type="button" onClick={() => setAddDialogOpen(true)} disabled={filteredRoleTypes.length === 0}>
              Add role
            </Button>
            {filteredRoleTypes.length === 0 && (
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
              rbac={{ pageName: PAGE_NAMES.memberRoles }}
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

      <MemberRoleDialogs
        filteredRoleTypes={filteredRoleTypes}
        add={{
          open: addDialogOpen,
          onOpenChange: (open) => {
            setAddDialogOpen(open);
            if (!open) {
              setSelectedRoleId('');
              setAppointmentTitle('');
              setStartDate(todayDateValue());
              resetAddRole();
            }
          },
          selectedRoleId,
          onSelectedRoleIdChange: setSelectedRoleId,
          appointmentTitle,
          onAppointmentTitleChange: setAppointmentTitle,
          startDate,
          onStartDateChange: setStartDate,
          selectedRoleHasActiveDuplicate,
          hasSelectedRole,
          pending: addRolePending,
          onSubmit: async () => {
            if (organisationId == null || memberId == null || !hasSelectedRole || selectedRoleHasActiveDuplicate) {
              return;
            }
            await addRole({
              memberId,
              roleId: selectedRoleIdNumber,
              organisationId,
              startDate: startDateValue,
              title: appointmentTitle,
            });
            setAddDialogOpen(false);
            toast({
              title: 'Role added.',
              variant: 'success',
            });
          },
        }}
        edit={{
          row: editDialogRow,
          onRowChange: (row) => {
            setEditDialogRow(row);
            if (row == null) {
              setEditRoleId('');
              setEditAppointmentTitle('');
              resetEditRole();
            }
          },
          roleId: editRoleId,
          onRoleIdChange: setEditRoleId,
          appointmentTitle: editAppointmentTitle,
          onAppointmentTitleChange: setEditAppointmentTitle,
          hasActiveDuplicate: editRoleHasActiveDuplicate,
          hasRole: hasEditRole,
          errorMessage: editRoleErrorMessage,
          pending: editRolePending,
          onSubmit: async () => {
            if (editDialogRow == null || organisationId == null || !hasEditRole || editRoleHasActiveDuplicate) {
              return;
            }
            await editRole({
              roleEntryId: editDialogRow.id,
              organisationId,
              roleId: editRoleIdNumber,
              title: editAppointmentTitle,
            });
            setEditDialogRow(null);
            toast({
              title: 'Role updated.',
              variant: 'success',
            });
          },
        }}
        end={{
          row: endDialogRow,
          onRowChange: (row) => {
            setEndDialogRow(row);
            if (row == null) {
              setEndDate(todayDateValue());
              resetEndRole();
            }
          },
          endDate,
          onEndDateChange: setEndDate,
          endDateInvalid,
          pending: endRolePending,
          onSubmit: async () => {
            if (endDialogRow == null || organisationId == null || endDateInvalid) {
              return;
            }
            await runEndRoleWithToast(async () => {
              await endRole({
                roleEntryId: endDialogRow.id,
                organisationId,
                endDate: toDateOnlyValue(endDate),
              });
            });
            setEndDialogRow(null);
          },
        }}
      />
    </main>
  );
}

export function MemberRolesPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.memberRoles} operation="read" fallback={<AccessDenied />}>
      <MemberRolesPageContent />
    </PagePermissionGuard>
  );
}
