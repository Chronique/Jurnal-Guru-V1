export type AttendanceStatus = 'present' | 'sick' | 'permission' | 'absent';

export type Attendance = {
  present: number;
  sick: number;
  permission: number;
  absent: number;
};

export type JournalEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  subject: string;
  topic: string;
  learningObjective?: string;
  attendance: Attendance;
  studentAttendance?: Record<string, AttendanceStatus>;
  notes: string;
  createdAt: string;
};
