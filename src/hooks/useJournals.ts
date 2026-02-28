import { useState, useEffect, useCallback } from 'react';
import { JournalEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/Redis.ts';

const STORAGE_KEY = 'jurnal-guru:journals';

export function useJournals() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dari Redis saat mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    redis
      .get<JournalEntry[]>(STORAGE_KEY)
      .then((data) => {
        if (!cancelled) {
          setJournals(data ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useJournals] Gagal memuat data:', err);
          setError('Gagal memuat data jurnal dari server.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Simpan ke Redis setiap kali journals berubah (skip saat masih loading awal)
  const persist = useCallback(async (updated: JournalEntry[]) => {
    try {
      await redis.set(STORAGE_KEY, updated);
    } catch (err) {
      console.error('[useJournals] Gagal menyimpan data:', err);
      setError('Gagal menyimpan data jurnal ke server.');
    }
  }, []);

  const addJournal = useCallback(
    (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
      const newEntry: JournalEntry = {
        ...entry,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      };
      setJournals((prev) => {
        const updated = [newEntry, ...prev];
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const updateJournal = useCallback(
    (id: string, updatedEntry: Partial<JournalEntry>) => {
      setJournals((prev) => {
        const updated = prev.map((j) =>
          j.id === id ? { ...j, ...updatedEntry } : j
        );
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const deleteJournal = useCallback(
    (id: string) => {
      setJournals((prev) => {
        const updated = prev.filter((j) => j.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  return { journals, loading, error, addJournal, updateJournal, deleteJournal };
}
