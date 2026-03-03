import { useState, useMemo, useCallback } from 'react';
import { Student } from '../hooks/useStudents';
import { WaliMurid as WaliMuridType, useWaliMurid } from '../hooks/useWaliMurid';
import { JournalEntry } from '../types';
import {
  Phone, Users, BookOpen, Search, Save,
  ChevronDown, Star, CheckCircle2, Send,
} from 'lucide-react';

type WaliMuridProps = {
  students: Student[];
  journals: JournalEntry[];
};

type ActiveTab = 'kontak' | 'nilai';

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 transition-colors';

export function WaliMurid({ students, journals }: WaliMuridProps) {
  const { waliList, loading, upsertWali, getWali } = useWaliMurid();
  const [activeTab, setActiveTab] = useState<ActiveTab>('kontak');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [search, setSearch] = useState('');
  const [editMap, setEditMap] = useState<Record<string, { namaOrtu: string; noWa: string }>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Kelas unik
  const kelasList = useMemo(() =>
    Array.from(new Set(students.map(s => s.className))).sort(), [students]);

  if (!selectedKelas && kelasList.length > 0) setSelectedKelas(kelasList[0]);

  // Siswa di kelas terpilih
  const kelasStudents = useMemo(() =>
    students
      .filter(s => s.className === selectedKelas)
      .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.nis.includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [students, selectedKelas, search]);

  // ── Kontak handlers ───────────────────────────────────────────────────────
  const getEdit = (studentId: string) => {
    if (editMap[studentId]) return editMap[studentId];
    const wali = getWali(studentId);
    return { namaOrtu: wali?.namaOrtu ?? '', noWa: wali?.noWa ?? '' };
  };

  const handleChange = (studentId: string, field: 'namaOrtu' | 'noWa', value: string) => {
    setEditMap(prev => ({
      ...prev,
      [studentId]: { ...getEdit(studentId), [field]: value },
    }));
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
  // Ambil semua mapel yang pernah diajar di kelas ini
  const mapelList = useMemo(() =>
    Array.from(new Set(
      journals.filter(j => j.className === selectedKelas).map(j => j.subject)
    )).sort(),
    [journals, selectedKelas]);

  // Hitung rata-rata nilai per siswa per mapel
  const getNilai = useCallback((studentId: string, mapel: string): string => {
    const relevantJournals = journals.filter(j =>
      j.className === selectedKelas && j.subject === mapel
    );
    const values: number[] = [];
    relevantJournals.forEach(j => {
      const grade = (j.grades as Record<string, string>)?.[studentId];
      if (grade !== undefined && grade !== '') values.push(Number(grade));
    });
    if (values.length === 0) return '-';
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  }, [journals, selectedKelas]);

  // Hitung absensi per siswa
  const getAbsensi = useCallback((studentId: string) => {
    let h = 0, s = 0, i = 0, a = 0;
    journals
      .filter(j => j.className === selectedKelas)
      .forEach(j => {
        const st = j.studentAttendance?.[studentId];
        if (st === 'present') h++;
        else if (st === 'sick') s++;
        else if (st === 'permission') i++;
        else if (st === 'absent') a++;
      });
    const total = h + s + i + a;
    const pct = total ? Math.round((h / total) * 100) : 0;
    return { h, s, i, a, total, pct };
  }, [journals, selectedKelas]);

  // Hitung rata-rata semua mapel
  const getRataRata = useCallback((studentId: string): string => {
    const values: number[] = [];
    mapelList.forEach(mapel => {
      const val = getNilai(studentId, mapel);
      if (val !== '-') values.push(Number(val));
    });
    if (values.length === 0) return '-';
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  }, [mapelList, getNilai]);

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
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-500" />
          Wali Murid
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Kelola kontak orang tua dan pantau rekap nilai siswa per kelas.
        </p>
      </div>

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

      {/* Filter kelas + search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <p className="text-xs text-slate-400 mt-2">
          {kelasStudents.length} siswa di kelas {selectedKelas}
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
            {/* Info banner */}
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-xs text-indigo-700 font-medium">
                Input No. WA orang tua untuk setiap siswa. Nomor ini akan digunakan untuk kirim laporan otomatis.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {kelasStudents.map((student, idx) => {
                const edit   = getEdit(student.id);
                const saved  = savedIds.has(student.id);
                const isDirty = hasChange(student.id);
                const wali   = getWali(student.id);
                const hasData = wali?.noWa;

                return (
                  <div key={student.id} className={`px-5 py-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    {/* Nama siswa */}
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
                      {hasData && !isDirty && !saved && (
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

                    {/* Input kontak */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
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
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer stats */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                <span className="font-bold text-emerald-700">
                  {kelasStudents.filter(s => getWali(s.id)?.noWa).length}
                </span>
                /{kelasStudents.length} siswa sudah ada No. WA ortu
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl opacity-50 cursor-not-allowed"
                  title="Segera hadir — integrasi Fonnte"
                >
                  <Send className="w-3.5 h-3.5" />
                  Kirim WA ke Semua
                  <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">Segera</span>
                </button>
              </div>
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
            <p className="text-slate-500 font-medium">Belum ada nilai untuk kelas ini.</p>
            <p className="text-slate-400 text-sm mt-1">Guru perlu input nilai di menu Penilaian terlebih dahulu.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-700">
                    <th className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider sticky left-0 bg-indigo-700 w-8">No</th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider sticky left-8 bg-indigo-700 min-w-[160px]">Nama Siswa</th>
                    {/* Kolom absensi */}
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-emerald-300 uppercase tracking-wider whitespace-nowrap">H</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-amber-300 uppercase tracking-wider whitespace-nowrap">S</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-blue-300 uppercase tracking-wider whitespace-nowrap">I</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-rose-300 uppercase tracking-wider whitespace-nowrap">A</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-indigo-200 uppercase tracking-wider whitespace-nowrap">% Hadir</th>
                    {/* Kolom nilai per mapel */}
                    {mapelList.map(m => (
                      <th key={m} className="px-3 py-3 text-center text-[10px] font-bold text-white uppercase tracking-wider min-w-[80px]">
                        {m}
                      </th>
                    ))}
                    {/* Rata-rata */}
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-amber-300 uppercase tracking-wider min-w-[80px] whitespace-nowrap">
                      Rata-rata
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kelasStudents.map((student, idx) => {
                    const abs = getAbsensi(student.id);
                    const avg = getRataRata(student.id);
                    const avgNum = avg === '-' ? null : Number(avg);
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

                    return (
                      <tr key={student.id} className={`${rowBg} hover:bg-indigo-50/20 transition-colors`}>
                        <td className="px-3 py-3 text-slate-400 text-xs text-center sticky left-0 bg-inherit">{idx + 1}</td>
                        <td className="px-3 py-3 sticky left-8 bg-inherit">
                          <p className="font-semibold text-slate-900 text-sm">{student.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{student.nis}</p>
                        </td>
                        {/* Absensi */}
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
                        {/* Nilai per mapel */}
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
                        {/* Rata-rata */}
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm font-black ${
                            avgNum === null ? 'text-slate-300' :
                            avgNum >= 75 ? 'text-emerald-700' :
                            avgNum >= 60 ? 'text-amber-700' : 'text-rose-700'
                          }`}>{avg}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer — tombol kirim laporan nilai */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                {mapelList.length} mata pelajaran · {kelasStudents.length} siswa
              </p>
              <button
                disabled
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl opacity-50 cursor-not-allowed"
                title="Segera hadir — integrasi Fonnte"
              >
                <Send className="w-3.5 h-3.5" />
                Kirim Laporan Nilai ke Ortu
                <span className="bg-emerald-500 text-[9px] px-1.5 py-0.5 rounded-full ml-1">Segera</span>
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}