import { useState, useMemo, useCallback, useEffect } from 'react';
import { Student } from '../hooks/useStudents';
import { WaliMurid as WaliMuridType, useWaliMurid } from '../hooks/useWaliMurid';
import { JournalEntry } from '../types';
import { redis } from '../lib/redis';
import {
  Phone, Users, BookOpen, Search, Save,
  ChevronDown, Star, CheckCircle2, Send,
  Settings, Eye, EyeOff, Loader2, X, CheckCheck,
  CalendarDays, Calendar, Clock, RefreshCw, UserCheck, GraduationCap,
} from 'lucide-react';

type WaliMuridProps = {
  students: Student[];
  journals: JournalEntry[];
  lockedKelas?: string;
  isAdmin?: boolean;
};

// Tambah 'rekap-kelas' sebagai tab ketiga untuk guru wali kelas
type ActiveTab = 'kontak' | 'nilai' | 'rekap-kelas';
type PeriodeFilter = 'harian' | 'mingguan' | 'bulanan';
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 transition-colors';
const FONNTE_TOKEN_KEY  = 'jurnal-guru:fonnte-token';
const SENT_TS_KEY       = 'jurnal-guru:sent-ts';
const BULK_SENT_TS_KEY  = 'jurnal-guru:bulk-sent-ts';
const SENT_LOCK_MS      = 15 * 60 * 1000;

function loadSentTs(): Map<string, number> {
  try {
    const raw = localStorage.getItem(SENT_TS_KEY);
    if (!raw) return new Map();
    return new Map<string, number>(Object.entries(JSON.parse(raw) as Record<string, number>));
  } catch { return new Map<string, number>(); }
}
function saveSentTs(map: Map<string, number>) {
  try { localStorage.setItem(SENT_TS_KEY, JSON.stringify(Object.fromEntries(map))); } catch {}
}
function loadBulkSentTs(): number | null {
  try { const raw = localStorage.getItem(BULK_SENT_TS_KEY); return raw ? Number(raw) : null; }
  catch { return null; }
}
function saveBulkSentTs(ts: number) {
  try { localStorage.setItem(BULK_SENT_TS_KEY, String(ts)); } catch {}
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getTodayStr() { return fmt(new Date()); }
function getWeekRange() {
  const now = new Date();
  const daysToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const monday = new Date(now); monday.setDate(now.getDate() - daysToMonday);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const labelStart = monday.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  const labelEnd   = friday.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  return { start: fmt(monday), end: fmt(friday), label: `${labelStart} – ${labelEnd}` };
}
function getMonthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: fmt(start), end: fmt(end), label: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
}
function getPeriodeLabelShort(p: PeriodeFilter) {
  if (p === 'harian')   return 'Hari Ini';
  if (p === 'mingguan') return 'Minggu Ini';
  return 'Bulan Ini';
}
function formatCountdown(sentTs: number): string {
  const remaining = SENT_LOCK_MS - (Date.now() - sentTs);
  if (remaining <= 0) return '';
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function sendWhatsApp(token: string, noWa: string, message: string): Promise<{ success: boolean; reason?: string }> {
  try {
    const fd = new FormData();
    fd.append('target', noWa);
    fd.append('message', message);
    fd.append('countryCode', '62');
    const res  = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: token }, body: fd });
    const json = await res.json();
    return json.status === true ? { success: true } : { success: false, reason: json.reason ?? 'Gagal mengirim' };
  } catch { return { success: false, reason: 'Koneksi gagal' }; }
}

export function WaliMurid({ students, journals, lockedKelas, isAdmin = false }: WaliMuridProps) {
  const { waliList, loading, upsertWali, getWali } = useWaliMurid();

  const [activeTab,      setActiveTab]      = useState<ActiveTab>('kontak');
  const [selectedKelas,  setSelectedKelas]  = useState('');
  const [search,         setSearch]         = useState('');
  const [editMap,        setEditMap]        = useState<Record<string, { namaOrtu: string; noWa: string }>>({});
  const [savedIds,       setSavedIds]       = useState<Set<string>>(new Set());
  const [periodeFilter,  setPeriodeFilter]  = useState<PeriodeFilter>('mingguan');
  const [fonnteToken,    setFonnteToken]    = useState('');
  const [tokenInput,     setTokenInput]     = useState('');
  const [showToken,      setShowToken]      = useState(false);
  const [showTokenForm,  setShowTokenForm]  = useState(false);
  const [tokenSaved,     setTokenSaved]     = useState(false);
  const [sendStatusMap,  setSendStatusMap]  = useState<Record<string, SendStatus>>({});
  const [bulkStatus,     setBulkStatus]     = useState<'idle' | 'sending' | 'done'>('idle');
  const [bulkResult,     setBulkResult]     = useState<{ ok: number; fail: number } | null>(null);
  const [sentTsMap,      setSentTsMap]      = useState<Map<string, number>>(loadSentTs);
  const [bulkSentTs,     setBulkSentTs]     = useState<number | null>(loadBulkSentTs);
  const [, setTick] = useState(0);
  const [rekapView, setRekapView] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');
  const [expandedPeriod, setExpandedPeriod] = useState<Set<string>>(new Set());
  const [disiplinMsg,    setDisiplinMsg]    = useState('');
  const [disiplinStatus, setDisiplinStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [disiplinResult, setDisiplinResult] = useState<{ ok: number; fail: number } | null>(null);

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    redis.get<string>(FONNTE_TOKEN_KEY).then(t => { if (t) { setFonnteToken(t); setTokenInput(t); } }).catch(() => {});
  }, []);

  const handleSaveToken = async () => {
    await redis.set(FONNTE_TOKEN_KEY, tokenInput.trim());
    setFonnteToken(tokenInput.trim()); setTokenSaved(true); setShowTokenForm(false);
    setTimeout(() => setTokenSaved(false), 3000);
  };

  const kelasList = useMemo(() => Array.from(new Set(students.map(s => s.className))).sort(), [students]);

  useEffect(() => {
    if (lockedKelas) setSelectedKelas(lockedKelas);
    else if (!selectedKelas && kelasList.length > 0) setSelectedKelas(kelasList[0]);
  }, [lockedKelas, kelasList.length]);

  useEffect(() => { setSendStatusMap({}); }, [selectedKelas, periodeFilter]);

  const kelasStudents = useMemo(() =>
    students
      .filter(s => s.className === selectedKelas)
      .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.nis.includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [students, selectedKelas, search]);

  const filteredJournals = useMemo(() => {
    const base = journals.filter(j => j.className === selectedKelas);
    if (periodeFilter === 'harian') return base.filter(j => j.date === getTodayStr());
    if (periodeFilter === 'mingguan') { const { start, end } = getWeekRange(); return base.filter(j => j.date >= start && j.date <= end); }
    const { start, end } = getMonthRange(); return base.filter(j => j.date >= start && j.date <= end);
  }, [journals, selectedKelas, periodeFilter]);

  // ── DATA SINKRON LINTAS GURU ─────────────────────────────────────────────
  // Ambil semua guru yang pernah mengajar di kelas ini dalam periode
  const guruDiKelas = useMemo(() => {
    const map: Record<string, { id: string; name: string; subjects: Set<string>; totalPertemuan: number; lastDate: string }> = {};
    filteredJournals.forEach(j => {
      const tid = j.teacherId ?? 'unknown';
      if (!map[tid]) map[tid] = { id: tid, name: j.teacherName ?? tid, subjects: new Set(), totalPertemuan: 0, lastDate: j.date };
      map[tid].subjects.add(j.subject);
      map[tid].totalPertemuan++;
      if (j.date > map[tid].lastDate) map[tid].lastDate = j.date;
    });
    return Object.values(map).map(g => ({ ...g, subjects: Array.from(g.subjects).sort() }));
  }, [filteredJournals]);

  // ── REKAP PER HARI ──────────────────────────────────────────────────────────
  // Untuk setiap tanggal: per siswa ambil 1 status terbaik dari semua mapel hari itu
  const rekapPerHari = useMemo(() => {
    const kelSiswa = students
      .filter(s => s.className === selectedKelas)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    // byDate[date][studentId] = Set<status>
    const byDate = new Map<string, Map<string, Set<string>>>();
    filteredJournals.forEach(j => {
      if (!j.date) return;
      if (!byDate.has(j.date)) byDate.set(j.date, new Map());
      const dm = byDate.get(j.date)!;
      kelSiswa.forEach(s => {
        const st = j.studentAttendance?.[s.id];
        if (!st) return;
        if (!dm.has(s.id)) dm.set(s.id, new Set());
        dm.get(s.id)!.add(st);
      });
    });

    const pickStatus = (set: Set<string>) => {
      if (set.has('absent'))     return 'absent';
      if (set.has('sick'))       return 'sick';
      if (set.has('permission')) return 'permission';
      if (set.has('present'))    return 'present';
      return 'none';
    };

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dm]) => {
        const siswaData = kelSiswa.map(s => ({
          student: s,
          status: pickStatus(dm.get(s.id) ?? new Set()),
        }));
        const h = siswaData.filter(r => r.status === 'present').length;
        const s = siswaData.filter(r => r.status === 'sick').length;
        const i = siswaData.filter(r => r.status === 'permission').length;
        const a = siswaData.filter(r => r.status === 'absent').length;
        const mapel = Array.from(new Set(
          filteredJournals.filter(j => j.date === date).map(j => j.subject)
        )).join(', ');
        return { date, siswaData, summary: { h, s, i, a }, mapel };
      });
  }, [filteredJournals, students, selectedKelas]);

  // ── REKAP PER MINGGU ─────────────────────────────────────────────────────────
  // Kelompokkan hari-hari ke dalam minggu (Senin-Minggu ISO)
  const rekapPerMinggu = useMemo(() => {
    if (!rekapPerHari.length) return [];
    const kelSiswa = students
      .filter(s => s.className === selectedKelas)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    const getWeekKey = (dateStr: string) => {
      const d = new Date(dateStr);
      const day = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1..Sun=7
      const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
      return mon.toISOString().slice(0, 10); // key = Senin ISO
    };

    const byWeek = new Map<string, typeof rekapPerHari>();
    rekapPerHari.forEach(dayData => {
      const wk = getWeekKey(dayData.date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(dayData);
    });

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monKey, days]) => {
        const sun = new Date(monKey); sun.setDate(sun.getDate() + 6);
        const label = `${new Date(monKey).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} – ${sun.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`;

        const siswaData = kelSiswa.map(s => {
          let h = 0, sk = 0, iz = 0, alp = 0;
          days.forEach(d => {
            const st = d.siswaData.find(r => r.student.id === s.id)?.status;
            if (st === 'present')    h++;
            else if (st === 'sick')  sk++;
            else if (st === 'permission') iz++;
            else if (st === 'absent')     alp++;
          });
          const total = h + sk + iz + alp;
          const pct = total > 0 ? Math.round((h / total) * 100) : 0;
          return { student: s, h, sk, iz, alp, pct };
        });

        const totH   = siswaData.reduce((a, r) => a + r.h,   0);
        const totAlp = siswaData.reduce((a, r) => a + r.alp, 0);
        const avgPct = siswaData.length > 0
          ? Math.round(siswaData.reduce((a, r) => a + r.pct, 0) / siswaData.length)
          : 0;
        return { weekKey: monKey, label, days: days.length, siswaData, totH, totAlp, avgPct };
      });
  }, [rekapPerHari, students, selectedKelas]);

  // ── REKAP BULANAN (semua periode yang aktif) ──────────────────────────────────
  const rekapBulanan = useMemo(() => {
    const kelSiswa = students
      .filter(s => s.className === selectedKelas)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    return kelSiswa.map(s => {
      const byDate = new Map<string, Set<string>>();
      filteredJournals.forEach(j => {
        if (!j.date) return;
        const st = j.studentAttendance?.[s.id];
        if (!st) return;
        if (!byDate.has(j.date)) byDate.set(j.date, new Set());
        byDate.get(j.date)!.add(st);
      });
      let h = 0, sk = 0, iz = 0, alp = 0;
      byDate.forEach(statuses => {
        if (statuses.has('absent'))          alp++;
        else if (statuses.has('sick'))       sk++;
        else if (statuses.has('permission')) iz++;
        else if (statuses.has('present'))    h++;
      });
      const total = h + sk + iz + alp;
      const pct = total > 0 ? Math.round((h / total) * 100) : 0;
      return { student: s, h, sk, iz, alp, pct, totalHari: total };
    });
  }, [filteredJournals, students, selectedKelas]);

  // ── Kontak helpers ────────────────────────────────────────────────────────
  const getEdit = (sid: string) => {
    if (editMap[sid]) return editMap[sid];
    const w = getWali(sid);
    return { namaOrtu: w?.namaOrtu ?? '', noWa: w?.noWa ?? '' };
  };
  const handleChange = (sid: string, field: 'namaOrtu' | 'noWa', value: string) => {
    setEditMap(p => ({ ...p, [sid]: { ...getEdit(sid), [field]: value } }));
    setSavedIds(p => { const n = new Set(p); n.delete(sid); return n; });
  };
  const handleSave = (sid: string) => {
    const d = getEdit(sid);
    upsertWali(sid, d.namaOrtu, d.noWa);
    setSavedIds(p => new Set([...p, sid]));
    setEditMap(p => { const n = { ...p }; delete n[sid]; return n; });
    setTimeout(() => setSavedIds(p => { const n = new Set(p); n.delete(sid); return n; }), 3000);
  };

  const mapelList = useMemo(() => Array.from(new Set(filteredJournals.map(j => j.subject))).sort(), [filteredJournals]);

  const getNilai = useCallback((sid: string, mapel: string) => {
    const vals: number[] = [];
    filteredJournals.filter(j => j.subject === mapel).forEach(j => {
      const g = (j.grades as Record<string, string>)?.[sid];
      if (g !== undefined && g !== '') vals.push(Number(g));
    });
    if (!vals.length) return '-';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }, [filteredJournals]);

  const getAbsensi = useCallback((sid: string) => {
    // Kelompokkan per hari agar 3 mapel dalam 1 hari = 1 hari, bukan 3
    const byDate = new Map<string, Set<string>>();
    filteredJournals.forEach(j => {
      if (!j.date) return;
      const st = j.studentAttendance?.[sid];
      if (!st) return;
      if (!byDate.has(j.date)) byDate.set(j.date, new Set());
      byDate.get(j.date)!.add(st);
    });
    // Per hari ambil 1 status, prioritas: absent > sick > permission > present
    let h = 0, s = 0, i = 0, a = 0;
    byDate.forEach(statuses => {
      if (statuses.has('absent'))          a++;
      else if (statuses.has('sick'))       s++;
      else if (statuses.has('permission')) i++;
      else if (statuses.has('present'))    h++;
    });
    const total = h + s + i + a;
    return { h, s, i, a, total, pct: total ? Math.round((h / total) * 100) : 0 };
  }, [filteredJournals]);

  const getRataRata = useCallback((sid: string) => {
    const vals: number[] = [];
    mapelList.forEach(m => { const v = getNilai(sid, m); if (v !== '-') vals.push(Number(v)); });
    if (!vals.length) return '-';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }, [mapelList, getNilai]);

  const periodeStr = () => {
    if (periodeFilter === 'harian')   return getTodayStr().split('-').reverse().join('/');
    if (periodeFilter === 'mingguan') return getWeekRange().label;
    return getMonthRange().label;
  };

  const buildPesanKehadiran = (student: Student) => {
    const abs  = getAbsensi(student.id);
    const wali = getWali(student.id);
    const sapa = wali?.namaOrtu ? `Yth. Bapak/Ibu ${wali.namaOrtu},` : 'Yth. Bapak/Ibu Orang Tua/Wali,';
    return `${sapa}\n\nBerikut rekap kehadiran putra/putri Bapak/Ibu di SMPN 21 Jambi:\n\n👤 Nama    : ${student.name}\n🏫 Kelas   : ${selectedKelas}\n📅 Periode : ${periodeStr()}\n\n✅ Hadir   : ${abs.h} hari\n🤒 Sakit   : ${abs.s} hari\n📋 Izin    : ${abs.i} hari\n❌ Alpa    : ${abs.a} hari\n📊 % Hadir : ${abs.pct}%\n\nTerima kasih atas perhatian dan kerja samanya.\n_SMPN 21 Jambi_`;
  };

  const buildPesanNilai = (student: Student) => {
    const wali     = getWali(student.id);
    const sapa     = wali?.namaOrtu ? `Yth. Bapak/Ibu ${wali.namaOrtu},` : 'Yth. Bapak/Ibu Orang Tua/Wali,';
    const nilaiStr = mapelList.map(m => `📚 ${m.padEnd(10)}: ${getNilai(student.id, m)}`).join('\n');
    const avg      = getRataRata(student.id);
    return `${sapa}\n\nBerikut rekap nilai putra/putri Bapak/Ibu di SMPN 21 Jambi:\n\n👤 Nama    : ${student.name}\n🏫 Kelas   : ${selectedKelas}\n📅 Periode : ${periodeStr()}\n\n${nilaiStr}\n\n⭐ Rata-rata : ${avg}\n\nTerima kasih atas perhatian dan kerja samanya.\n_SMPN 21 Jambi_`;
  };

  const isSentLocked  = (sid: string) => { const ts = sentTsMap.get(sid); return !!ts && Date.now() - ts < SENT_LOCK_MS; };
  const isBulkLocked  = () => !!bulkSentTs && Date.now() - bulkSentTs < SENT_LOCK_MS;

  const handleSendOne = async (student: Student) => {
    const wali = getWali(student.id);
    if (!wali?.noWa) return;
    if (!fonnteToken) { alert('Token Fonnte belum diatur.'); return; }
    setSendStatusMap(p => ({ ...p, [student.id]: 'sending' }));
    const pesan  = activeTab === 'kontak' ? buildPesanKehadiran(student) : buildPesanNilai(student);
    const result = await sendWhatsApp(fonnteToken, wali.noWa, pesan);
    setSendStatusMap(p => ({ ...p, [student.id]: result.success ? 'success' : 'error' }));
    if (result.success) setSentTsMap(p => { const m = new Map<string, number>(p); m.set(student.id, Date.now()); saveSentTs(m); return m; });
    if (!result.success) alert(`Gagal kirim ke ${student.name}: ${result.reason}`);
    setTimeout(() => setSendStatusMap(p => ({ ...p, [student.id]: 'idle' })), 4000);
  };

  const handleSendAll = async () => {
    if (!fonnteToken) { alert('Token Fonnte belum diatur.'); return; }
    const targets = kelasStudents.filter(s => getWali(s.id)?.noWa);
    if (!targets.length) { alert('Belum ada siswa yang memiliki No. WA orang tua.'); return; }
    if (!confirm(`Kirim laporan ${getPeriodeLabelShort(periodeFilter)} ke ${targets.length} orang tua kelas ${selectedKelas}?`)) return;
    setBulkStatus('sending'); setBulkResult(null);
    let ok = 0, fail = 0;
    for (const student of targets) {
      const wali  = getWali(student.id)!;
      const pesan = activeTab === 'kontak' ? buildPesanKehadiran(student) : buildPesanNilai(student);
      setSendStatusMap(p => ({ ...p, [student.id]: 'sending' }));
      const result = await sendWhatsApp(fonnteToken, wali.noWa, pesan);
      if (result.success) {
        ok++;
        setSendStatusMap(p => ({ ...p, [student.id]: 'success' }));
        setSentTsMap(p => { const m = new Map<string, number>(p); m.set(student.id, Date.now()); saveSentTs(m); return m; });
      } else {
        fail++;
        setSendStatusMap(p => ({ ...p, [student.id]: 'error' }));
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    const now = Date.now(); setBulkSentTs(now); saveBulkSentTs(now);
    setBulkStatus('done'); setBulkResult({ ok, fail });
    setTimeout(() => { setBulkStatus('idle'); setBulkResult(null); setSendStatusMap({}); }, 6000);
  };

  const hasToken          = !!fonnteToken;
  const studentsWithWa    = kelasStudents.filter(s => getWali(s.id)?.noWa);
  const allStudentsWithWa = students.filter(s => getWali(s.id)?.noWa);
  const bulkLocked        = isBulkLocked();
  const bulkCountdown     = bulkSentTs ? formatCountdown(bulkSentTs) : '';

  const handleSendDisiplin = async () => {
    if (!disiplinMsg.trim() || !fonnteToken) return;
    setDisiplinStatus('sending'); setDisiplinResult(null);
    let ok = 0, fail = 0;
    for (const student of allStudentsWithWa) {
      const wali  = getWali(student.id)!;
      const sapa  = wali.namaOrtu ? `Yth. Bapak/Ibu ${wali.namaOrtu},` : 'Yth. Bapak/Ibu Orang Tua/Wali,';
      const pesan = `${sapa}\n\n📢 *Pengumuman Kedisiplinan Siswa*\n🏫 SMPN 21 Jambi\n\n${disiplinMsg.trim()}\n\nMohon perhatian dan kerja samanya.\n_SMPN 21 Jambi_`;
      const result = await sendWhatsApp(fonnteToken, wali.noWa, pesan);
      if (result.success) ok++; else fail++;
      await new Promise(r => setTimeout(r, 1000));
    }
    setDisiplinStatus('done'); setDisiplinResult({ ok, fail });
    setTimeout(() => { setDisiplinStatus('idle'); setDisiplinResult(null); }, 8000);
  };

  const week  = getWeekRange();
  const month = getMonthRange();
  const periodeOptions = [
    { id: 'harian'   as PeriodeFilter, label: 'Hari Ini',   sub: getTodayStr().split('-').reverse().join('/') },
    { id: 'mingguan' as PeriodeFilter, label: 'Minggu Ini', sub: week.label },
    { id: 'bulanan'  as PeriodeFilter, label: 'Bulan Ini',  sub: month.label },
  ];

  const SendAllButton = () => (
    <button onClick={handleSendAll}
      disabled={!studentsWithWa.length || bulkStatus === 'sending' || bulkLocked}
      title={bulkLocked ? `Tunggu ${bulkCountdown} sebelum kirim lagi` : undefined}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {bulkStatus === 'sending' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mengirim...</>
       : bulkLocked ? <><Clock className="w-3.5 h-3.5" />Tunggu {bulkCountdown}</>
       : <><Send className="w-3.5 h-3.5" />Kirim {getPeriodeLabelShort(periodeFilter)} ke Semua ({studentsWithWa.length})</>}
    </button>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  // ── ADMIN VIEW ────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-500" />Kedisiplinan Siswa
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Kirim pengumuman kedisiplinan ke semua orang tua murid.</p>
          </div>
          <button onClick={() => setShowTokenForm(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${fonnteToken ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
            <Settings className="w-4 h-4" />{fonnteToken ? 'Fonnte ✓' : 'Atur Token WA'}
          </button>
        </div>
        {showTokenForm && (
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Settings className="w-4 h-4 text-indigo-500" />Pengaturan Token Fonnte</h3>
              <button onClick={() => setShowTokenForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type={showToken ? 'text' : 'password'} placeholder="Masukkan token Fonnte..." value={tokenInput} onChange={e => setTokenInput(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button onClick={handleSaveToken} disabled={!tokenInput.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> Simpan
              </button>
            </div>
            {tokenSaved && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Token berhasil disimpan!</p>}
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Pesan Kedisiplinan ke Semua Orang Tua</p>
              <p className="text-xs text-amber-700 mt-0.5">Pesan akan dikirim ke <span className="font-bold">{allStudentsWithWa.length} orang tua</span> yang sudah terdaftar nomor WA-nya.</p>
            </div>
          </div>
          <div className="px-5 py-5 space-y-4">
            <textarea className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-slate-900 resize-none" rows={6}
              placeholder="Isi pesan kedisiplinan..." value={disiplinMsg} onChange={e => setDisiplinMsg(e.target.value)} disabled={disiplinStatus === 'sending'} />
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSendDisiplin} disabled={!disiplinMsg.trim() || disiplinStatus === 'sending' || !fonnteToken || allStudentsWithWa.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-50">
                {disiplinStatus === 'sending' ? <><Loader2 className="w-4 h-4 animate-spin" />Mengirim...</> : <><Send className="w-4 h-4" />Kirim ke Semua ({allStudentsWithWa.length})</>}
              </button>
            </div>
            {disiplinResult && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${disiplinResult.fail === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <CheckCheck className="w-4 h-4 flex-shrink-0" />Selesai! <span className="font-bold">{disiplinResult.ok} berhasil</span>{disiplinResult.fail > 0 && <>, <span className="font-bold text-rose-600">{disiplinResult.fail} gagal</span></>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── GURU WALI KELAS VIEW ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />Wali Murid
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Kelola kontak orang tua dan rekap data kelas dari semua guru mapel.</p>
        </div>
        <button onClick={() => setShowTokenForm(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${hasToken ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
          <Settings className="w-4 h-4" />{hasToken ? 'Fonnte ✓' : 'Atur Token WA'}
        </button>
      </div>

      {/* Token form */}
      {showTokenForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Settings className="w-4 h-4 text-indigo-500" />Pengaturan Token Fonnte</h3>
            <button onClick={() => setShowTokenForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type={showToken ? 'text' : 'password'} placeholder="Masukkan token Fonnte..." value={tokenInput} onChange={e => setTokenInput(e.target.value)} className={inputCls} />
              <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={handleSaveToken} disabled={!tokenInput.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
          </div>
          {tokenSaved && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Token berhasil disimpan!</p>}
        </div>
      )}

      {bulkResult && (
        <div className={`px-4 py-3 rounded-xl text-sm border flex items-center gap-2 ${bulkResult.fail === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <CheckCheck className="w-4 h-4 flex-shrink-0" />Selesai! {bulkResult.ok} berhasil{bulkResult.fail > 0 ? `, ${bulkResult.fail} gagal` : ''}.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {([
          { id: 'kontak',      label: 'Kontak Ortu',  icon: Phone },
          { id: 'nilai',       label: 'Rekap Nilai',  icon: Star },
          { id: 'rekap-kelas', label: 'Rekap Kelas',  icon: GraduationCap },
        ] as { id: ActiveTab; label: string; icon: any }[]).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" />{tab.label}
              {tab.id === 'rekap-kelas' && guruDiKelas.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
                  {guruDiKelas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lockedKelas ? (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-sm font-bold text-emerald-700">🏫 Kelas {lockedKelas}</span>
              <span className="text-xs text-emerald-500">(Kelas Anda)</span>
            </div>
          ) : (
            <div className="relative">
              <select value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)} disabled={!kelasList.length}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-slate-50 appearance-none">
                {kelasList.length ? kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>) : <option value="">Belum ada kelas</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Cari nama atau NIS..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
          </div>
        </div>

        {/* Periode */}
        <div className="pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" />Periode Laporan
          </div>
          <div className="grid grid-cols-3 gap-2">
            {periodeOptions.map(opt => (
              <button key={opt.id} onClick={() => setPeriodeFilter(opt.id)}
                className={`flex flex-col items-center py-2.5 px-2 rounded-xl border text-center transition-all ${periodeFilter === opt.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}>
                <span className="text-xs font-bold">{opt.label}</span>
                <span className={`text-[10px] mt-0.5 leading-tight ${periodeFilter === opt.id ? 'text-indigo-200' : 'text-slate-400'}`}>{opt.sub}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {kelasStudents.length} siswa · {studentsWithWa.length} ada No. WA ·{' '}
            <span className={`font-semibold ${filteredJournals.length ? 'text-indigo-600' : 'text-slate-400'}`}>
              {filteredJournals.length} pertemuan
            </span>
            {guruDiKelas.length > 0 && (
              <> · <span className="font-semibold text-emerald-600">{guruDiKelas.length} guru mengajar</span></>
            )}
          </p>
        </div>

        {studentsWithWa.length > 0 && activeTab !== 'rekap-kelas' && (
          <div className="pt-1 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-slate-500">
              Kirim laporan <span className="font-semibold text-indigo-600">{getPeriodeLabelShort(periodeFilter)}</span> sekarang:
              {bulkLocked && <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold"><Clock className="w-3 h-3" />Cooldown {bulkCountdown}</span>}
            </span>
            <SendAllButton />
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB: REKAP KELAS — Sinkron Otomatis dari Semua Guru Mapel
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rekap-kelas' && (
        <div className="space-y-5">

          {/* Banner sinkron */}
          <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">Auto-Sinkron Aktif</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Data kehadiran dikumpulkan dari <strong>{guruDiKelas.length} guru mapel</strong> di kelas <strong>{selectedKelas}</strong>.
                Kehadiran dihitung <strong>per hari</strong> — berapapun mapel yang diajarkan, jika tidak hadir tetap 1 hari.
              </p>
            </div>
          </div>

          {/* Kartu guru yang mengajar */}
          {guruDiKelas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Belum ada jurnal dari guru mapel untuk periode ini.</p>
              <p className="text-slate-400 text-sm mt-1">Coba ganti periode ke "Bulan Ini".</p>
            </div>
          ) : (
            <>
              {/* Daftar guru */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-400" />Guru Mapel di Kelas {selectedKelas}
                  <span className="text-xs font-normal text-slate-400 lowercase">({getPeriodeLabelShort(periodeFilter)})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {guruDiKelas.map(g => (
                    <div key={g.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm">
                      <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm uppercase flex-shrink-0">
                        {g.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{g.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {g.subjects.map(s => (
                            <span key={s} className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100">{s}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{g.totalPertemuan} pertemuan · terakhir {g.lastDate.split('-').reverse().join('/')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Rekap Kehadiran: sub-tab Harian / Mingguan / Bulanan ── */}
              <div className="space-y-3">
                {/* Header + sub-tab switcher */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />Rekap Kehadiran Kelas
                    <span className="text-xs font-normal text-slate-400 lowercase">(per hari · lintas mapel)</span>
                  </h3>
                  {/* Sub-tab pills */}
                  <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                    {(['harian','mingguan','bulanan'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => { setRekapView(v); setExpandedPeriod(new Set()); }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                          rekapView === v
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {v === 'harian' ? 'Per Hari' : v === 'mingguan' ? 'Per Minggu' : 'Bulanan'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ─────────────────────────────
                    VIEW: PER HARI
                ───────────────────────────── */}
                {rekapView === 'harian' && (
                  rekapPerHari.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                      <p className="text-slate-400 text-sm">Tidak ada data untuk periode ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-end gap-3 pb-1">
                        <button onClick={() => setExpandedPeriod(new Set(rekapPerHari.map(d => d.date)))} className="text-xs text-indigo-600 font-semibold hover:underline">Buka Semua</button>
                        <button onClick={() => setExpandedPeriod(new Set())} className="text-xs text-slate-400 font-semibold hover:underline">Tutup Semua</button>
                      </div>
                      {rekapPerHari.map(({ date, siswaData, summary, mapel }) => {
                        const isOpen = expandedPeriod.has(date);
                        const toggle = () => setExpandedPeriod(prev => { const n = new Set(prev); isOpen ? n.delete(date) : n.add(date); return n; });
                        const fmt = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                        return (
                          <div key={date} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isOpen ? 'border-indigo-200' : 'border-slate-200'}`}>
                            <button type="button" onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors select-none">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-indigo-600' : 'bg-indigo-50'}`}>
                                  <Calendar className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-indigo-500'}`} />
                                </div>
                                <div className="text-left min-w-0">
                                  <p className={`text-sm font-bold ${isOpen ? 'text-indigo-700' : 'text-slate-900'}`}>{fmt}</p>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{mapel || 'Tidak ada mapel'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{summary.h} H</span>
                                  {summary.s > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{summary.s} S</span>}
                                  {summary.i > 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{summary.i} I</span>}
                                  {summary.a > 0 && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">{summary.a} A</span>}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                              </div>
                            </button>
                            {isOpen && (
                              <div className="border-t border-slate-100 overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase w-8">No</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Nama Siswa</th>
                                      <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {siswaData.map((row, idx) => {
                                      const STATUS_LABEL: Record<string,{label:string;cls:string}> = {
                                        present:    { label: 'Hadir',  cls: 'bg-emerald-100 text-emerald-700' },
                                        sick:       { label: 'Sakit',  cls: 'bg-amber-100 text-amber-700' },
                                        permission: { label: 'Izin',   cls: 'bg-blue-100 text-blue-700' },
                                        absent:     { label: 'Alpa',   cls: 'bg-rose-100 text-rose-700' },
                                        none:       { label: '—',      cls: 'bg-slate-100 text-slate-400' },
                                      };
                                      const s = STATUS_LABEL[row.status] ?? STATUS_LABEL.none;
                                      return (
                                        <tr key={row.student.id} className={`hover:bg-indigo-50/20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                          <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{idx + 1}</td>
                                          <td className="px-4 py-2.5">
                                            <p className="text-sm font-medium text-slate-900">{row.student.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{row.student.nis}</p>
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold ${s.cls}`}>{s.label}</span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                                      <td colSpan={2} className="px-4 py-2 text-[10px] font-bold text-indigo-700 uppercase">Total</td>
                                      <td className="px-4 py-2 text-center">
                                        <span className="text-[10px] font-bold text-indigo-600">
                                          {summary.h}H · {summary.s}S · {summary.i}I · {summary.a}A
                                        </span>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* ─────────────────────────────
                    VIEW: PER MINGGU
                ───────────────────────────── */}
                {rekapView === 'mingguan' && (
                  rekapPerMinggu.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                      <p className="text-slate-400 text-sm">Tidak ada data untuk periode ini.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-end gap-3 pb-1">
                        <button onClick={() => setExpandedPeriod(new Set(rekapPerMinggu.map(w => w.weekKey)))} className="text-xs text-indigo-600 font-semibold hover:underline">Buka Semua</button>
                        <button onClick={() => setExpandedPeriod(new Set())} className="text-xs text-slate-400 font-semibold hover:underline">Tutup Semua</button>
                      </div>
                      {rekapPerMinggu.map(({ weekKey, label, days, siswaData, totH, totAlp, avgPct }) => {
                        const isOpen = expandedPeriod.has(weekKey);
                        const toggle = () => setExpandedPeriod(prev => { const n = new Set(prev); isOpen ? n.delete(weekKey) : n.add(weekKey); return n; });
                        return (
                          <div key={weekKey} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isOpen ? 'border-indigo-200' : 'border-slate-200'}`}>
                            <button type="button" onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors select-none">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-indigo-600' : 'bg-slate-100'}`}>
                                  <CalendarDays className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-slate-500'}`} />
                                </div>
                                <div className="text-left min-w-0">
                                  <p className={`text-sm font-bold ${isOpen ? 'text-indigo-700' : 'text-slate-900'}`}>{label}</p>
                                  <p className="text-[10px] text-slate-400">{days} hari belajar</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${avgPct >= 75 ? 'bg-emerald-100 text-emerald-700' : avgPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                  Rata {avgPct}%
                                </span>
                                <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                                  <span className="text-emerald-600">{totH}H</span>
                                  {totAlp > 0 && <><span className="text-slate-300">/</span><span className="text-rose-600">{totAlp}A</span></>}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                              </div>
                            </button>
                            {isOpen && (
                              <div className="border-t border-slate-100">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase w-8">No</th>
                                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">Nama Siswa</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-emerald-600 uppercase">H</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-amber-600 uppercase">S</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-blue-600 uppercase">I</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-rose-600 uppercase">A</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">% Hadir</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {siswaData.map((row, idx) => (
                                        <tr key={row.student.id} className={`hover:bg-indigo-50/20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                          <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{idx + 1}</td>
                                          <td className="px-4 py-2.5">
                                            <p className="text-sm font-medium text-slate-900">{row.student.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{row.student.nis}</p>
                                          </td>
                                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{row.h}</td>
                                          <td className="px-3 py-2.5 text-center font-bold text-amber-600">{row.sk}</td>
                                          <td className="px-3 py-2.5 text-center font-bold text-blue-600">{row.iz}</td>
                                          <td className="px-3 py-2.5 text-center font-bold text-rose-600">{row.alp}</td>
                                          <td className="px-3 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <div className="flex-1 max-w-[50px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-full rounded-full ${row.pct >= 75 ? 'bg-emerald-500' : row.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${row.pct}%` }} />
                                              </div>
                                              <span className={`text-[10px] font-bold w-8 text-right ${row.pct >= 75 ? 'text-emerald-700' : row.pct >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>{row.pct}%</span>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                                        <td colSpan={2} className="px-4 py-2 text-[10px] font-bold text-indigo-700 uppercase">Total Kelas</td>
                                        {(['h','sk','iz','alp'] as const).map(k => (
                                          <td key={k} className="px-3 py-2 text-center text-xs font-bold text-indigo-600">
                                            {siswaData.reduce((a, r) => a + r[k], 0)}
                                          </td>
                                        ))}
                                        <td className="px-3 py-2 text-center">
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${avgPct >= 75 ? 'bg-emerald-100 text-emerald-700' : avgPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{avgPct}%</span>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* ─────────────────────────────
                    VIEW: BULANAN (ringkasan keseluruhan)
                ───────────────────────────── */}
                {rekapView === 'bulanan' && (
                  rekapBulanan.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                      <p className="text-slate-400 text-sm">Tidak ada data untuk periode ini.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Summary kelas */}
                      <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex-wrap">
                        {[
                          { label: 'Total Hari', val: rekapPerHari.length,                                                          cls: 'bg-white text-indigo-700 border border-indigo-200' },
                          { label: 'Hadir',      val: rekapBulanan.reduce((a, r) => a + r.h,   0),                                  cls: 'bg-emerald-100 text-emerald-700' },
                          { label: 'Sakit',      val: rekapBulanan.reduce((a, r) => a + r.sk,  0),                                  cls: 'bg-amber-100 text-amber-700' },
                          { label: 'Izin',       val: rekapBulanan.reduce((a, r) => a + r.iz,  0),                                  cls: 'bg-blue-100 text-blue-700' },
                          { label: 'Alpa',       val: rekapBulanan.reduce((a, r) => a + r.alp, 0),                                  cls: 'bg-rose-100 text-rose-700' },
                          { label: '% Rata Kelas', val: `${rekapBulanan.length > 0 ? Math.round(rekapBulanan.reduce((a,r) => a+r.pct,0)/rekapBulanan.length) : 0}%`,
                            cls: (() => { const p = rekapBulanan.length > 0 ? Math.round(rekapBulanan.reduce((a,r)=>a+r.pct,0)/rekapBulanan.length) : 0; return p>=75?'bg-emerald-100 text-emerald-700':p>=50?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'; })() },
                        ].map(item => (
                          <div key={item.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${item.cls}`}>
                            <span className="opacity-60">{item.label}</span><span>{item.val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase w-8">No</th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">Nama Siswa</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold text-emerald-600 uppercase">H</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold text-amber-600 uppercase">S</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold text-blue-600 uppercase">I</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold text-rose-600 uppercase">A</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">Total Hari</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">% Hadir</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {rekapBulanan.map((row, idx) => (
                              <tr key={row.student.id} className={`hover:bg-indigo-50/20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                <td className="px-3 py-2.5 text-xs text-slate-400 text-center">{idx + 1}</td>
                                <td className="px-4 py-2.5">
                                  <p className="text-sm font-medium text-slate-900">{row.student.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">{row.student.nis}</p>
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{row.h}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-amber-600">{row.sk}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-blue-600">{row.iz}</td>
                                <td className="px-3 py-2.5 text-center font-bold text-rose-600">{row.alp}</td>
                                <td className="px-3 py-2.5 text-center text-slate-600 font-semibold">{row.totalHari}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="flex-1 max-w-[50px] bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                      <div className={`h-full rounded-full ${row.pct >= 75 ? 'bg-emerald-500' : row.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${row.pct}%` }} />
                                    </div>
                                    <span className={`text-[10px] font-bold w-8 text-right ${row.pct >= 75 ? 'text-emerald-700' : row.pct >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>{row.pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                              <td colSpan={2} className="px-4 py-2 text-[10px] font-bold text-indigo-700 uppercase">Total Kelas</td>
                              {(['h','sk','iz','alp'] as const).map(k => (
                                <td key={k} className="px-3 py-2 text-center text-xs font-bold text-indigo-600">
                                  {rekapBulanan.reduce((a, r) => a + r[k], 0)}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center text-xs font-bold text-indigo-600">
                                {rekapBulanan.reduce((a, r) => a + r.totalHari, 0)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {(() => {
                                  const p = rekapBulanan.length > 0 ? Math.round(rekapBulanan.reduce((a,r) => a + r.pct, 0) / rekapBulanan.length) : 0;
                                  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${p >= 75 ? 'bg-emerald-100 text-emerald-700' : p >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{p}%</span>;
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                )}

              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB KONTAK ─────────────────────────────────────────────── */}
      {activeTab === 'kontak' && (
        !kelasStudents.length ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada siswa di kelas ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-xs text-indigo-700 font-medium">
                Tombol (➤) mengirim rekap kehadiran <strong>{getPeriodeLabelShort(periodeFilter)}</strong> ke orang tua. Lock 15 menit setelah terkirim.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {kelasStudents.map((student, idx) => {
                const edit    = getEdit(student.id);
                const saved   = savedIds.has(student.id);
                const isDirty = !!editMap[student.id];
                const wali    = getWali(student.id);
                const hasWa   = !!wali?.noWa;
                const status  = sendStatusMap[student.id] ?? 'idle';
                const isSent  = isSentLocked(student.id);
                const countdown = sentTsMap.get(student.id) ? formatCountdown(sentTsMap.get(student.id)!) : '';
                return (
                  <div key={student.id} className={`px-5 py-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">{idx + 1}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{student.nis}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isSent && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200"><CheckCheck className="w-3 h-3" />Terkirim · {countdown}</span>}
                        {hasWa && !isDirty && !saved && !isSent && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Tersimpan</span>}
                        {saved && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 animate-pulse"><CheckCircle2 className="w-3 h-3" />Disimpan!</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Orang Tua</label>
                        <input className={inputCls} placeholder="Cth: Bapak Ahmad" value={edit.namaOrtu} onChange={e => handleChange(student.id, 'namaOrtu', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">No. WhatsApp</label>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 font-mono whitespace-nowrap">+62</span>
                          <input className={inputCls} placeholder="8123456789" value={edit.noWa} onChange={e => handleChange(student.id, 'noWa', e.target.value.replace(/\D/g, ''))} />
                        </div>
                      </div>
                      <button onClick={() => handleSave(student.id)} disabled={!isDirty}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                        <Save className="w-3.5 h-3.5" />Simpan
                      </button>
                      <button onClick={() => handleSendOne(student)}
                        disabled={!hasWa || isSent || status === 'sending' || bulkStatus === 'sending'}
                        title={!hasWa ? 'No. WA belum diisi' : isSent ? `Terkirim, tunggu ${countdown}` : `Kirim rekap ${getPeriodeLabelShort(periodeFilter)}`}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                          isSent ? 'bg-blue-500 text-white cursor-not-allowed' :
                          status === 'error' ? 'bg-rose-500 text-white' :
                          status === 'sending' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                          hasWa ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        }`}>
                        {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : isSent ? <CheckCheck className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500"><span className="font-bold text-emerald-700">{studentsWithWa.length}</span>/{kelasStudents.length} siswa sudah ada No. WA</p>
              <SendAllButton />
            </div>
          </div>
        )
      )}

      {/* ── TAB REKAP NILAI ─────────────────────────────────────────── */}
      {activeTab === 'nilai' && (
        !kelasStudents.length ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada siswa di kelas ini.</p>
          </div>
        ) : !mapelList.length ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada jurnal untuk periode ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-700">
                    <th className="px-3 py-3 text-[10px] font-bold text-white uppercase tracking-wider sticky left-0 bg-indigo-700 w-8 text-left">No</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-white uppercase tracking-wider sticky left-8 bg-indigo-700 min-w-[160px] text-left">Nama Siswa</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-emerald-300 uppercase tracking-wider text-center">H</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-amber-300 uppercase tracking-wider text-center">S</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-blue-300 uppercase tracking-wider text-center">I</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-rose-300 uppercase tracking-wider text-center">A</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-indigo-200 uppercase tracking-wider text-center">%</th>
                    {mapelList.map(m => <th key={m} className="px-3 py-3 text-[10px] font-bold text-white uppercase tracking-wider text-center min-w-[80px]">{m}</th>)}
                    <th className="px-3 py-3 text-[10px] font-bold text-amber-300 uppercase tracking-wider text-center min-w-[80px]">Rata-rata</th>
                    <th className="px-3 py-3 text-[10px] font-bold text-emerald-300 uppercase tracking-wider text-center">Kirim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kelasStudents.map((student, idx) => {
                    const abs    = getAbsensi(student.id);
                    const avg    = getRataRata(student.id);
                    const avgNum = avg === '-' ? null : Number(avg);
                    const rowBg  = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                    const wali   = getWali(student.id);
                    const hasWa  = !!wali?.noWa;
                    const status = sendStatusMap[student.id] ?? 'idle';
                    const isSent = isSentLocked(student.id);
                    const countdown = sentTsMap.get(student.id) ? formatCountdown(sentTsMap.get(student.id)!) : '';
                    return (
                      <tr key={student.id} className={`${rowBg} hover:bg-indigo-50/20 transition-colors`}>
                        <td className="px-3 py-3 text-slate-400 text-xs text-center sticky left-0 bg-inherit">{idx + 1}</td>
                        <td className="px-3 py-3 sticky left-8 bg-inherit">
                          <p className="font-semibold text-slate-900 text-sm">{student.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{student.nis}</p>
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-700">{abs.h}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-600">{abs.s}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-600">{abs.i}</td>
                        <td className="px-3 py-3 text-center font-bold text-rose-600">{abs.a}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${abs.pct >= 75 ? 'bg-emerald-100 text-emerald-700' : abs.pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{abs.pct}%</span>
                        </td>
                        {mapelList.map(mapel => {
                          const val = getNilai(student.id, mapel);
                          const num = val === '-' ? null : Number(val);
                          return <td key={mapel} className="px-3 py-3 text-center"><span className={`text-sm font-bold ${num === null ? 'text-slate-300' : num >= 75 ? 'text-emerald-700' : num >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>{val}</span></td>;
                        })}
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm font-black ${avgNum === null ? 'text-slate-300' : avgNum >= 75 ? 'text-emerald-700' : avgNum >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>{avg}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => handleSendOne(student)}
                            disabled={!hasWa || isSent || status === 'sending' || bulkStatus === 'sending'}
                            title={!hasWa ? 'No. WA belum diisi' : isSent ? `Tunggu ${countdown}` : `Kirim laporan ${getPeriodeLabelShort(periodeFilter)}`}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                              isSent ? 'bg-blue-500 text-white cursor-not-allowed' :
                              status === 'error' ? 'bg-rose-500 text-white' :
                              status === 'sending' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                              hasWa ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}>
                            {status === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSent ? <CheckCheck className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">{mapelList.length} mapel · {kelasStudents.length} siswa · <span className="font-semibold text-indigo-600">{getPeriodeLabelShort(periodeFilter)}</span></p>
              <SendAllButton />
            </div>
          </div>
        )
      )}
    </div>
  );
}