import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Form,
  FormField,
  Input,
  Label,
  LoadingSpinner,
  PageHeader,
  Switch,
  Textarea,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { useResourcePermissions } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { useSubOrganisationsData } from '@/hooks/useSubOrganisationsData';
import type { SubOrganisationFormValues, SubOrganisationMutationError, SubOrganisationRow } from '@/lib/settings/subOrganisations.types';
import {
  createSubOrganisationSchema,
  editSubOrganisationSchema,
  toCreateSubOrganisationInput,
  toUpdateSubOrganisationInput,
} from '@/lib/settings/subOrganisations.validation';

const DUPLICATE_NAME_MESSAGE =
  'An organisation with this name already exists. Names must be unique across the platform.';

type SubOrgEditorFormHandle = {
  setError: (
    field: keyof SubOrganisationFormValues,
    opts: { type?: string; message?: string },
  ) => void;
  clearErrors: (field?: keyof SubOrganisationFormValues) => void;
};

interface SubOrganisationEditorState {
  mode: 'create' | 'edit';
  row: SubOrganisationRow | null;
}

function toFormValues(row: SubOrganisationRow | null): SubOrganisationFormValues {
  if (row == null) {
    return {
      name: '',
      displayName: '',
      description: '',
      isActive: true,
    };
  }

  return {
    name: row.name,
    displayName: row.displayName,
    description: row.description ?? '',
    isActive: row.isActive,
  };
}

function SubOrganisationsPageContent() {
  usePaceMain({ printTitle: 'Sub-organisations', ariaLabel: 'Sub-organisations' });

  const { selectedOrganisation } = useOrganisationsContext();
  const permissions = useResourcePermissions(PAGE_NAMES.organisations) as {
    canCreate: boolean;
    canUpdate: boolean;
    isLoading?: boolean;
  };
  const organisationId = selectedOrganisation?.id ?? null;
  const parentOrganisationName = selectedOrganisation?.display_name ?? selectedOrganisation?.name ?? '—';

  const {
    subOrganisations,
    isLoading,
    loadErrorMessage,
    refetchSubOrganisations,
    createSubOrganisation,
    updateSubOrganisation,
    createPending,
    updatePending,
  } = useSubOrganisationsData(organisationId);

  const [editorState, setEditorState] = useState<SubOrganisationEditorState | null>(null);
  const [duplicateNameError, setDuplicateNameError] = useState<string | null>(null);
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);
  const editorFormRef = useRef<SubOrgEditorFormHandle | null>(null);

  const permissionsLoading = permissions.isLoading === true;
  const canCreate = permissions.canCreate && !permissionsLoading;
  const canUpdate = permissions.canUpdate && !permissionsLoading;
  const savePending = createPending || updatePending;

  const closeEditor = () => {
    setDuplicateNameError(null);
    editorFormRef.current?.clearErrors('name');
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
    if (editorState == null) {
      return;
    }

    queueMicrotask(() => {
      closeEditor();
      toast({
        title: 'Editing cancelled — organisation changed.',
        variant: 'default',
      });
    });
  }, [editorState, selectedOrganisation?.id]);

  const columns = useMemo<DataTableColumn<SubOrganisationRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Internal name',
        sortable: true,
        searchable: true,
      },
      {
        id: 'displayName',
        accessorKey: 'displayName',
        header: 'Display name',
        sortable: true,
        searchable: true,
      },
      {
        id: 'is_active',
        accessorKey: 'isActive',
        header: 'Status',
        sortable: true,
        searchable: false,
        enableColumnFilter: true,
        filterType: 'select',
        filterSelectOptions: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' },
        ],
        cell: ({ row }) => (row.isActive ? 'Active' : 'Inactive'),
      },
    ],
    []
  );

  const tableActions = useMemo(
    () => (
      canUpdate
        ? [{
          label: 'Edit',
          onClick: (row: SubOrganisationRow) => {
            setDuplicateNameError(null);
            setEditorState({ mode: 'edit', row });
          },
          variant: 'outline' as const,
        }]
        : []
    ),
    [canUpdate]
  );

  const editorInitialValues = toFormValues(editorState?.row ?? null);
  const validationSchema = editorState?.mode === 'edit' ? editSubOrganisationSchema : createSubOrganisationSchema;

  return (
    <main className="grid gap-4">
      <PageHeader
        title="Sub-organisations"
        subtitle="Manage units and branches under your organisation."
        actions={
          canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setDuplicateNameError(null);
                setEditorState({ mode: 'create', row: null });
              }}
            >
              New sub-organisation
            </Button>
          ) : undefined
        }
      />

      {loadErrorMessage != null ? (
        <section className="grid gap-3">
          <Alert variant="destructive">
            <AlertTitle>Could not load sub-organisations</AlertTitle>
            <AlertDescription>{loadErrorMessage}</AlertDescription>
          </Alert>
          <nav aria-label="Retry sub-organisations">
            <Button type="button" onClick={() => void refetchSubOrganisations()}>
              Retry
            </Button>
          </nav>
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sub-organisations</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={subOrganisations}
              columns={columns}
              rbac={{ pageName: PAGE_NAMES.organisations }}
              title="Sub-organisations"
              isLoading={isLoading}
              getRowId={(row) => String(row.id)}
              initialPageSize={25}
              initialSorting={[{ id: 'displayName', desc: false }]}
              actions={tableActions}
              emptyState={{
                title: 'No sub-organisations yet. Create one below.',
              }}
              features={{
                creation: false,
                deletion: false,
                import: false,
                export: false,
              }}
            />
          </CardContent>
        </Card>
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
              <DialogTitle>{editorState?.mode === 'edit' ? 'Edit sub-organisation' : 'Create sub-organisation'}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Form<SubOrganisationFormValues>
                schema={validationSchema}
                mode="onChange"
                defaultValues={editorInitialValues}
                onSubmit={async (values) => {
                  if (organisationId == null) {
                    return;
                  }

                  setDuplicateNameError(null);
                  editorFormRef.current?.clearErrors('name');

                  try {
                    if (editorState?.mode === 'edit' && editorState.row != null) {
                      await updateSubOrganisation({
                        id: editorState.row.id,
                        input: toUpdateSubOrganisationInput(values),
                      });
                      toast({
                        title: 'Sub-organisation updated.',
                        variant: 'success',
                      });
                    } else {
                      await createSubOrganisation(toCreateSubOrganisationInput(values, organisationId));
                      toast({
                        title: 'Sub-organisation created.',
                        variant: 'success',
                      });
                    }
                    closeEditor();
                  } catch (error: unknown) {
                    const mutationError = error as SubOrganisationMutationError;
                    if (mutationError?.code === '23505') {
                      setDuplicateNameError(DUPLICATE_NAME_MESSAGE);
                      editorFormRef.current?.setError('name', {
                        type: 'server',
                        message: DUPLICATE_NAME_MESSAGE,
                      });
                      return;
                    }
                    toast({
                      title: 'Could not save sub-organisation',
                      description: HandleSupabaseError(error, 'core_organisations').message,
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {(methods) => {
                  editorFormRef.current = methods;
                  const hasFieldErrors = Object.keys(methods.formState.errors ?? {}).length > 0;
                  const showValidationAlert = methods.formState.isSubmitted && hasFieldErrors;
                  const disableControls = savePending || methods.formState.isSubmitting;
                  return (
                    <section className="grid gap-3">
                      {showValidationAlert ? (
                        <Alert variant="destructive">
                          <AlertTitle>Please fix the errors below.</AlertTitle>
                        </Alert>
                      ) : null}
                      {duplicateNameError != null ? (
                        <Alert variant="destructive">
                          <AlertTitle>{duplicateNameError}</AlertTitle>
                        </Alert>
                      ) : null}

                      {editorState?.mode === 'edit' ? (
                        <section className="grid gap-1">
                          <Label htmlFor="sub-organisation-parent">Parent organisation</Label>
                          <p id="sub-organisation-parent">{parentOrganisationName}</p>
                        </section>
                      ) : null}

                      <FormField<SubOrganisationFormValues>
                        name="name"
                        label="Internal name"
                        required
                        render={({ field }) => (
                          <Input
                            type="text"
                            value={String(field.value ?? '')}
                            placeholder="e.g. scouts-victoria-north"
                            disabled={editorState?.mode === 'edit' || disableControls}
                            onChange={(value) => {
                              setDuplicateNameError(null);
                              methods.clearErrors('name');
                              field.onChange(value);
                            }}
                          />
                        )}
                      />
                      <p>
                        {editorState?.mode === 'edit'
                          ? 'Internal names cannot be changed after create.'
                          : 'Globally unique across the platform. Cannot be changed later.'}
                      </p>

                      <FormField<SubOrganisationFormValues>
                        name="displayName"
                        label="Display name"
                        required
                        render={({ field }) => (
                          <Input
                            type="text"
                            value={String(field.value ?? '')}
                            disabled={disableControls}
                            onChange={(value) => {
                              field.onChange(value);
                            }}
                          />
                        )}
                      />

                      <FormField<SubOrganisationFormValues>
                        name="description"
                        label="Description"
                        render={({ field }) => (
                          <Textarea
                            value={String(field.value ?? '')}
                            placeholder="Optional — short description of this sub-organisation."
                            disabled={disableControls}
                            onChange={(value) => {
                              field.onChange(value);
                            }}
                          />
                        )}
                      />

                      {editorState?.mode === 'edit' ? (
                        <Label htmlFor="sub-organisation-active">
                          Active
                          <Switch
                            id="sub-organisation-active"
                            checked={methods.watch('isActive')}
                            disabled={disableControls}
                            onChange={(checked) => methods.setValue('isActive', checked, { shouldDirty: true })}
                          />
                        </Label>
                      ) : null}

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeEditor}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={disableControls || !methods.formState.isValid}>
                          {savePending ? <LoadingSpinner /> : null}
                          {editorState?.mode === 'edit' ? 'Save changes' : 'Create sub-organisation'}
                        </Button>
                      </DialogFooter>
                    </section>
                  );
                }}
              </Form>
            </DialogBody>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </main>
  );
}

export function SubOrganisationsPage() {
  return <SubOrganisationsPageContent />;
}
