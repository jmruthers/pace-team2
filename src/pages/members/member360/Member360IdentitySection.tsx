import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePickerWithTimezone,
  Form,
  FormField,
  Input,
  SaveActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@solvera/pace-core/components';
import { formatOptionalText, formatShortDate } from '@/lib/members/member360.display.format';
import { member360IdentitySchema } from '@/lib/members/member360.validation';
import type { IdentityFormValues } from '@/lib/members/member360.types';
import { parseDateInput, toDateInputValue } from '@/pages/members/member360/member360DateInput';

interface Member360IdentitySectionProps {
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

export function Member360IdentitySection({
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
}: Member360IdentitySectionProps) {
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