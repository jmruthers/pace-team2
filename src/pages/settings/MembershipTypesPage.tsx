import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ConfirmationDialog,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Form,
  FormField,
  Input,
  Label,
  SaveActions,
  Switch,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { useMembershipTypesData } from '@/hooks/useMembershipTypesData';
import type {
  MembershipTypeFormValues,
  MembershipTypeMutationError,
  MembershipTypeRow,
} from '@/lib/settings/membershipTypes.types';
import { membershipTypeSchema, toMutationInput } from '@/lib/settings/membershipTypes.validation';

interface MembershipTypeEditorState {
  mode: 'create' | 'edit';
  row: MembershipTypeRow | null;
}

function toFormValues(row: MembershipTypeRow | null): MembershipTypeFormValues {
  if (row == null) {
    return {
      name: '',
      minAge: '',
      maxAge: '',
      isActive: true,
    };
  }

  return {
    name: row.name,
    minAge: row.minAge == null ? '' : String(row.minAge),
    maxAge: row.maxAge == null ? '' : String(row.maxAge),
    isActive: row.isActive,
  };
}

function MembershipTypesPageContent() {
  usePaceMain({ printTitle: 'Membership types', ariaLabel: 'Membership types' });

  const { selectedOrganisation } = useOrganisationsContext();
  const permissions = useResourcePermissions('membership-types');
  const organisationId = selectedOrganisation?.id ?? null;

  const {
    membershipTypes,
    isLoading,
    loadErrorMessage,
    refetchMembershipTypes,
    createMembershipType,
    updateMembershipType,
    setMembershipTypeActive,
    createPending,
    updatePending,
    setActivePending,
  } = useMembershipTypesData(organisationId);

  const [editorState, setEditorState] = useState<MembershipTypeEditorState | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<MembershipTypeRow | null>(null);
  const [duplicateNameError, setDuplicateNameError] = useState<string | null>(null);
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);

  const openEditor = (mode: 'create' | 'edit', row: MembershipTypeRow | null) => {
    setDuplicateNameError(null);
    setEditorState({ mode, row });
  };

  const closeEditor = () => {
    setDuplicateNameError(null);
    setEditorState(null);
  };

  useEffect(() => {
    const nextOrganisationId = selectedOrganisation?.id ?? null;
    if (previousOrganisationIdRef.current === undefined) {
      previousOrganisationIdRef.current = nextOrganisationId;
      return;
    }
    if (previousOrganisationIdRef.current === nextOrganisationId) {
      return;
    }

    previousOrganisationIdRef.current = nextOrganisationId;
    const hadOpenDialog = editorState != null || deactivateTarget != null;
    if (!hadOpenDialog) {
      return;
    }

    queueMicrotask(() => {
      setEditorState(null);
      setDeactivateTarget(null);
      setDuplicateNameError(null);
      toast({
        title: 'Editing cancelled — organisation changed.',
        variant: 'default',
      });
    });
  }, [deactivateTarget, editorState, selectedOrganisation?.id]);

  const tableRows = useMemo(
    () =>
      membershipTypes.map((row) => ({
        ...row,
        minAgeLabel: row.minAge == null ? '—' : String(row.minAge),
        maxAgeLabel: row.maxAge == null ? '—' : String(row.maxAge),
        activeLabel: row.isActive ? 'Active' : 'Inactive',
      })),
    [membershipTypes]
  );

  const columns = useMemo<DataTableColumn<(MembershipTypeRow & {
    minAgeLabel: string;
    maxAgeLabel: string;
    activeLabel: string;
  })>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        sortable: true,
        searchable: true,
      },
      {
        id: 'minAge',
        accessorKey: 'minAgeLabel',
        header: 'Min age',
        sortable: true,
        searchable: true,
      },
      {
        id: 'maxAge',
        accessorKey: 'maxAgeLabel',
        header: 'Max age',
        sortable: true,
        searchable: true,
      },
      {
        id: 'active',
        accessorKey: 'activeLabel',
        header: 'Active',
        sortable: true,
        searchable: true,
        enableColumnFilter: true,
        filterType: 'select',
        filterSelectOptions: [
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' },
        ],
        cell: ({ row }) => (
          <Badge variant={row.isActive ? 'soft-main-normal' : 'soft-sec-normal'}>
            {row.activeLabel}
          </Badge>
        ),
      },
      {
        id: 'members',
        accessorKey: 'membersCount',
        header: 'Members',
        sortable: true,
        searchable: true,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          if (!permissions.canUpdate) {
            return null;
          }
          if (row.isActive) {
            return (
              <section className="grid">
                <Button type="button" variant="outline" onClick={() => openEditor('edit', row)}>
                  Edit
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDeactivateTarget(row)}>
                  Deactivate
                </Button>
              </section>
            );
          }
          return (
            <section className="grid">
              <Button type="button" variant="outline" onClick={() => openEditor('edit', row)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await setMembershipTypeActive({ id: row.id, isActive: true });
                    toast({
                      title: `${row.name} reactivated.`,
                      variant: 'success',
                    });
                  } catch (error: unknown) {
                    toast({
                      title: HandleSupabaseError(error, 'core_membership_type').message,
                      variant: 'destructive',
                    });
                  }
                }}
                disabled={setActivePending}
              >
                Reactivate
              </Button>
            </section>
          );
        },
      },
    ],
    [permissions.canUpdate, setActivePending, setMembershipTypeActive]
  );

  const editorInitialValues = toFormValues(editorState?.row ?? null);
  const savePending = createPending || updatePending;

  return (
    <main className="grid gap-4">
      <section className="grid gap-3">
        <h1>Membership types</h1>
      </section>

      {loadErrorMessage != null ? (
        <section className="grid gap-3">
          <Alert variant="destructive">
            <AlertTitle>Could not load membership types</AlertTitle>
            <AlertDescription>{loadErrorMessage}</AlertDescription>
          </Alert>
          <nav aria-label="Retry membership types">
            <Button type="button" onClick={() => void refetchMembershipTypes()}>
              Retry
            </Button>
          </nav>
        </section>
      ) : (
        <DataTable
          data={tableRows}
          columns={columns}
          rbac={{ pageName: 'membership-types' }}
          isLoading={isLoading}
          getRowId={(row) => String(row.id)}
          initialPageSize={25}
          initialSorting={[{ id: 'name', desc: false }]}
          emptyState={{
            title: 'No membership types yet.',
            description: 'Create your first to start assigning members.',
          }}
          onCreateRow={async () => {
            openEditor('create', null);
          }}
          features={{
            import: false,
            export: false,
            hierarchical: false,
            grouping: false,
            deletion: false,
            deleteSelected: false,
            selection: false,
            search: true,
            pagination: true,
            sorting: true,
            filtering: true,
            creation: permissions.canCreate,
            editing: false,
            columnVisibility: true,
            columnReordering: true,
          }}
        />
      )}

      <Dialog
        open={editorState != null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editorState?.mode === 'edit' ? 'Edit membership type' : 'Create membership type'}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Form<MembershipTypeFormValues>
                schema={membershipTypeSchema}
                defaultValues={editorInitialValues}
                onSubmit={async (values) => {
                  setDuplicateNameError(null);
                  const payload = toMutationInput(values);
                  try {
                    if (editorState?.mode === 'edit' && editorState.row != null) {
                      await updateMembershipType({ id: editorState.row.id, input: payload });
                      toast({
                        title: 'Membership type updated.',
                        variant: 'success',
                      });
                    } else {
                      await createMembershipType(payload);
                      toast({
                        title: 'Membership type created.',
                        variant: 'success',
                      });
                    }
                    closeEditor();
                  } catch (error: unknown) {
                    const mutationError = error as MembershipTypeMutationError;
                    if (mutationError?.code === '23505') {
                      setDuplicateNameError('A membership type with this name already exists in this organisation.');
                      return;
                    }
                    toast({
                      title: HandleSupabaseError(error, 'core_membership_type').message,
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {(methods) => (
                  <section className="grid gap-3">
                    <FormField<MembershipTypeFormValues>
                      name="name"
                      label="Name"
                      required
                      render={({ field }) => (
                        <Input
                          type="text"
                          value={String(field.value ?? '')}
                          placeholder="e.g. Junior"
                          onChange={(value) => {
                            setDuplicateNameError(null);
                            field.onChange(value);
                          }}
                        />
                      )}
                    />
                    {duplicateNameError != null && <p role="alert">{duplicateNameError}</p>}
                    <FormField<MembershipTypeFormValues>
                      name="minAge"
                      label="Minimum age"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={String(field.value ?? '')}
                          onChange={(value) => field.onChange(value)}
                        />
                      )}
                    />
                    <p>Optional. Leave blank for no lower bound.</p>
                    <FormField<MembershipTypeFormValues>
                      name="maxAge"
                      label="Maximum age"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={String(field.value ?? '')}
                          onChange={(value) => field.onChange(value)}
                        />
                      )}
                    />
                    <p>Optional. Leave blank for no upper bound.</p>
                    <Label htmlFor="membership-type-active" className="grid gap-1">
                      Active
                      <Switch
                        id="membership-type-active"
                        checked={methods.watch('isActive')}
                        onChange={(checked) => methods.setValue('isActive', checked, { shouldDirty: true })}
                      />
                    </Label>
                    <p>Inactive types cannot be assigned to new members.</p>
                    <SaveActions
                      onCancel={() => {
                        closeEditor();
                      }}
                      saveType="submit"
                      saveDisabled={savePending || methods.formState.isSubmitting}
                    />
                  </section>
                )}
              </Form>
            </DialogBody>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <ConfirmationDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null);
          }
        }}
        title="Deactivate membership type?"
        description={
          deactivateTarget == null
            ? ''
            : `Members already assigned to '${deactivateTarget.name}' will stay assigned, but this type cannot be selected for new assignments. You can reactivate later.`
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={setActivePending}
        onConfirm={async () => {
          if (deactivateTarget == null) {
            return;
          }
          const target = deactivateTarget;
          setDeactivateTarget(null);
          try {
            await setMembershipTypeActive({ id: target.id, isActive: false });
            toast({
              title: `${target.name} deactivated.`,
              variant: 'success',
            });
          } catch (error: unknown) {
            toast({
              title: HandleSupabaseError(error, 'core_membership_type').message,
              variant: 'destructive',
            });
          }
        }}
      />
    </main>
  );
}

export function MembershipTypesPage() {
  return (
    <PagePermissionGuard
      pageName="membership-types"
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <MembershipTypesPageContent />
    </PagePermissionGuard>
  );
}
