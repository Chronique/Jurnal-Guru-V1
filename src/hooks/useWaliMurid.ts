import { useState, useEffect, useCallback } from 'react';
import { redis } from '../lib/redis';

export type WaliMurid = {
  studentId: string;
  namaOrtu: string;
  noWa: string;
};

const STORAGE_KEY = 'jurnal-guru:wali-murid';

export function useWaliMurid() {
  const [waliList, setWaliList] = useState<WaliMurid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    redis.get<WaliMurid[]>(STORAGE_KEY)
      .then(data => {
        if (!cancelled) { setWaliList(data ?? []); setError(null); }
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat data wali murid.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (updated: WaliMurid[]) => {
    try { await redis.set(STORAGE_KEY, updated); }
    catch { setError('Gagal menyimpan data wali murid.'); }
  }, []);

  const upsertWali = useCallback((studentId: string, namaOrtu: string, noWa: string) => {
    setWaliList(prev => {
      const exists = prev.find(w => w.studentId === studentId);
      const updated = exists
        ? prev.map(w => w.studentId === studentId ? { studentId, namaOrtu, noWa } : w)
        : [...prev, { studentId, namaOrtu, noWa }];
      persist(updated);
      return updated;
    });
  }, [persist]);

  const getWali = useCallback((studentId: string): WaliMurid | undefined => {
    return waliList.find(w => w.studentId === studentId);
  }, [waliList]);

  return { waliList, loading, error, upsertWali, getWali };
}