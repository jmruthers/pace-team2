import type { DataTableColumn } from '@solvera/pace-core/components';
import { Card, CardContent, CardHeader, CardTitle, DataTable, Input, Label } from '@solvera/pace-core/components';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import type {
  AdditionalContactRow,
  MemberApplicationRow,
  MemberCardRow,
} from '@/lib/members/member360.types';
import { Member360SectionError } from '@/components/members/member360/Member360SectionError';

const READ_ONLY_TABLE_FEATURES = {
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
} as const;

interface Member360RecordsSectionProps {
  contacts: AdditionalContactRow[];
  filteredContacts: AdditionalContactRow[];
  contactsSearch: string;
  onContactsSearchChange: (value: string) => void;
  contactsLoading: boolean;
  contactsErrorMessage: string | null;
  onRefetchContacts: () => void;
  contactColumns: DataTableColumn<AdditionalContactRow>[];
  cards: MemberCardRow[];
  filteredCards: MemberCardRow[];
  cardsSearch: string;
  onCardsSearchChange: (value: string) => void;
  cardsLoading: boolean;
  cardsErrorMessage: string | null;
  onRefetchCards: () => void;
  cardColumns: DataTableColumn<MemberCardRow>[];
  applications: MemberApplicationRow[];
  filteredApplications: MemberApplicationRow[];
  applicationsSearch: string;
  onApplicationsSearchChange: (value: string) => void;
  applicationsLoading: boolean;
  applicationsErrorMessage: string | null;
  onRefetchApplications: () => void;
  applicationColumns: DataTableColumn<MemberApplicationRow>[];
}

export function Member360RecordsSection({
  contacts,
  filteredContacts,
  contactsSearch,
  onContactsSearchChange,
  contactsLoading,
  contactsErrorMessage,
  onRefetchContacts,
  contactColumns,
  cards,
  filteredCards,
  cardsSearch,
  onCardsSearchChange,
  cardsLoading,
  cardsErrorMessage,
  onRefetchCards,
  cardColumns,
  applications,
  filteredApplications,
  applicationsSearch,
  onApplicationsSearchChange,
  applicationsLoading,
  applicationsErrorMessage,
  onRefetchApplications,
  applicationColumns,
}: Member360RecordsSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Additional contacts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="member-contacts-search">
            Search contacts
            <Input
              id="member-contacts-search"
              value={contactsSearch}
              onChange={onContactsSearchChange}
            />
          </Label>
          {contactsErrorMessage != null ? (
            <Member360SectionError
              title="Could not load contacts"
              message={contactsErrorMessage}
              onRetry={onRefetchContacts}
            />
          ) : (
            <DataTable<AdditionalContactRow>
              data={filteredContacts}
              columns={contactColumns}
              rbac={{ pageName: PAGE_NAMES.members }}
              description={`${contacts.length} contacts`}
              isLoading={contactsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'name', desc: false }]}
              emptyState={{ title: 'No additional contacts recorded.', description: '' }}
              features={READ_ONLY_TABLE_FEATURES}
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
            <Input id="member-cards-search" value={cardsSearch} onChange={onCardsSearchChange} />
          </Label>
          {cardsErrorMessage != null ? (
            <Member360SectionError
              title="Could not load cards"
              message={cardsErrorMessage}
              onRetry={onRefetchCards}
            />
          ) : (
            <DataTable<MemberCardRow>
              data={filteredCards}
              columns={cardColumns}
              rbac={{ pageName: PAGE_NAMES.members }}
              description={`${cards.length} cards`}
              isLoading={cardsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'createdAt', desc: true }]}
              emptyState={{ title: 'No cards recorded.', description: '' }}
              features={READ_ONLY_TABLE_FEATURES}
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
              onChange={onApplicationsSearchChange}
            />
          </Label>
          {applicationsErrorMessage != null ? (
            <Member360SectionError
              title="Could not load applications"
              message={applicationsErrorMessage}
              onRetry={onRefetchApplications}
            />
          ) : (
            <DataTable<MemberApplicationRow>
              data={filteredApplications}
              columns={applicationColumns}
              rbac={{ pageName: PAGE_NAMES.members }}
              description={`${applications.length} applications`}
              isLoading={applicationsLoading}
              getRowId={(row) => row.id}
              initialPageSize={25}
              initialSorting={[{ id: 'eventDate', desc: true }]}
              emptyState={{ title: 'No applications recorded.', description: '' }}
              features={READ_ONLY_TABLE_FEATURES}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
