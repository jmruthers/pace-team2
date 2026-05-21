import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from '@solvera/pace-core/components';

import type { OrgFormScheduleLimitsInput } from '@/lib/forms/orgForms.types';
import { datetimeLocalToIso, isoToDatetimeLocal } from '@/lib/forms/orgForms.mappers.datetime';

export interface ScheduleLimitsCardProps {
  disabled: boolean;
  opensAtIso: string | null | undefined;
  closesAtIso: string | null | undefined;
  onOpensAtIsoChange: (iso: string | null) => void;
  onClosesAtIsoChange: (iso: string | null) => void;
  scheduleLimits: OrgFormScheduleLimitsInput;
  onScheduleLimitsChange: (next: OrgFormScheduleLimitsInput) => void;
}

export function ScheduleLimitsCard({
  disabled,
  opensAtIso,
  closesAtIso,
  onOpensAtIsoChange,
  onClosesAtIsoChange,
  scheduleLimits,
  onScheduleLimitsChange,
}: ScheduleLimitsCardProps) {
  const opensLocal = isoToDatetimeLocal(opensAtIso);
  const closesLocal = isoToDatetimeLocal(closesAtIso);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule & limits</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Label className="grid gap-2">
          Opens at
          <Input
            type="datetime-local"
            disabled={disabled}
            value={opensLocal}
            onChange={(value) => {
              onOpensAtIsoChange(datetimeLocalToIso(value));
            }}
          />
          <small>ISO date and time when the form opens for submissions.</small>
        </Label>
        <Label className="grid gap-2">
          Closes at
          <Input
            type="datetime-local"
            disabled={disabled}
            value={closesLocal}
            onChange={(value) => {
              onClosesAtIsoChange(datetimeLocalToIso(value));
            }}
          />
          <small>ISO date and time when the form stops accepting submissions.</small>
        </Label>
        <Label className="grid gap-2">
          Maximum submissions
          <Input
            type="number"
            min={0}
            disabled={disabled}
            value={scheduleLimits.maxSubmissionsInput}
            onChange={(value) => {
              onScheduleLimitsChange({
                ...scheduleLimits,
                maxSubmissionsInput: value,
              });
            }}
          />
          <small>Leave blank for no limit.</small>
        </Label>
        <Label className="grid gap-2">
          Confirmation message
          <Textarea
            disabled={disabled}
            value={scheduleLimits.confirmationMessage}
            onChange={(value) => {
              onScheduleLimitsChange({
                ...scheduleLimits,
                confirmationMessage: value,
              });
            }}
          />
          <small>Shown to participants after a successful submission.</small>
        </Label>
        <Label className="grid grid-cols-[auto_1fr] items-center gap-2">
          <Switch
            checked={scheduleLimits.isRequired}
            disabled={disabled}
            onChange={(checked) => {
              onScheduleLimitsChange({
                ...scheduleLimits,
                isRequired: checked === true,
              });
            }}
          />
          <span>Form submission is required for this workflow</span>
        </Label>
      </CardContent>
    </Card>
  );
}
