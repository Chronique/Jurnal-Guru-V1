import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/Redis.ts';

const STORAGE_KEY = 'jurnal-guru:users';

const defaultUsers: User[] = [
  { id: '1', username: 'admin', password: 'password', name: 'Administrator', role: 'admin' },
  { id: '2', username: 'guru1', password: 'password', name: 'Guru Pengajar', role: 'guru' },
];

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    redis
      .get<User[]>(STORAGE_KEY)
      .then((data) => {
        if (!cancelled) {
          // Jika Redis kosong (pertama kali), seed dengan default users
          if (!data || data.length === 0) {
            setUsers(defaultUsers);
            redis.set(STORAGE_KEY, defaultUsers).catch(console.error);
          } else {
            setUsers(data);
          }
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useUsers] Gagal memuat data:', err);
          // Fallback ke default users agar app tetap bisa dipakai
          setUsers(defaultUsers);
          setError('Gagal memuat data akun dari server. Menggunakan data default.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (updated: User[]) => {
    try {
      await redis.set(STORAGE_KEY, updated);
    } catch (err) {
      console.error('[useUsers] Gagal menyimpan data:', err);
      setError('Gagal menyimpan data akun ke server.');
    }
  }, []);

  const addUser = useCallback(
    (user: Omit<User, 'id'>) => {
      const newUser: User = { ...user, id: uuidv4() };
      setUsers((prev) => {
        const updated = [...prev, newUser];
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const updateUser = useCallback(
    (id: string, updatedUser: Partial<User>) => {
      setUsers((prev) => {
        const updated = prev.map((u) =>
          u.id === id ? { ...u, ...updatedUser } : u
        );
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const deleteUser = useCallback(
    (id: string) => {
      setUsers((prev) => {
        const updated = prev.filter((u) => u.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  return { users, loading, error, addUser, updateUser, deleteUser };
}
