/* eslint-disable complexity, max-lines-per-function, max-lines */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  DataTable,
  DatePickerWithTimezone,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormField,
  Input,
  Label,
  LoadingSpinner,
  SaveActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@solvera/pace-core/components';
import type { DataTableColumn } from '@solvera/pace-core/components';
import { ChevronLeft, ChevronRight } from '@solvera/pace-core/icons';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { launchMemberProfile } from '@solvera/pace-core/member-profile-launch';
import { type Member360MutationError, useMember360Data } from '@/hooks/useMember360Data';
import {
  applicationStatusBadgeVariant,
  applicationStatusLabel,
  cardActiveBadgeVariant,
  contactTierBadgeVariant,
  contactTierLabel,
  filterApplications,
  filterCards,
  filterContacts,
  formatOptionalText,
  formatPhoneRows,
  formatShortDate,
  getDisplayName,
  getMemberDisplayName,
  membershipStatusBadgeVariant,
  toIdentityFormValues,
} from '@/lib/members/member360.display';
import { member360IdentitySchema } from '@/lib/members/member360.validation';
import type {
  AdditionalContactRow,
  ContactDetailData,
  IdentityFormValues,
  MemberApplicationRow,
  MemberCardRow,
} from '@/lib/members/member360.types';

function parseDateInput(value: string): Date | null {
  if (value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed;
}

function toDateInputValue(value: Date | null): string {
  if (value == null) {
    return '';
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function MemberNotFoundState() {
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

function SectionError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <nav aria-label={`${title} retry`}>
        <Button type="button" onClick={onRetry}>
          Retry
        </Button>
      </nav>
    </section>
  );
}

interface IdentityFormSectionProps {
  memberName: string;
  memberEmail: string;
  phonesText: string;
  residentialAddress: string;
  postalAddress: string;
  allowUpdate: boolean;
  showPortalEdit: boolean;
  showPortalView: boolean;
  onPortalEdit: () => void;
  onPortalView: () => void;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  memberStatusLabel: string;
  memberStatusVariant: Parameters<typeof Badge>[0]['variant'];
  initialValues: IdentityFormValues;
  onSubmit: (values: IdentityFormValues) => Promise<void>;
  onDirtyCancel: () => void;
  savePending: boolean;
  genderOptions: Array<{ id: number; name: string }>;
  pronounOptions: Array<{ id: number; name: string }>;
  membershipTypeOptions: Array<{ id: number; name: string }>;
}

function IdentitySection({
  memberName,
  memberEmail,
  phonesText,
  residentialAddress,
  postalAddress,
  allowUpdate,
  showPortalEdit,
  showPortalView,
  onPortalEdit,
  onPortalView,
  editing,
  setEditing,
  memberStatusLabel,
  memberStatusVariant,
  initialValues,
  onSubmit,
  onDirtyCancel,
  savePending,
  genderOptions,
  pronounOptions,
  membershipTypeOptions,
}: IdentityFormSectionProps) {
  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <CardTitle>{memberName}</CardTitle>
        <section className="grid grid-flow-col auto-cols-max gap-2 items-center">
          <Avatar name={memberName} />
          <Badge variant={memberStatusVariant}>{memberStatusLabel}</Badge>
          {showPortalEdit && (
            <Button type="button" onClick={onPortalEdit}>
              Edit in Portal
            </Button>
          )}
          {showPortalView && (
            <Button type="button" variant="outline" onClick={onPortalView}>
              View in Portal
            </Button>
          )}
        </section>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!editing && (
          <section className="grid gap-4">
            <aside className="grid gap-3 md:grid-cols-2">
              <article>
                <h2>Preferred name</h2>
                <p>{formatOptionalText(initialValues.preferredName)}</p>
              </article>
              <article>
                <h2>First name</h2>
                <p>{formatOptionalText(initialValues.firstName)}</p>
              </article>
              <article>
                <h2>Last name</h2>
                <p>{formatOptionalText(initialValues.lastName)}</p>
              </article>
              <article>
                <h2>Email</h2>
                <p>{formatOptionalText(initialValues.email)}</p>
              </article>
              <article>
                <h2>Date of birth</h2>
                <p>{formatShortDate(initialValues.dateOfBirth)}</p>
              </article>
              <article>
                <h2>Gender</h2>
                <p>{formatOptionalText(genderOptions.find((option) => String(option.id) === initialValues.genderId)?.name ?? null)}</p>
              </article>
              <article>
                <h2>Pronoun</h2>
                <p>{formatOptionalText(pronounOptions.find((option) => String(option.id) === initialValues.pronounId)?.name ?? null)}</p>
              </article>
              <article>
                <h2>Membership type</h2>
                <p>
                  {formatOptionalText(
                    membershipTypeOptions.find((option) => String(option.id) === initialValues.membershipTypeId)?.name ?? null
                  )}
                </p>
              </article>
              <article>
                <h2>Membership number</h2>
                <p>{formatOptionalText(initialValues.membershipNumber)}</p>
              </article>
              <article>
                <h2>Membership status</h2>
                <p>{memberStatusLabel}</p>
              </article>
              <article>
                <h2>Valid from</h2>
                <p>{formatShortDate(initialValues.validFrom)}</p>
              </article>
              <article>
                <h2>Valid to</h2>
                <p>{formatShortDate(initialValues.validTo)}</p>
              </article>
            </aside>
            <dl className="grid gap-2">
              <article className="grid gap-1">
                <dt>Phones</dt>
                <dd>{phonesText}</dd>
              </article>
              <article className="grid gap-1">
                <dt>Email</dt>
                <dd>{memberEmail}</dd>
              </article>
              <article className="grid gap-1">
                <dt>Residential address</dt>
                <dd>{residentialAddress}</dd>
              </article>
              <article className="grid gap-1">
                <dt>Postal address</dt>
                <dd>{postalAddress}</dd>
              </article>
            </dl>
            {allowUpdate && (
              <section className="text-right">
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  Unlock
                </Button>
              </section>
            )}
          </section>
        )}
        {editing && (
          <Form<IdentityFormValues>
            schema={member360IdentitySchema}
            defaultValues={initialValues}
            onSubmit={async (values) => onSubmit(values)}
          >
            {(methods) => (
              <section className="grid gap-4">
                <dl className="grid gap-2">
                  <article className="grid gap-1">
                    <dt>Phones</dt>
                    <dd>{phonesText}</dd>
                  </article>
                  <article className="grid gap-1">
                    <dt>Email</dt>
                    <dd>{memberEmail}</dd>
                  </article>
                  <article className="grid gap-1">
                    <dt>Residential address</dt>
                    <dd>{residentialAddress}</dd>
                  </article>
                  <article className="grid gap-1">
                    <dt>Postal address</dt>
                    <dd>{postalAddress}</dd>
                  </article>
                </dl>
                <article className="grid gap-3 md:grid-cols-2">
                  <FormField<IdentityFormValues>
                    name="firstName"
                    label="First name"
                    render={({ field }) => <Input {...field} type="text" placeholder="First name" />}
                  />
                  <FormField<IdentityFormValues>
                    name="lastName"
                    label="Last name"
                    render={({ field }) => <Input {...field} type="text" placeholder="Last name" />}
                  />
                  <FormField<IdentityFormValues>
                    name="preferredName"
                    label="Preferred name"
                    render={({ field }) => <Input {...field} type="text" placeholder="Preferred name" />}
                  />
                  <FormField<IdentityFormValues>
                    name="email"
                    label="Email"
                    render={({ field }) => <Input {...field} type="email" placeholder="name@example.com" />}
                  />
                  <FormField<IdentityFormValues>
                    name="dateOfBirth"
                    label="Date of birth"
                    render={({ field }) => (
                      <DatePickerWithTimezone
                        value={parseDateInput(field.value)}
                        onChange={(nextDate) => field.onChange(toDateInputValue(nextDate))}
                        placeholder="Date of birth"
                      />
                    )}
                  />
                  <FormField<IdentityFormValues>
                    name="genderId"
                    label="Gender"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(value) => field.onChange(value ?? '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Select gender</SelectItem>
                          {genderOptions.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FormField<IdentityFormValues>
                    name="pronounId"
                    label="Pronoun"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(value) => field.onChange(value ?? '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pronoun" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Select pronoun</SelectItem>
                          {pronounOptions.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FormField<IdentityFormValues>
                    name="membershipTypeId"
                    label="Membership type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(value) => field.onChange(value ?? '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select membership type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Select membership type</SelectItem>
                          {membershipTypeOptions.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FormField<IdentityFormValues>
                    name="membershipNumber"
                    label="Membership number"
                    render={({ field }) => <Input {...field} type="text" placeholder="Membership number" />}
                  />
                  <FormField<IdentityFormValues>
                    name="validFrom"
                    label="Valid from"
                    render={({ field }) => (
                      <DatePickerWithTimezone
                        value={parseDateInput(field.value)}
                        onChange={(nextDate) => field.onChange(toDateInputValue(nextDate))}
                        placeholder="Valid from"
                      />
                    )}
                  />
                  <FormField<IdentityFormValues>
                    name="validTo"
                    label="Valid to"
                    render={({ field }) => (
                      <DatePickerWithTimezone
                        value={parseDateInput(field.value)}
                        onChange={(nextDate) => field.onChange(toDateInputValue(nextDate))}
                        placeholder="Valid to"
                      />
                    )}
                  />
                  <aside className="md:col-span-2">
                    <SaveActions
                      onCancel={() => {
                        if (methods.formState.isDirty) {
                          onDirtyCancel();
                        } else {
                          methods.reset(initialValues);
                          setEditing(false);
                        }
                      }}
                      saveType="submit"
                      saveDisabled={savePending || methods.formState.isSubmitting}
                    />
                  </aside>
                </article>
              </section>
            )}
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

function Member360PageContent() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { selectedOrganisation } = useOrganisationsContext();
  const { user } = useUnifiedAuth();
  const memberPermissions = useResourcePermissions('members');
  const portalPermissions = useResourcePermissions('member-profile');

  const {
    member,
    memberLoading,
    memberErrorMessage,
    refetchMember,
    memberPhones,
    memberPhonesLoading,
    memberPhonesErrorMessage,
    refetchMemberPhones,
    contacts,
    contactsLoading,
    contactsErrorMessage,
    refetchContacts,
    cards,
    cardsLoading,
    cardsErrorMessage,
    refetchCards,
    applications,
    applicationsLoading,
    applicationsErrorMessage,
    refetchApplications,
    genderTypes,
    pronounTypes,
    membershipTypes,
    saveIdentity,
    saveIdentityPending,
    deactivateOrReactivateCard,
    fetchContactDetails,
  } = useMember360Data({
    memberId,
    organisationId: selectedOrganisation?.id ?? null,
  });

  const [editing, setEditing] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<MemberCardRow | null>(null);
  const [selectedContact, setSelectedContact] = useState<AdditionalContactRow | null>(null);
  const [selectedContactDetail, setSelectedContactDetail] = useState<ContactDetailData | null>(null);
  const [selectedContactDetailError, setSelectedContactDetailError] = useState<string | null>(null);
  const [contactsSearch, setContactsSearch] = useState('');
  const [cardsSearch, setCardsSearch] = useState('');
  const [applicationsSearch, setApplicationsSearch] = useState('');
  const previousOrganisationIdRef = useRef<string | null | undefined>(undefined);

  const memberName = member == null ? 'Member 360' : getMemberDisplayName(member);
  usePaceMain({ printTitle: memberName });

  useEffect(() => {
    if (selectedContact == null) {
      return;
    }
    let isCurrent = true;
    void fetchContactDetails(selectedContact)
      .then((detail) => {
        if (isCurrent) {
          setSelectedContactDetail(detail);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setSelectedContactDetailError(HandleSupabaseError(error, 'core_contact').message);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [fetchContactDetails, selectedContact]);

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
    queueMicrotask(() => {
      setEditing(false);
      setDiscardDialogOpen(false);
      setDeactivateTarget(null);
      setSelectedContact(null);
      setSelectedContactDetail(null);
      setSelectedContactDetailError(null);
    });
  }, [selectedOrganisation?.id]);

  const isOrgMismatch = member != null && selectedOrganisation != null && member.organisationId !== selectedOrganisation.id;
  const isActingTargetMember = member != null && member.userId != null && user?.id === member.userId;

  const showPortalEdit = !isActingTargetMember && portalPermissions.canUpdate;
  const showPortalView = !isActingTargetMember && !portalPermissions.canUpdate && portalPermissions.canRead;

  const canUpdateMember = memberPermissions.canUpdate;

  const memberPhonesText = formatPhoneRows(memberPhones);
  const memberEmailText = formatOptionalText(member?.email ?? null);
  const memberResidentialAddressText = formatOptionalText(member?.residentialAddress ?? null);
  const memberPostalAddressText = formatOptionalText(member?.postalAddress ?? null);

  const initialValues: IdentityFormValues | null = member == null ? null : toIdentityFormValues(member);

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
            onClick={() => {
              setSelectedContactDetail(null);
              setSelectedContactDetailError(null);
              setSelectedContact(row);
            }}
          >
            View details
          </Button>
        ),
      },
    ],
    []
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
              <Button type="button" variant="outline" onClick={() => setDeactivateTarget(row)}>
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
    [canUpdateMember, deactivateOrReactivateCard]
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

  if (memberLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <LoadingSpinner label="Loading member" />
      </main>
    );
  }

  if (memberErrorMessage != null) {
    return (
      <main className="grid gap-3">
        <Alert variant="destructive">
          <AlertTitle>Could not load member</AlertTitle>
          <AlertDescription>{memberErrorMessage}</AlertDescription>
        </Alert>
        <nav aria-label="Retry member">
          <Button type="button" onClick={() => void refetchMember()}>
            Retry
          </Button>
        </nav>
      </main>
    );
  }

  if (member == null) {
    return <MemberNotFoundState />;
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

  const filteredContacts = filterContacts(contacts, contactsSearch);
  const filteredCards = filterCards(cards, cardsSearch);
  const filteredApplications = filterApplications(applications, applicationsSearch);

  return (
    <main className="grid gap-4 pb-8">
      <nav aria-label="Back to members">
        <Button type="button" variant="outline" onClick={() => navigate('/members')}>
          <ChevronLeft size={16} aria-hidden />
          Back to members
        </Button>
      </nav>

      {initialValues != null && (
        <IdentitySection
          memberName={memberName}
          memberEmail={memberEmailText}
          phonesText={memberPhonesLoading ? 'Loading…' : memberPhonesText}
          residentialAddress={memberResidentialAddressText}
          postalAddress={memberPostalAddressText}
          allowUpdate={canUpdateMember}
          showPortalEdit={showPortalEdit}
          showPortalView={showPortalView}
          onPortalEdit={() =>
            launchMemberProfile({
              portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN,
              mode: 'edit',
              memberId: member.id,
            })
          }
          onPortalView={() =>
            launchMemberProfile({
              portalOrigin: import.meta.env.VITE_PORTAL_ORIGIN,
              mode: 'view',
              memberId: member.id,
            })
          }
          editing={editing}
          setEditing={setEditing}
          memberStatusLabel={member.membershipStatus}
          memberStatusVariant={membershipStatusBadgeVariant(member.membershipStatus)}
          initialValues={initialValues}
          onSubmit={async (values) => {
            try {
              await saveIdentity({
                member,
                values,
                lookups: {
                  genderTypes,
                  pronounTypes,
                  membershipTypes,
                },
              });
              setEditing(false);
              toast({ title: 'Member saved.', variant: 'success' });
            } catch (error: unknown) {
              const normalizedError = error as Member360MutationError;
              const fallbackContext = normalizedError?.context ?? 'core_member';
              const title =
                normalizedError?.message ??
                HandleSupabaseError(error, fallbackContext).message;
              toast({
                title,
                variant: 'destructive',
              });
            }
          }}
          onDirtyCancel={() => setDiscardDialogOpen(true)}
          savePending={saveIdentityPending}
          genderOptions={genderTypes}
          pronounOptions={pronounTypes}
          membershipTypeOptions={membershipTypes}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Additional contacts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-contacts-search">
            Search contacts
            <Input id="member-contacts-search" value={contactsSearch} onChange={(value) => setContactsSearch(value)} />
          </Label>
          {contactsErrorMessage != null ? (
            <SectionError title="Could not load contacts" message={contactsErrorMessage} onRetry={() => void refetchContacts()} />
          ) : (
            <DataTable<AdditionalContactRow>
              data={filteredContacts}
              columns={contactColumns}
              rbac={{ pageName: 'members' }}
              description={`${contacts.length} contacts`}
              isLoading={contactsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'name', desc: false }]}
              emptyState={{ title: 'No additional contacts recorded.', description: '' }}
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
                search: false,
                pagination: true,
                sorting: true,
                filtering: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member cards</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-cards-search">
            Search cards
            <Input id="member-cards-search" value={cardsSearch} onChange={(value) => setCardsSearch(value)} />
          </Label>
          {cardsErrorMessage != null ? (
            <SectionError title="Could not load cards" message={cardsErrorMessage} onRetry={() => void refetchCards()} />
          ) : (
            <DataTable<MemberCardRow>
              data={filteredCards}
              columns={cardColumns}
              rbac={{ pageName: 'members' }}
              description={`${cards.length} cards`}
              isLoading={cardsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'createdAt', desc: true }]}
              emptyState={{ title: 'No cards recorded.', description: '' }}
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
                search: false,
                pagination: true,
                sorting: true,
                filtering: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-applications-search">
            Search applications
            <Input
              id="member-applications-search"
              value={applicationsSearch}
              onChange={(value) => setApplicationsSearch(value)}
            />
          </Label>
          {applicationsErrorMessage != null ? (
            <SectionError
              title="Could not load applications"
              message={applicationsErrorMessage}
              onRetry={() => void refetchApplications()}
            />
          ) : (
            <DataTable<MemberApplicationRow>
              data={filteredApplications}
              columns={applicationColumns}
              rbac={{ pageName: 'members' }}
              description={`${applications.length} applications`}
              isLoading={applicationsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'eventDate', desc: true }]}
              emptyState={{ title: 'No applications recorded.', description: '' }}
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
                search: false,
                pagination: true,
                sorting: true,
                filtering: true,
                columnVisibility: true,
                columnReordering: true,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standing roles</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => navigate(`/members/${member.id}/roles`)}>
            View roles ›
            <ChevronRight size={16} aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard unsaved changes?"
        description="Your edits will not be saved."
        confirmLabel="Discard"
        cancelLabel="Continue editing"
        variant="destructive"
        onConfirm={() => {
          setDiscardDialogOpen(false);
          setEditing(false);
        }}
      />

      <ConfirmationDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null);
          }
        }}
        title="Deactivate card?"
        description={
          deactivateTarget == null
            ? ''
            : `${deactivateTarget.cardIdentifier} will no longer scan as an active card. You can reactivate it later.`
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (deactivateTarget == null) {
            return;
          }
          const target = deactivateTarget;
          setDeactivateTarget(null);
          try {
            await deactivateOrReactivateCard({ cardId: target.id, isActive: false });
            toast({ title: `${target.cardIdentifier} deactivated.`, variant: 'success' });
          } catch (error: unknown) {
            toast({ title: HandleSupabaseError(error, 'core_member_card').message, variant: 'destructive' });
          }
        }}
      />

      <Dialog
        open={selectedContact != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedContact(null);
            setSelectedContactDetail(null);
            setSelectedContactDetailError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedContact == null
                ? 'Contact details'
                : getDisplayName(selectedContact.firstName, selectedContact.lastName, selectedContact.preferredName)}
            </DialogTitle>
            <DialogDescription>
              {selectedContact == null ? '—' : (
                <Badge variant="soft-sec-normal">{formatOptionalText(selectedContact.contactTypeName)}</Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {selectedContact != null && (
              <section className="grid gap-2">
                <article className="grid gap-1">
                  <h2>Tier</h2>
                  <Badge variant={contactTierBadgeVariant(selectedContact.permissionType)}>
                    {contactTierLabel(selectedContact.permissionType)}
                  </Badge>
                </article>
                <article className="grid gap-1">
                  <h2>Phones</h2>
                  <p>
                    {selectedContactDetailError != null
                      ? selectedContactDetailError
                      : selectedContactDetail == null
                        ? 'Loading…'
                        : selectedContactDetail.phonesText}
                  </p>
                </article>
                <article className="grid gap-1">
                  <h2>Email</h2>
                  <p>{formatOptionalText(selectedContact.email)}</p>
                </article>
                <article className="grid gap-1">
                  <h2>Residential address</h2>
                  <p>{selectedContactDetail?.residentialAddress ?? 'Loading…'}</p>
                </article>
                <article className="grid gap-1">
                  <h2>Postal address</h2>
                  <p>{selectedContactDetail?.postalAddress ?? 'Loading…'}</p>
                </article>
              </section>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedContact(null);
                setSelectedContactDetail(null);
                setSelectedContactDetailError(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {memberPhonesErrorMessage != null && (
        <SectionError title="Could not load member phones" message={memberPhonesErrorMessage} onRetry={() => void refetchMemberPhones()} />
      )}
    </main>
  );
}

export function Member360Page() {
  return (
    <PagePermissionGuard pageName="members" operation="read" fallback={<AccessDenied />}>
      <Member360PageContent />
    </PagePermissionGuard>
  );
}
