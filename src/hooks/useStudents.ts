import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/Redis.ts';

export type Student = {
  id: string;
  name: string;
  nis: string;
  className: string;
};

const STORAGE_KEY = 'jurnal-guru:students';

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    redis
      .get<Student[]>(STORAGE_KEY)
      .then((data) => {
        if (!cancelled) {
          setStudents(data ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useStudents] Gagal memuat data:', err);
          setError('Gagal memuat data siswa dari server.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (updated: Student[]) => {
    try {
      await redis.set(STORAGE_KEY, updated);
    } catch (err) {
      console.error('[useStudents] Gagal menyimpan data:', err);
      setError('Gagal menyimpan data siswa ke server.');
    }
  }, []);

  const addStudent = useCallback(
    (student: Omit<Student, 'id'>) => {
      const newStudent: Student = { ...student, id: uuidv4() };
      setStudents((prev) => {
        const updated = [...prev, newStudent];
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const addStudents = useCallback(
    (newStudents: Omit<Student, 'id'>[]) => {
      const withIds = newStudents.map((s) => ({ ...s, id: uuidv4() }));
      setStudents((prev) => {
        const updated = [...prev, ...withIds];
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const updateStudent = useCallback(
    (id: string, updatedStudent: Partial<Student>) => {
      setStudents((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, ...updatedStudent } : s
        );
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const deleteStudent = useCallback(
    (id: string) => {
      setStudents((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const deleteClass = useCallback(
    (className: string) => {
      setStudents((prev) => {
        const updated = prev.filter((s) => s.className !== className);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  return {
    students,
    loading,
    error,
    addStudent,
    addStudents,
    updateStudent,
    deleteStudent,
    deleteClass,
  };
}
