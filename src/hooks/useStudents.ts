import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type Student = {
  id: string;
  name: string;
  nis: string;
  className: string;
};

const STORAGE_KEY = 'jurnal-guru-students';

export function useStudents() {
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse students from local storage', e);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  }, [students]);

  const addStudent = (student: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...student,
      id: uuidv4(),
    };
    setStudents((prev) => [...prev, newStudent]);
  };

  const addStudents = (newStudents: Omit<Student, 'id'>[]) => {
    const studentsWithIds = newStudents.map(student => ({
      ...student,
      id: uuidv4(),
    }));
    setStudents((prev) => [...prev, ...studentsWithIds]);
  };

  const updateStudent = (id: string, updatedStudent: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((student) => (student.id === id ? { ...student, ...updatedStudent } : student))
    );
  };

  const deleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((student) => student.id !== id));
  };

  const deleteClass = (className: string) => {
    setStudents((prev) => prev.filter((student) => student.className !== className));
  };

  return {
    students,
    addStudent,
    addStudents,
    updateStudent,
    deleteStudent,
    deleteClass,
  };
}
