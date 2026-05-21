import {
  Badge,
  Button,
  ConfirmationDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@solvera/pace-core/components';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { contactTierBadgeVariant, contactTierLabel } from '@/lib/members/member360.display.badges';
import { formatOptionalText, getDisplayName } from '@/lib/members/member360.display.format';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import type { AdditionalContactRow, MemberCardRow } from '@/lib/members/member360.types';

interface Member360PageOverlaysProps {
  discardDialogOpen: boolean;
  setDiscardDialogOpen: (open: boolean) => void;
  setEditing: (editing: boolean) => void;
  deactivateTarget: MemberCardRow | null;
  setDeactivateTarget: (row: MemberCardRow | null) => void;
  deactivateOrReactivateCard: (args: { cardId: string; isActive: boolean }) => Promise<unknown>;
  selectedContact: AdditionalContactRow | null;
  setSelectedContact: (row: AdditionalContactRow | null) => void;
  selectedContactDetail: ContactDetailData | null;
  setSelectedContactDetail: (detail: ContactDetailData | null) => void;
  selectedContactDetailError: string | null;
  setSelectedContactDetailError: (message: string | null) => void;
}

export function Member360PageOverlays({
  discardDialogOpen,
  setDiscardDialogOpen,
  setEditing,
  deactivateTarget,
  setDeactivateTarget,
  deactivateOrReactivateCard,
  selectedContact,
  setSelectedContact,
  selectedContactDetail,
  setSelectedContactDetail,
  selectedContactDetailError,
  setSelectedContactDetailError,
}: Member360PageOverlaysProps) {
  return (
    <>
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
    </>
  );
}
