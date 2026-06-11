import type { MemberRoleRow } from '@/lib/members/memberRoles.types';

export interface RoleTypeOption {
  id: number;
  name: string;
}

export interface MemberRoleAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRoleId: string;
  onSelectedRoleIdChange: (value: string) => void;
  appointmentTitle: string;
  onAppointmentTitleChange: (value: string) => void;
  startDate: Date;
  onStartDateChange: (value: Date) => void;
  selectedRoleHasActiveDuplicate: boolean;
  hasSelectedRole: boolean;
  pending: boolean;
  onSubmit: () => Promise<void>;
}

export interface MemberRoleEditDialogProps {
  row: MemberRoleRow | null;
  onRowChange: (row: MemberRoleRow | null) => void;
  roleId: string;
  onRoleIdChange: (value: string) => void;
  appointmentTitle: string;
  onAppointmentTitleChange: (value: string) => void;
  hasActiveDuplicate: boolean;
  hasRole: boolean;
  errorMessage: string | null;
  pending: boolean;
  onSubmit: () => Promise<void>;
}

export interface MemberRoleEndDialogProps {
  row: MemberRoleRow | null;
  onRowChange: (row: MemberRoleRow | null) => void;
  endDate: Date;
  onEndDateChange: (value: Date) => void;
  endDateInvalid: boolean;
  pending: boolean;
  onSubmit: () => Promise<void>;
}

export interface MemberRoleDialogsProps {
  filteredRoleTypes: RoleTypeOption[];
  add: MemberRoleAddDialogProps;
  edit: MemberRoleEditDialogProps;
  end: MemberRoleEndDialogProps;
}
