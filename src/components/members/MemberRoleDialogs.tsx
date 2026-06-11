import {
  Button,
  DatePickerWithTimezone,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Input,
  Label,
  LoadingSpinner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@solvera/pace-core/components';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { formatRoleDate, toDateOnlyValue } from '@/lib/members/memberRoles.display';
import type { MemberRoleDialogsProps } from '@/components/members/memberRoleDialogs.types';

export type { MemberRoleDialogsProps } from '@/components/members/memberRoleDialogs.types';

export function MemberRoleDialogs({ filteredRoleTypes, add, edit, end }: MemberRoleDialogsProps) {
  return (
    <>
      <Dialog open={add.open} onOpenChange={add.onOpenChange}>
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
                  <Select value={add.selectedRoleId} onValueChange={(value) => add.onSelectedRoleIdChange(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role type" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRoleTypes.map((roleType) => (
                        <SelectItem key={roleType.id} value={String(roleType.id)}>
                          {roleType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                {add.selectedRoleHasActiveDuplicate && <p>This member already has an active role of this type.</p>}
                <Label htmlFor="add-role-appointment-title">
                  Appointment title
                  <Input
                    id="add-role-appointment-title"
                    type="text"
                    value={add.appointmentTitle}
                    onChange={add.onAppointmentTitleChange}
                    placeholder="Patrol Leader — Wombats"
                  />
                </Label>
                <Label htmlFor="add-role-start-date">
                  Start date
                  <DatePickerWithTimezone value={add.startDate} onChange={add.onStartDateChange} />
                </Label>
              </section>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => add.onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void add.onSubmit()}
                disabled={!add.hasSelectedRole || add.selectedRoleHasActiveDuplicate || add.pending}
              >
                {add.pending ? <LoadingSpinner /> : null}
                Add role
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog
        open={edit.row != null}
        onOpenChange={(open) => {
          if (!open) {
            edit.onRowChange(null);
          }
        }}
      >
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit role</DialogTitle>
              <DialogDescription>Update this member&apos;s standing role assignment.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <section className="grid gap-3">
                <Label htmlFor="edit-role-role-type">
                  Role type
                  <Select value={edit.roleId} onValueChange={(value) => edit.onRoleIdChange(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role type" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRoleTypes.map((roleType) => (
                        <SelectItem key={roleType.id} value={String(roleType.id)}>
                          {roleType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                {edit.hasActiveDuplicate && <p>This member already has an active role of this type.</p>}
                {edit.errorMessage != null && <p>{edit.errorMessage}</p>}
                <Label htmlFor="edit-role-appointment-title">
                  Appointment title
                  <Input
                    id="edit-role-appointment-title"
                    type="text"
                    value={edit.appointmentTitle}
                    onChange={edit.onAppointmentTitleChange}
                    placeholder="Patrol Leader — Wombats"
                  />
                </Label>
              </section>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => edit.onRowChange(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void edit.onSubmit()}
                disabled={!edit.hasRole || edit.hasActiveDuplicate || edit.pending}
              >
                {edit.pending ? <LoadingSpinner /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog
        open={end.row != null}
        onOpenChange={(open) => {
          if (!open) {
            end.onRowChange(null);
          }
        }}
      >
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End role?</DialogTitle>
              <DialogDescription>
                {(end.row?.roleName ?? '—')} will be marked ended on {formatRoleDate(toDateOnlyValue(end.endDate))}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <section className="grid gap-3">
                <Label htmlFor="end-role-date">
                  End date
                  <DatePickerWithTimezone value={end.endDate} onChange={end.onEndDateChange} />
                </Label>
                <p>You can&apos;t reverse this from this page.</p>
                {end.endDateInvalid && <p>End date must be on or after start date.</p>}
              </section>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => end.onRowChange(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void end.onSubmit()}
                disabled={end.endDateInvalid || end.pending}
              >
                {end.pending ? <LoadingSpinner /> : null}
                End role
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}

export async function runEndRoleWithToast(
  endRole: () => Promise<void>
): Promise<void> {
  try {
    await endRole();
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
  }
}
