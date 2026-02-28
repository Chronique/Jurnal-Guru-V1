import { useState, useMemo } from 'react';
import { JournalEntry, AttendanceStatus } from '../types';
import { Student } from '../hooks/useStudents';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Users, BookOpen, Download, Loader2 } from 'lucide-react';

type RekapKehadiranProps = {
  journals: JournalEntry[];
  students: Student[];
  teacherName?: string;
};

type StatusCount = { present: number; sick: number; permission: number; absent: number; total: number };
type StudentRekapRow = {
  student: Student;
  pertemuan: { journalId: string; status: AttendanceStatus | '-' }[];
  summary: StatusCount;
};

const STATUS_LABEL: Record<string, string> = {
  present: 'H', sick: 'S', permission: 'I', absent: 'A', '-': '-',
};

export function RekapKehadiran({ journals, students, teacherName = '' }: RekapKehadiranProps) {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass,   setSelectedClass]   = useState('');
  const [downloading,     setDownloading]      = useState(false);

  const subjects = useMemo(() =>
    Array.from(new Set(journals.map(j => j.subject))).sort(), [journals]);

  const classes = useMemo(() =>
    Array.from(new Set(journals.map(j => j.className))).sort(), [journals]);

  if (!selectedSubject && subjects.length > 0) setSelectedSubject(subjects[0]);
  if (!selectedClass   && classes.length   > 0) setSelectedClass(classes[0]);

  const filteredJournals = useMemo(() =>
    journals
      .filter(j => j.subject === selectedSubject && j.className === selectedClass)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [journals, selectedSubject, selectedClass]);

  const classStudents = useMemo(() =>
    students
      .filter(s => s.className === selectedClass)
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [students, selectedClass]);

  const rekapData = useMemo((): StudentRekapRow[] =>
    classStudents.map(student => {
      const pertemuan = filteredJournals.map(journal => ({
        journalId: journal.id,
        status: (journal.studentAttendance?.[student.id] ?? '-') as AttendanceStatus | '-',
      }));
      const summary: StatusCount = { present:0, sick:0, permission:0, absent:0, total: filteredJournals.length };
      pertemuan.forEach(p => { if (p.status !== '-') summary[p.status as AttendanceStatus]++; });
      return { student, pertemuan, summary };
    }),
    [classStudents, filteredJournals]);

  const getPct = (row: StudentRekapRow) =>
    row.summary.total === 0 ? 0 : Math.round((row.summary.present / row.summary.total) * 100);

  // ── Download Excel via API Python ─────────────────────────────────────────
  const handleDownload = async () => {
    if (!filteredJournals.length || !rekapData.length || downloading) return;
    setDownloading(true);

    const today = format(new Date(), 'dd MMMM yyyy', { locale: id });
    const payload = {
      school:    "SMPN 21 Jambi",
      mapel:     selectedSubject,
      kelas:     selectedClass,
      guru:      teacherName,
      dicetak:   today,
      pertemuan: filteredJournals.map((j, i) => ({
        no:    i + 1,
        tgl:   format(parseISO(j.date), 'dd/MM/yy'),
        topik: j.topic ?? '',
      })),
      siswa: rekapData.map((row, idx) => ({
        no:     idx + 1,
        nis:    row.student.nis,
        nama:   row.student.name,
        status: row.pertemuan.map(p => STATUS_LABEL[p.status] ?? '-'),
      })),
    };

    try {
      const res = await fetch('/api/rekap-excel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const safeName = `${selectedSubject}_${selectedClass}`.replace(/[^a-zA-Z0-9_]/g, '_');
      a.href = url; a.download = `Rekap_Kehadiran_${safeName}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download gagal:', err);
      alert('Gagal mengunduh file. Pastikan sudah deploy ke Vercel.');
    } finally {
      setDownloading(false);
    }
  };

  const noJournals = filteredJournals.length === 0;
  const noStudents = classStudents.length === 0;

  return (
    <div className="space-y-5">
      {/* Judul */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rekap Kehadiran</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Rekapitulasi kehadiran siswa per mata pelajaran. Detail per pertemuan tersedia di file Excel.
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              <BookOpen className="w-3.5 h-3.5 inline mr-1" />Mata Pelajaran
            </label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              disabled={subjects.length === 0}
              className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-50"
            >
              {subjects.length > 0
                ? subjects.map(s => <option key={s} value={s}>{s}</option>)
                : <option value="">Belum ada jurnal</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              <Users className="w-3.5 h-3.5 inline mr-1" />Kelas
            </label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              disabled={classes.length === 0}
              className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-50"
            >
              {classes.length > 0
                ? classes.map(c => <option key={c} value={c}>{c}</option>)
                : <option value="">Belum ada kelas</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Badge info + tombol download */}
      {!noJournals && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
              {filteredJournals.length} Pertemuan
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {classStudents.length} Siswa
            </span>
          </div>
          <button
            onClick={handleDownload}
            disabled={noStudents || downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Membuat file...</>
              : <><Download className="w-4 h-4" />Download Excel</>
            }
          </button>
        </div>
      )}

      {/* State kosong */}
      {noJournals ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-semibold">Belum ada jurnal untuk kombinasi ini</p>
          <p className="text-slate-400 text-sm">Isi jurnal terlebih dahulu untuk melihat rekap kehadiran.</p>
        </div>
      ) : noStudents ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-semibold">Belum ada data siswa untuk kelas {selectedClass}</p>
          <p className="text-slate-400 text-sm">Hubungi Admin untuk menginput data siswa.</p>
        </div>
      ) : (
        /* ── Tabel ringkasan kehadiran (tanpa kolom pertemuan) ────────────── */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="text-xs text-left border-collapse w-full">
            <thead>
              <tr className="bg-indigo-700">
                <th className="px-3 py-3 text-center text-white font-bold uppercase text-[10px] w-10">No</th>
                <th className="px-3 py-3 text-white font-bold uppercase text-[10px]">Nama Siswa</th>
                <th className="px-3 py-3 text-center text-white font-bold text-[10px] whitespace-nowrap">Hadir</th>
                <th className="px-3 py-3 text-center text-white font-bold text-[10px] whitespace-nowrap">Sakit</th>
                <th className="px-3 py-3 text-center text-white font-bold text-[10px] whitespace-nowrap">Izin</th>
                <th className="px-3 py-3 text-center text-white font-bold text-[10px] whitespace-nowrap">Alpa</th>
                <th className="px-3 py-3 text-center text-white font-bold text-[10px] whitespace-nowrap">% Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rekapData.map((row, idx) => {
                const pct = getPct(row);
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                return (
                  <tr key={row.student.id} className={`${rowBg} hover:bg-indigo-50/30 transition-colors`}>
                    <td className="px-3 py-3 text-slate-400 text-center text-xs">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900 text-xs leading-tight">{row.student.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.student.nis}</div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-700">{row.summary.present}</td>
                    <td className="px-3 py-3 text-center font-bold text-amber-600">{row.summary.sick}</td>
                    <td className="px-3 py-3 text-center font-bold text-blue-600">{row.summary.permission}</td>
                    <td className="px-3 py-3 text-center font-bold text-rose-600">{row.summary.absent}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                        pct >= 50 ? 'bg-amber-100 text-amber-700'     :
                                    'bg-rose-100 text-rose-700'
                      }`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                <td />
                <td className="px-3 py-2.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wide">
                  Total
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                  {rekapData.reduce((acc, r) => acc + r.summary.present, 0)}
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-amber-600">
                  {rekapData.reduce((acc, r) => acc + r.summary.sick, 0)}
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-blue-600">
                  {rekapData.reduce((acc, r) => acc + r.summary.permission, 0)}
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-rose-600">
                  {rekapData.reduce((acc, r) => acc + r.summary.absent, 0)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}