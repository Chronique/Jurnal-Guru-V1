export type AttendanceStatus = 'present' | 'sick' | 'permission' | 'absent';

export type JournalEntry = {
  id: string;
  createdAt: string;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  subject: string;
  topic: string;
  learningObjective: string;
  notes: string;
  attendance: Record<AttendanceStatus, number>;
  studentAttendance: Record<string, AttendanceStatus>;
  absentStudentNames: string;
  photoUrl?: string;
  teacherId?: string;
  teacherName?: string;
  grades?: Record<string, string>;
};

export type Role = 'admin' | 'guru';

export type User = {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  waliKelas?: string; // nama kelas yang diampu sebagai wali kelas, opsional
};