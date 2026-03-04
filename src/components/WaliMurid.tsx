import { useState, useMemo, useCallback, useEffect } from 'react';
import { Student } from '../hooks/useStudents';
import { WaliMurid as WaliMuridType, useWaliMurid } from '../hooks/useWaliMurid';
import { JournalEntry } from '../types';
import { redis } from '../lib/redis';
import {
  Phone, Users, BookOpen, Search, Save,
  ChevronDown, Star, CheckCircle2, Send,
  Settings, Eye, EyeOff, Loader2, X, CheckCheck,
  CalendarDays,
} from 'lucide-react';

type WaliMuridProps = {
  students: Student[];
  journals: JournalEntry[];
  lockedKelas?: string;
};

type ActiveTab = 'kontak' | 'nilai';
type PeriodeFilter = 'harian' | 'mingguan' | 'semua';
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 transition-colors';

const FONNTE_TOKEN_KEY = 'jurnal-guru:fonnte-token';

// ── Helpers periode ────────────────────────────────────────────────────────────
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: getTodayStr() };
}

function getPeriodeLabel(p: PeriodeFilter): string {
  if (p === 'harian')   return 'Hari Ini';
  if (p === 'mingguan') return 'Minggu Ini';
  return 'Semua Waktu';
}

// ── Fonnte sender ─────────────────────────────────────────────────────────────
async function sendWhatsApp(token: string, noWa: string, message: string): Promise<{ success: boolean; reason?: string }> {
  try {
    const formData = new FormData();
    formData.append('target', noWa);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });
    const json = await res.json();
    if (json.status === true) return { success: true };
    return { success: false, reason: json.reason ?? 'Gagal mengirim' };
  } catch (e) {
    return { success: false, reason: 'Koneksi gagal' };
  }
}

export function WaliMurid({ students, journals, lockedKelas }: WaliMuridProps) {
  const { waliList, loading, upsertWali, getWali } = useWaliMurid();

  const [activeTab, setActiveTab]         = useState<ActiveTab>('kontak');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [search, setSearch]               = useState('');
  const [editMap, setEditMap]             = useState<Record<string, { namaOrtu: string; noWa: string }>>({});
  const [savedIds, setSavedIds]           = useState<Set<string>>(new Set());

  // ── Filter Periode ─────────────────────────────────────────────────────────
  const [periodeFilter, setPeriodeFilter] = useState<PeriodeFilter>('semua');

  // Fonnte
  const [fonnteToken, setFonnteToken]     = useState('');
  const [tokenInput, setTokenInput]       = useState('');
  const [showToken, setShowToken]         = useState(false);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenSaved, setTokenSaved]       = useState(false);
  const [sendStatusMap, setSendStatusMap] = useState<Record<string, SendStatus>>({});
  const [bulkStatus, setBulkStatus]       = useState<'idle' | 'sending' | 'done'>('idle');
  const [bulkResult, setBulkResult]       = useState<{ ok: number; fail: number } | null>(null);

  // Load token dari Redis
  useEffect(() => {
    redis.get<string>(FONNTE_TOKEN_KEY).then(t => {
      if (t) { setFonnteToken(t); setTokenInput(t); }
    }).catch(() => {});
  }, []);

  const handleSaveToken = async () => {
    await redis.set(FONNTE_TOKEN_KEY, tokenInput.trim());
    setFonnteToken(tokenInput.trim());
    setTokenSaved(true);
    setShowTokenForm(false);
    setTimeout(() => setTokenSaved(false), 3000);
  };

  // Kelas unik
  const kelasList = useMemo(() =>
    Array.from(new Set(students.map(s => s.className))).sort(), [students]);

  useEffect(() => {
    if (lockedKelas) setSelectedKelas(lockedKelas);
    else if (!selectedKelas && kelasList.length > 0) setSelectedKelas(kelasList[0]);
  }, [lockedKelas, kelasList.length]);

  // Siswa di kelas terpilih
  const kelasStudents = useMemo(() =>
    students
      .filter(s => s.className === selectedKelas)
      .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.nis.includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [students, selectedKelas, search]);

  // ── Jurnal terfilter berdasarkan kelas + periode ───────────────────────────
  const filteredJournals = useMemo(() => {
    const base = journals.filter(j => j.className === selectedKelas);
    if (periodeFilter === 'harian') {
      const today = getTodayStr();
      return base.filter(j => j.date === today);
    }
    if (periodeFilter === 'mingguan') {
      const { start, end } = getWeekRange();
      return base.filter(j => j.date >= start && j.date <= end);
    }
    return base; // semua
  }, [journals, selectedKelas, periodeFilter]);

  // ── Kontak handlers ───────────────────────────────────────────────────────
  const getEdit = (studentId: string) => {
    if (editMap[studentId]) return editMap[studentId];
    const wali = getWali(studentId);
    return { namaOrtu: wali?.namaOrtu ?? '', noWa: wali?.noWa ?? '' };
  };

  const handleChange = (studentId: string, field: 'namaOrtu' | 'noWa', value: string) => {
    setEditMap(prev => ({ ...prev, [studentId]: { ...getEdit(studentId), [field]: value } }));
    setSavedIds(prev => { const n = new Set(prev); n.delete(studentId); return n; });
  };

  const handleSave = (studentId: string) => {
    const data = getEdit(studentId);
    upsertWali(studentId, data.namaOrtu, data.noWa);
    setSavedIds(prev => new Set([...prev, studentId]));
    setEditMap(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    setTimeout(() => setSavedIds(prev => { const n = new Set(prev); n.delete(studentId); return n; }), 3000);
  };

  const hasChange = (studentId: string) => !!editMap[studentId];

  // ── Rekap nilai ───────────────────────────────────────────────────────────
  const mapelList = useMemo(() =>
    Array.from(new Set(filteredJournals.map(j => j.subject))).sort(),
    [filteredJournals]);

  const getNilai = useCallback((studentId: string, mapel: string): string => {
    const relevant = filteredJournals.filter(j => j.subject === mapel);
    const values: number[] = [];
    relevant.forEach(j => {
      const grade = (j.grades as Record<string, string>)?.[studentId];
      if (grade !== undefined && grade !== '') values.push(Number(grade));
    });
    if (values.length === 0) return '-';
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  }, [filteredJournals]);

  const getAbsensi = useCallback((studentId: string) => {
    let h = 0, s = 0, i = 0, a = 0;
    filteredJournals.forEach(j => {
      const st = j.studentAttendance?.[studentId];
      if (st === 'present') h++;
      else if (st === 'sick') s++;
      else if (st === 'permission') i++;
      else if (st === 'absent') a++;
    });
    const total = h + s + i + a;
    const pct = total ? Math.round((h / total) * 100) : 0;
    return { h, s, i, a, total, pct };
  }, [filteredJournals]);

  const getRataRata = useCallback((studentId: string): string => {
    const values: number[] = [];
    mapelList.forEach(mapel => {
      const val = getNilai(studentId, mapel);
      if (val !== '-') values.push(Number(val));
    });
    if (values.length === 0) return '-';
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  }, [mapelList, getNilai]);

  // ── Buat pesan kehadiran ──────────────────────────────────────────────────
  const buildPesanKehadiran = (student: Student): string => {
    const abs = getAbsensi(student.id);
    const wali = getWali(student.id);
    const sapaan = wali?.namaOrtu ? `Yth. Bapak/Ibu ${wali.namaOrtu},` : 'Yth. Bapak/Ibu Orang Tua/Wali,';
    const periodeLabel = getPeriodeLabel(periodeFilter);
    return (
`${sapaan}

Berikut rekap kehadiran putra/putri Bapak/Ibu di SMPN 21 Jambi:

👤 Nama    : ${student.name}
🏫 Kelas   : ${selectedKelas}
📅 Periode : ${periodeLabel}

✅ Hadir   : ${abs.h} kali
🤒 Sakit   : ${abs.s} kali
📋 Izin    : ${abs.i} kali
❌ Alpa    : ${abs.a} kali
📊 % Hadir : ${abs.pct}%

Terima kasih atas perhatiannya.
_SMPN 21 Jambi_`
    );
  };

  // ── Buat pesan nilai ──────────────────────────────────────────────────────
  const buildPesanNilai = (student: Student): string => {
    const wali = getWali(student.id);
    const sapaan = wali?.namaOrtu ? `Yth. Bapak/Ibu ${wali.namaOrtu},` : 'Yth. Bapak/Ibu Orang Tua/Wali,';
    const periodeLabel = getPeriodeLabel(periodeFilter);
    const nilaiLines = mapelList.map(m => {
      const val = getNilai(student.id, m);
      return `📚 ${m.padEnd(10)}: ${val}`;
    }).join('\n');
    const avg = getRataRata(student.id);
    return (
`${sapaan}

Berikut rekap nilai putra/putri Bapak/Ibu di SMPN 21 Jambi:

👤 Nama    : ${student.name}
🏫 Kelas   : ${selectedKelas}
📅 Periode : ${periodeLabel}

${nilaiLines}

⭐ Rata-rata : ${avg}

Terima kasih atas perhatiannya.
_SMPN 21 Jambi_`
    );
  };

  // ── Kirim WA satu siswa ───────────────────────────────────────────────────
  const handleSendOne = async (student: Student) => {
    const wali = getWali(student.id);
    if (!wali?.noWa) return;
    if (!fonnteToken) { alert('Token Fonnte belum diatur. Klik ikon ⚙ untuk mengatur token.'); return; }

    setSendStatusMap(prev => ({ ...prev, [student.id]: 'sending' }));
    const pesan = activeTab === 'kontak' ? buildPesanKehadiran(student) : buildPesanNilai(student);
    const result = await sendWhatsApp(fonnteToken, wali.noWa, pesan);
    setSendStatusMap(prev => ({ ...prev, [student.id]: result.success ? 'success' : 'error' }));
    if (!result.success) alert(`Gagal kirim ke ${student.name}: ${result.reason}`);
    setTimeout(() => setSendStatusMap(prev => ({ ...prev, [student.id]: 'idle' })), 4000);
  };

  // ── Kirim WA ke semua ─────────────────────────────────────────────────────
  const handleSendAll = async () => {
    if (!fonnteToken) { alert('Token Fonnte belum diatur. Klik ikon ⚙ untuk mengatur token.'); return; }
    const targets = kelasStudents.filter(s => getWali(s.id)?.noWa);
    if (targets.length === 0) { alert('Belum ada siswa yang memiliki No. WA orang tua.'); return; }
    if (!confirm(`Kirim pesan WhatsApp (${getPeriodeLabel(periodeFilter)}) ke ${targets.length} orang tua siswa kelas ${selectedKelas}?`)) return;

    setBulkStatus('sending');
    setBulkResult(null);
    let ok = 0, fail = 0;

    for (const student of targets) {
      const wali = getWali(student.id)!;
      const pesan = activeTab === 'kontak' ? buildPesanKehadiran(student) : buildPesanNilai(student);
      setSendStatusMap(prev => ({ ...prev, [student.id]: 'sending' }));
      const result = await sendWhatsApp(fonnteToken, wali.noWa, pesan);
      if (result.success) { ok++; setSendStatusMap(prev => ({ ...prev, [student.id]: 'success' })); }
      else { fail++; setSendStatusMap(prev => ({ ...prev, [student.id]: 'error' })); }
      await new Promise(r => setTimeout(r, 1000));
    }

    setBulkStatus('done');
    setBulkResult({ ok, fail });
    setTimeout(() => {
      setBulkStatus('idle');
      setBulkResult(null);
      setSendStatusMap({});
    }, 6000);
  };

  const hasToken = !!fonnteToken;
  const studentsWithWa = kelasStudents.filter(s => getWali(s.id)?.noWa);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Wali Murid
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Kelola kontak orang tua dan pantau rekap nilai siswa per kelas.
          </p>
        </div>
        <button
          onClick={() => setShowTokenForm(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            hasToken
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          }`}
          title="Pengaturan Token Fonnte"
        >
          <Settings className="w-4 h-4" />
          {hasToken ? 'Fonnte ✓' : 'Atur Token WA'}
        </button>
      </div>

      {/* Form Token Fonnte */}
      {showTokenForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              Pengaturan Token Fonnte
            </h3>
            <button onClick={() => setShowTokenForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Dapatkan token di <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">fonnte.com</a> → Dashboard → Device → Token.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="Masukkan token Fonnte..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveToken}
              disabled={!tokenInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
          </div>
          {tokenSaved && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Token berhasil disimpan!
            </p>
          )}
        </div>
      )}

      {/* Notifikasi bulk selesai */}
      {bulkResult && (
        <div className={`px-4 py-3 rounded-xl text-sm border flex items-center gap-2 ${
          bulkResult.fail === 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <CheckCheck className="w-4 h-4 flex-shrink-0" />
          Selesai! {bulkResult.ok} berhasil dikirim{bulkResult.fail > 0 ? `, ${bulkResult.fail} gagal` : ''}.
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: 'kontak', label: 'Kontak Ortu', icon: Phone },
          { id: 'nilai',  label: 'Rekap Nilai', icon: Star },
        ] as { id: ActiveTab; label: string; icon: any }[]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter kelas + search + PERIODE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lockedKelas ? (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-sm font-bold text-emerald-700">🏫 Kelas {lockedKelas}</span>
              <span className="text-xs text-emerald-500">(Kelas Anda)</span>
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedKelas}
                onChange={e => setSelectedKelas(e.target.value)}
                disabled={kelasList.length === 0}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-slate-50 appearance-none"
              >
                {kelasList.length > 0
                  ? kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)
                  : <option value="">Belum ada kelas</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama atau NIS..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
          </div>
        </div>

        {/* ── Pilihan Periode Laporan ────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" />
            Periode Laporan:
          </div>
          <div className="flex gap-1.5">
            {([
              { id: 'harian',   label: 'Hari Ini' },
              { id: 'mingguan', label: 'Minggu Ini' },
              { id: 'semua',    label: 'Semua' },
            ] as { id: PeriodeFilter; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriodeFilter(opt.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  periodeFilter === opt.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {periodeFilter !== 'semua' && (
            <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
              {filteredJournals.length} pertemuan ditemukan
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400">
          {kelasStudents.length} siswa di kelas {selectedKelas}
          {studentsWithWa.length > 0 && ` · ${studentsWithWa.length} sudah ada No. WA`}
        </p>
      </div>

      {/* ── TAB KONTAK ──────────────────────────────────────────────────── */}
      {activeTab === 'kontak' && (
        kelasStudents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada siswa di kelas ini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-xs text-indigo-700 font-medium">
                Input No. WA orang tua. Klik ikon kirim (➤) untuk notifikasi kehadiran <strong>{getPeriodeLabel(periodeFilter)}</strong> ke masing-masing orang tua.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {kelasStudents.map((student, idx) => {
                const edit   = getEdit(student.id);
                const saved  = savedIds.has(student.id);
                const isDirty = hasChange(student.id);
                const wali   = getWali(student.id);
                const hasWa  = !!wali?.noWa;
                const status = sendStatusMap[student.id] ?? 'idle';

                return (
                  <div key={student.id} className={`px-5 py-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{student.nis}</p>
                        </div>
                      </div>
                      {hasWa && !isDirty && !saved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Tersimpan
                        </span>
                      )}
                      {saved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 animate-pulse">
                          <CheckCircle2 className="w-3 h-3" /> Disimpan!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Orang Tua</label>
                        <input
                          className={inputCls}
                          placeholder="Cth: Bapak Ahmad"
                          value={edit.namaOrtu}
                          onChange={e => handleChange(student.id, 'namaOrtu', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">No. WhatsApp</label>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 font-mono whitespace-nowrap">+62</span>
                          <input
                            className={inputCls}
                            placeholder="8123456789"
                            value={edit.noWa}
                            onChange={e => handleChange(student.id, 'noWa', e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleSave(student.id)}
                        disabled={!isDirty}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan
                      </button>
                      <button
                        onClick={() => handleSendOne(student)}
                        disabled={!hasWa || status === 'sending' || bulkStatus === 'sending'}
                        title={!hasWa ? 'No. WA belum diisi' : `Kirim rekap kehadiran ${getPeriodeLabel(periodeFilter)} via WA`}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                          status === 'success' ? 'bg-emerald-500 text-white' :
                          status === 'error'   ? 'bg-rose-500 text-white' :
                          status === 'sending' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                          hasWa ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                          'bg-slate-100 text-slate-300 cursor-not-allowed'
                        }`}
                      >
                        {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                         status === 'success'  ? <CheckCheck className="w-4 h-4" /> :
                         <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                <span className="font-bold text-emerald-700">{studentsWithWa.length}</span>
                /{kelasStudents.length} siswa sudah ada No. WA ortu
              </p>
              <button
                onClick={handleSendAll}
                disabled={studentsWithWa.length === 0 || bulkStatus === 'sending'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkStatus === 'sending'
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mengirim...</>
                  : <><Send className="w-3.5 h-3.5" />Kirim WA {getPeriodeLabel(periodeFilter)} ke Semua ({studentsWithWa.length})</>}
              </button>
            </div>
          </div>
        )
      )}

      {/* ── TAB REKAP NILAI ──────────────────────────────────────────────── */}
      {activeTab === 'nilai' && (
        kelasStudents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada siswa di kelas ini.</p>
          </div>
        ) : mapelList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Belum ada nilai untuk periode ini.</p>
            <p className="text-slate-400 text-sm mt-1">
              {periodeFilter !== 'semua'
                ? `Coba ganti periode ke "Semua" atau pastikan ada jurnal di periode ${getPeriodeLabel(periodeFilter)}.`
                : 'Guru perlu input nilai di menu Penilaian terlebih dahulu.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-700">
                    <th className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider sticky left-0 bg-indigo-700 w-8">No</th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider sticky left-8 bg-indigo-700 min-w-[160px]">Nama Siswa</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-emerald-300 uppercase tracking-wider whitespace-nowrap">H</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-amber-300 uppercase tracking-wider whitespace-nowrap">S</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-blue-300 uppercase tracking-wider whitespace-nowrap">I</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-rose-300 uppercase tracking-wider whitespace-nowrap">A</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-indigo-200 uppercase tracking-wider whitespace-nowrap">% Hadir</th>
                    {mapelList.map(m => (
                      <th key={m} className="px-3 py-3 text-center text-[10px] font-bold text-white uppercase tracking-wider min-w-[80px]">{m}</th>
                    ))}
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-amber-300 uppercase tracking-wider min-w-[80px] whitespace-nowrap">Rata-rata</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-emerald-300 uppercase tracking-wider whitespace-nowrap">Kirim WA</th>
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

                    return (
                      <tr key={student.id} className={`${rowBg} hover:bg-indigo-50/20 transition-colors`}>
                        <td className="px-3 py-3 text-slate-400 text-xs text-center sticky left-0 bg-inherit">{idx + 1}</td>
                        <td className="px-3 py-3 sticky left-8 bg-inherit">
                          <p className="font-semibold text-slate-900 text-sm">{student.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{student.nis}</p>
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-700 text-sm">{abs.h}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-600 text-sm">{abs.s}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-600 text-sm">{abs.i}</td>
                        <td className="px-3 py-3 text-center font-bold text-rose-600 text-sm">{abs.a}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            abs.pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                            abs.pct >= 50 ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                          }`}>{abs.pct}%</span>
                        </td>
                        {mapelList.map(mapel => {
                          const val = getNilai(student.id, mapel);
                          const num = val === '-' ? null : Number(val);
                          return (
                            <td key={mapel} className="px-3 py-3 text-center">
                              <span className={`text-sm font-bold ${
                                num === null ? 'text-slate-300' :
                                num >= 75 ? 'text-emerald-700' :
                                num >= 60 ? 'text-amber-700' : 'text-rose-700'
                              }`}>{val}</span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm font-black ${
                            avgNum === null ? 'text-slate-300' :
                            avgNum >= 75 ? 'text-emerald-700' :
                            avgNum >= 60 ? 'text-amber-700' : 'text-rose-700'
                          }`}>{avg}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleSendOne(student)}
                            disabled={!hasWa || status === 'sending' || bulkStatus === 'sending'}
                            title={!hasWa ? 'No. WA belum diisi di tab Kontak Ortu' : `Kirim laporan nilai ${getPeriodeLabel(periodeFilter)} via WA`}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                              status === 'success' ? 'bg-emerald-500 text-white' :
                              status === 'error'   ? 'bg-rose-500 text-white' :
                              status === 'sending' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                              hasWa ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                              'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            {status === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                             status === 'success'  ? <CheckCheck className="w-3.5 h-3.5" /> :
                             <Send className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                {mapelList.length} mata pelajaran · {kelasStudents.length} siswa · <span className="font-semibold text-indigo-600">{getPeriodeLabel(periodeFilter)}</span>
              </p>
              <button
                onClick={handleSendAll}
                disabled={studentsWithWa.length === 0 || bulkStatus === 'sending'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkStatus === 'sending'
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mengirim...</>
                  : <><Send className="w-3.5 h-3.5" />Kirim Laporan {getPeriodeLabel(periodeFilter)} ke Ortu ({studentsWithWa.length})</>}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}