export interface Program {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  programId: string;
  displayName: string;
  color: string;
  email?: string;
  isPending?: boolean;
}

export interface ShiftType {
  code: string;
  label: string;
}

export interface Shift {
  id: string;
  programId: string;
  memberName: string;
  taskCode: string;
  dayOfWeek: number;
  startMin: number; // minutes from midnight (480 = 08:00, 510 = 08:30 …)
  endMin: number;
}
