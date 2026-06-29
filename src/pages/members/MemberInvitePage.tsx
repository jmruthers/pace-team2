import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { useResourcePermissions } from '@solvera/pace-core/rbac';

import { useActiveOrganisationMembershipTypes } from '@/hooks/useActiveOrganisationMembershipTypes';
import { useSubOrganisationsData } from '@/hooks/useSubOrganisationsData';

function MemberInvitePageContent() {
  const navigate = useNavigate();
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;

  usePaceMain({ printTitle: 'Invite a new member', ariaLabel: 'Invite a new member' });

  const permissions = useResourcePermissions(PAGE_NAMES.members) as {
    canCreate: boolean;
    isLoading?: boolean;
  };
  const canSend = permissions.canCreate && permissions.isLoading !== true;

  const { memberTypes } = useActiveOrganisationMembershipTypes(organisationId);
  const { subOrganisations } = useSubOrganisationsData(organisationId);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState<string>('');
  const [membershipTypeId, setMembershipTypeId] = useState<string>('');
  const [note, setNote] = useState('');

  const unitOptions = useMemo(
    () => subOrganisations.map((unit) => ({ value: unit.id, label: unit.displayName })),
    [subOrganisations],
  );

  const sendDisabled =
    !canSend ||
    firstName.trim() === '' ||
    lastName.trim() === '' ||
    email.trim() === '';

  const handleSend = () => {
    if (sendDisabled) {
      return;
    }
    toast({
      title: 'Invitation sent',
      description: 'We emailed a self-service join link.',
      variant: 'success',
    });
    navigate('/members');
  };

  return (
    <main className="grid gap-6">
      <PageHeader
        title="Invite a new member"
        subtitle="We'll email them a self-service join link prefilled with this branch."
        actions={
          <Button type="button" variant="ghost" onClick={() => navigate('/members')}>
            Back to members
          </Button>
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Label className="grid gap-2">
            First name
            <Input
              value={firstName}
              onChange={setFirstName}
              placeholder="e.g. Felix"
              disabled={!canSend}
            />
          </Label>
          <Label className="grid gap-2">
            Last name
            <Input
              value={lastName}
              onChange={setLastName}
              placeholder="e.g. Carrington"
              disabled={!canSend}
            />
          </Label>
          <Label className="grid gap-2 md:col-span-2">
            Email
            <Input
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="name@example.org"
              disabled={!canSend}
            />
          </Label>
          <Label className="grid gap-2">
            Unit
            <Select value={unitId === '' ? undefined : unitId} onValueChange={setUnitId}>
              <SelectTrigger disabled={!canSend}>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className="grid gap-2">
            Membership type
            <Select
              value={membershipTypeId === '' ? undefined : membershipTypeId}
              onValueChange={setMembershipTypeId}
            >
              <SelectTrigger disabled={!canSend}>
                <SelectValue placeholder="Select membership type" />
              </SelectTrigger>
              <SelectContent>
                {memberTypes.map((memberType) => (
                  <SelectItem key={memberType.id} value={String(memberType.id)}>
                    {memberType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className="grid gap-2 md:col-span-2">
            Note (optional)
            <Textarea
              value={note}
              onChange={setNote}
              placeholder="Personal note included in the invite email."
              disabled={!canSend}
            />
          </Label>
        </CardContent>
        <CardFooter className="text-right">
          <fieldset className="text-right">
            <Button type="button" variant="outline" onClick={() => navigate('/members')}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSend} disabled={sendDisabled}>
              Send invitation
            </Button>
          </fieldset>
        </CardFooter>
      </Card>
    </main>
  );
}

export function MemberInvitePage() {
  return <MemberInvitePageContent />;
}
