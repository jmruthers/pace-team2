import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataTable,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { buildMemberColumns, buildPendingColumns } from '@/lib/members/memberDirectory.columns';
import {
  buildManualPickPayload,
  getManualPickStorageKey,
  getPickerBannerState,
  readManualPickPayload,
  selectionRecordToIds,
  toSelectionRecord,
} from '@/lib/members/memberDirectory.picker';
import type { MemberDirectoryRow, PendingDirectoryRow } from '@/lib/members/memberDirectory.types';
import { useMemberDirectoryData } from '@/hooks/useMemberDirectoryData';

type MembersView = 'members' | 'pending';

function MemberDirectoryPageContent() {
  usePaceMain({ printTitle: 'Members' });

  const navigate = useNavigate();
  const location = useLocation();
  const { selectedOrganisation } = useOrganisationsContext();
  const [activeView, setActiveView] = useState<MembersView>('members');
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const previousOrgId = useRef<string | null>(null);

  const pickerMode = location.state != null && typeof location.state === 'object'
    && 'intent' in location.state && (location.state as { intent?: unknown }).intent === 'commsManualPick';

  const organisationId = selectedOrganisation?.id ?? null;
  const storageKey = getManualPickStorageKey();

  const {
    memberTypes,
    members,
    pendingMembers,
    membersLoading,
    pendingLoading,
    membersErrorMessage,
    pendingErrorMessage,
    refetchMembers,
    refetchPending,
  } = useMemberDirectoryData(organisationId, membershipTypeFilter);

  useEffect(() => {
    if (!pickerMode || organisationId == null) {
      previousOrgId.current = organisationId;
      return;
    }

    if (previousOrgId.current === null) {
      const persistedSelection = readManualPickPayload(window.sessionStorage.getItem(storageKey), organisationId);
      setSelectedIds(persistedSelection);
      previousOrgId.current = organisationId;
      return;
    }

    if (previousOrgId.current !== organisationId) {
      previousOrgId.current = organisationId;
      setSelectedIds([]);
      toast({
        title: 'Selection cleared — organisation changed.',
        variant: 'default',
      });
    }
  }, [organisationId, pickerMode, storageKey]);

  const pickerBannerState = getPickerBannerState(selectedIds.length);
  const tabsValue: MembersView = pickerMode ? 'members' : activeView;

  const memberColumns = useMemo(
    () =>
      buildMemberColumns({
        pickerMode,
        onPrimaryAction: (row: MemberDirectoryRow) => {
          if (pickerMode) {
            setSelectedIds((previous) =>
              previous.includes(row.id) ? previous.filter((memberId) => memberId !== row.id) : [...previous, row.id]
            );
            return;
          }
          navigate(`/members/${row.id}`);
        },
      }),
    [navigate, pickerMode]
  );

  const pendingColumns = useMemo(
    () =>
      buildPendingColumns({
        onPrimaryAction: (row: PendingDirectoryRow) => {
          navigate(`/members/${row.id}`);
        },
      }),
    [navigate]
  );

  const onDone = () => {
    if (organisationId == null || !pickerBannerState.doneEnabled) {
      return;
    }

    const payload = buildManualPickPayload(organisationId, selectedIds);
    window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    navigate('/communications');
  };

  const onCancel = () => {
    navigate('/communications');
  };

  return (
    <main className="grid gap-4 pb-28">
      <h1>Members</h1>
      {pickerMode && (
        <section className="sticky top-0 z-10">
          <Alert variant={pickerBannerState.variant}>
            <AlertTitle>{pickerBannerState.title}</AlertTitle>
            <AlertDescription>{pickerBannerState.description}</AlertDescription>
          </Alert>
        </section>
      )}
      <Tabs value={tabsValue} onValueChange={(nextValue) => setActiveView(nextValue as MembersView)}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {!pickerMode && <TabsTrigger value="pending">Pending</TabsTrigger>}
        </TabsList>
        <TabsContent value="members">
          <section className="mb-3">
            <Label htmlFor="membership-type-filter">
              Membership type
              <Select
                value={membershipTypeFilter == null ? 'all' : String(membershipTypeFilter)}
                onValueChange={(nextValue) => setMembershipTypeFilter(nextValue === 'all' ? null : Number(nextValue))}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {memberTypes.map((memberType) => (
                    <SelectItem key={memberType.id} value={String(memberType.id)}>
                      {memberType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </section>
          {membersErrorMessage != null ? (
            <section className="grid gap-3">
              <Alert variant="destructive">
                <AlertTitle>Could not load members</AlertTitle>
                <AlertDescription>{membersErrorMessage}</AlertDescription>
              </Alert>
              <nav aria-label="Members retry">
                <Button type="button" onClick={() => void refetchMembers()}>
                  Retry
                </Button>
              </nav>
            </section>
          ) : (
            <DataTable<MemberDirectoryRow>
              data={members}
              columns={memberColumns}
              rbac={{ pageName: PAGE_NAMES.members }}
              description={`${members.length} members`}
              isLoading={membersLoading}
              getRowId={(row) => row.id}
              columnVisibility={{
                firstName: false,
                preferredName: false,
                email: false,
              }}
              initialPageSize={25}
              initialSorting={[
                { id: 'lastName', desc: false },
                { id: 'firstName', desc: false },
              ]}
              emptyState={{
                title: 'No active or suspended members yet.',
                description: 'New members appear here once approved via /approvals.',
              }}
              features={{
                import: false,
                export: false,
                hierarchical: false,
                grouping: false,
                creation: false,
                editing: false,
                deletion: false,
                deleteSelected: false,
                selection: pickerMode,
                filtering: true,
                search: true,
                sorting: true,
                pagination: true,
                columnVisibility: true,
                columnReordering: true,
              }}
              selection={pickerMode ? toSelectionRecord(selectedIds) : undefined}
              onRowSelectionChange={pickerMode ? (selection) => setSelectedIds(selectionRecordToIds(selection)) : undefined}
            />
          )}
        </TabsContent>
        {!pickerMode && (
          <TabsContent value="pending">
            {pendingErrorMessage != null ? (
              <section className="grid gap-3">
                <Alert variant="destructive">
                  <AlertTitle>Could not load pending members</AlertTitle>
                  <AlertDescription>{pendingErrorMessage}</AlertDescription>
                </Alert>
                <nav aria-label="Pending retry">
                  <Button type="button" onClick={() => void refetchPending()}>
                    Retry
                  </Button>
                </nav>
              </section>
            ) : (
              <DataTable<PendingDirectoryRow>
                data={pendingMembers}
                columns={pendingColumns}
                rbac={{ pageName: PAGE_NAMES.members }}
                description={`${pendingMembers.length} pending members`}
                isLoading={pendingLoading}
                getRowId={(row) => row.id}
                columnVisibility={{
                  firstName: false,
                  preferredName: false,
                  email: false,
                }}
                initialPageSize={25}
                initialSorting={[
                  { id: 'lastName', desc: false },
                  { id: 'firstName', desc: false },
                ]}
                emptyState={{
                  title: 'No pending members.',
                  description: 'New join requests appear here once submitted via your org signup form.',
                }}
                features={{
                  import: false,
                  export: false,
                  hierarchical: false,
                  grouping: false,
                  creation: false,
                  editing: false,
                  deletion: false,
                  deleteSelected: false,
                  selection: false,
                  filtering: true,
                  search: true,
                  sorting: true,
                  pagination: true,
                  columnVisibility: true,
                  columnReordering: true,
                }}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
      {pickerMode && (
        <footer className="sticky bottom-0 border bg-background">
          <section className="grid grid-cols-[1fr_auto] items-center gap-3 p-3">
            <p>{selectedIds.length} selected</p>
            <nav aria-label="Picker actions" className="grid grid-flow-col auto-cols-max items-center gap-2 justify-end">
              {pickerBannerState.showEmptyHelper && <p>Select at least one member.</p>}
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={onDone} disabled={!pickerBannerState.doneEnabled}>
                Done
              </Button>
            </nav>
          </section>
        </footer>
      )}
    </main>
  );
}

export function MemberDirectoryPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.members} operation="read" fallback={<AccessDenied />}>
      <MemberDirectoryPageContent />
    </PagePermissionGuard>
  );
}
