import { useState, useMemo, useEffect } from 'react';
import { JournalEntry, AttendanceStatus } from '../types';
import { Student } from '../hooks/useStudents';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Users, BookOpen, Download, Loader2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import ExcelJS from 'exceljs';

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

const STATUS_COLOR: Record<string, string> = {
  H: 'bg-emerald-100 text-emerald-700',
  S: 'bg-amber-100 text-amber-700',
  I: 'bg-blue-100 text-blue-700',
  A: 'bg-rose-100 text-rose-700',
  '-': 'bg-slate-100 text-slate-400',
};

// ── Excel color constants ──────────────────────────────────────────────────────
const C = {
  indigo:   'FF3730A3', indigo2:  'FF4F46E5', indigo3:  'FF6366F1',
  indigoL:  'FFEEF2FF', white:    'FFFFFFFF', slate50:  'FFF8FAFC',
  slate100: 'FFF1F5F9', slate200: 'FFE2E8F0', dark:     'FF1E293B',
  emerald:  'FF059669', emeraldL: 'FFD1FAE5', amber:    'FFD97706',
  amberL:   'FFFEF3C7', blue:     'FF2563EB', blueL:    'FFDBEAFE',
  rose:     'FFE11D48', roseL:    'FFFFE4E6', gray:     'FF94A3B8',
};

const STATUS_FG: Record<string, string> = {
  H: C.emerald, S: C.amber, I: C.blue, A: C.rose, '-': C.gray,
};
const STATUS_BG: Record<string, string> = {
  H: C.emeraldL, S: C.amberL, I: C.blueL, A: C.roseL, '-': C.slate100,
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function thinBorder(argb = C.slate200): Partial<ExcelJS.Borders> {
  const side: ExcelJS.BorderStyle = 'thin';
  const s = { style: side, color: { argb } };
  return { top: s, bottom: s, left: s, right: s };
}
function setCell(
  ws: ExcelJS.Worksheet, row: number, col: number, value: ExcelJS.CellValue,
  opts: { bold?: boolean; size?: number; fgColor?: string; bgColor?: string; hAlign?: ExcelJS.Alignment['horizontal']; border?: boolean; wrap?: boolean; } = {}
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = { name: 'Arial', bold: opts.bold ?? false, size: opts.size ?? 9, color: { argb: opts.fgColor ?? C.dark } };
  cell.alignment = { horizontal: opts.hAlign ?? 'left', vertical: 'middle', wrapText: opts.wrap ?? false };
  if (opts.bgColor) cell.fill = solidFill(opts.bgColor);
  if (opts.border !== false) cell.border = thinBorder();
}

async function buildExcelClient(data: {
  school: string; mapel: string; kelas: string; guru: string; dicetak: string;
  pertemuan: { no: number; tgl: string }[];
  siswa: { no: number; nis: string; nama: string; status: string[] }[];
}): Promise<Blob> {
  const { school, mapel, kelas, guru, dicetak, pertemuan, siswa } = data;
  const N = pertemuan.length, NS = siswa.length;
  const COL_NO = 1, COL_NIS = 2, COL_NAMA = 3;
  const COL_P1 = 4, COL_PE = COL_P1 + N - 1;
  const COL_H = COL_PE + 1, COL_S = COL_PE + 2, COL_I = COL_PE + 3, COL_A = COL_PE + 4;
  const COL_TOT = COL_PE + 5, COL_PCT = COL_PE + 6, LAST = COL_PCT;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Kehadiran');
  ws.views = [{ showGridLines: false }];
  ws.getColumn(COL_NO).width = 5; ws.getColumn(COL_NIS).width = 14; ws.getColumn(COL_NAMA).width = 32;
  for (let i = 0; i < N; i++) ws.getColumn(COL_P1 + i).width = 9;
  ws.getColumn(COL_H).width = 9; ws.getColumn(COL_S).width = 9;
  ws.getColumn(COL_I).width = 9; ws.getColumn(COL_A).width = 9;
  ws.getColumn(COL_TOT).width = 8; ws.getColumn(COL_PCT).width = 11;

  ws.getRow(1).height = 32;
  ws.mergeCells(1, 1, 1, LAST);
  setCell(ws, 1, 1, school, { bold: true, size: 15, fgColor: C.white, bgColor: C.indigo, hAlign: 'center', border: false });
  ws.getRow(2).height = 24;
  ws.mergeCells(2, 1, 2, LAST);
  setCell(ws, 2, 1, 'REKAP KEHADIRAN SISWA', { bold: true, size: 12, fgColor: C.indigo, bgColor: C.indigoL, hAlign: 'center', border: false });
  ws.getRow(3).height = 5;

  const half = Math.floor(LAST / 2);
  const infoRows: [string, string, string, string][] = [
    ['Mata Pelajaran', mapel, 'Kelas', kelas],
    ['Guru', guru, 'Jumlah Pertemuan', String(N)],
    ['Dicetak', dicetak, '', ''],
  ];
  infoRows.forEach(([k1, v1, k2, v2], ri) => {
    const r = 4 + ri; ws.getRow(r).height = 17;
    ws.mergeCells(r, 1, r, half);
    setCell(ws, r, 1, `  ${k1}  :  ${v1}`, { bold: ri === 0, bgColor: C.slate50, border: false });
    ws.mergeCells(r, half + 1, r, LAST);
    setCell(ws, r, half + 1, k2 ? `  ${k2}  :  ${v2}` : '', { bgColor: C.slate50, border: false });
  });
  ws.getRow(7).height = 5;

  const R_H1 = 8, R_H2 = 9;
  ws.getRow(R_H1).height = 34; ws.getRow(R_H2).height = 28;
  const hdrStyle = (r: number, c: number, val: string, secondary = false) => {
    setCell(ws, r, c, val, { bold: true, size: secondary ? 8 : 9, fgColor: C.white, bgColor: secondary ? C.indigo2 : C.indigo, hAlign: 'center', wrap: true, border: false });
    ws.getCell(r, c).border = thinBorder(secondary ? C.indigo3 : C.indigo2);
  };
  [[COL_NO, 'No'], [COL_NIS, 'NIS'], [COL_NAMA, 'Nama Siswa']].forEach(([ci, lbl]) => {
    ws.mergeCells(R_H1, ci as number, R_H2, ci as number); hdrStyle(R_H1, ci as number, lbl as string);
  });
  ws.mergeCells(R_H1, COL_P1, R_H1, COL_PE); hdrStyle(R_H1, COL_P1, 'Pertemuan Ke-');
  ([
    [COL_H, 'Hadir\n(H)'], [COL_S, 'Sakit\n(S)'], [COL_I, 'Izin\n(I)'],
    [COL_A, 'Alpa\n(A)'], [COL_TOT, 'Total'], [COL_PCT, '% Hadir'],
  ] as [number, string][]).forEach(([ci, lbl]) => {
    ws.mergeCells(R_H1, ci, R_H2, ci); hdrStyle(R_H1, ci, lbl);
  });
  pertemuan.forEach((pt, i) => { hdrStyle(R_H2, COL_P1 + i, `P${pt.no}\n${pt.tgl}`, true); });

  const R_DATA = R_H2 + 1;
  siswa.forEach((s, si) => {
    const r = R_DATA + si, bg = si % 2 === 0 ? C.white : C.slate50;
    ws.getRow(r).height = 20;
    setCell(ws, r, COL_NO, si + 1, { hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_NIS, s.nis, { hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_NAMA, s.nama, { bold: true, bgColor: bg });
    let h_ = 0, s_ = 0, i_ = 0, a_ = 0;
    s.status.forEach((st, pi) => {
      const ci = COL_P1 + pi, cell = ws.getCell(r, ci);
      cell.value = st; cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: STATUS_FG[st] ?? C.gray } };
      cell.fill = solidFill(STATUS_BG[st] ?? C.slate100);
      cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = thinBorder();
      if (st === 'H') h_++; else if (st === 'S') s_++; else if (st === 'I') i_++; else if (st === 'A') a_++;
    });
    const total = N, pct = total ? h_ / total : 0;
    const pBg = pct >= 0.75 ? C.emeraldL : pct >= 0.5 ? C.amberL : C.roseL;
    const pFg = pct >= 0.75 ? C.emerald  : pct >= 0.5 ? C.amber  : C.rose;
    setCell(ws, r, COL_H, h_, { bold: true, fgColor: C.emerald, hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_S, s_, { bold: true, fgColor: C.amber,   hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_I, i_, { bold: true, fgColor: C.blue,    hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_A, a_, { bold: true, fgColor: C.rose,    hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_TOT, total, { hAlign: 'center', bgColor: bg });
    const pCell = ws.getCell(r, COL_PCT);
    pCell.value = `${Math.round(pct * 100)}%`; pCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: pFg } };
    pCell.fill = solidFill(pBg); pCell.alignment = { horizontal: 'center', vertical: 'middle' }; pCell.border = thinBorder();
  });

  const R_TOT = R_DATA + NS; ws.getRow(R_TOT).height = 22;
  ws.mergeCells(R_TOT, COL_NO, R_TOT, COL_NAMA);
  setCell(ws, R_TOT, COL_NO, 'TOTAL HADIR PER PERTEMUAN', { bold: true, fgColor: C.white, bgColor: C.indigo, hAlign: 'center' });
  pertemuan.forEach((_, i) => {
    const ci = COL_P1 + i, total = siswa.filter(s => s.status[i] === 'H').length;
    const cell = ws.getCell(R_TOT, ci);
    cell.value = total; cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: C.white } };
    cell.fill = solidFill(C.emerald); cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = thinBorder();
  });
  for (let ci = COL_H; ci <= LAST; ci++) {
    const cell = ws.getCell(R_TOT, ci); cell.fill = solidFill(C.indigo); cell.border = thinBorder();
  }
  ws.views = [{ state: 'frozen', xSplit: COL_P1 - 1, ySplit: R_DATA - 1, showGridLines: false }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${R_H2}` };
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Komponen utama ─────────────────────────────────────────────────────────────
export function RekapKehadiran({ journals, students, teacherName = '' }: RekapKehadiranProps) {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass,   setSelectedClass]   = useState('');
  const [downloading,     setDownloading]     = useState(false);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);

  const subjects = useMemo(() =>
    Array.from(new Set(journals.map(j => j.subject))).sort(), [journals]);

  const classes = useMemo(() =>
    Array.from(new Set(journals.map(j => j.className))).sort(), [journals]);

  // ✅ FIX: pakai useEffect agar sinkron saat journals berubah
  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(selectedSubject)) {
      setSelectedSubject(subjects[0]);
    }
  }, [subjects]);

  useEffect(() => {
    if (classes.length > 0 && !classes.includes(selectedClass)) {
      setSelectedClass(classes[0]);
    }
  }, [classes]);

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
      const summary: StatusCount = { present: 0, sick: 0, permission: 0, absent: 0, total: filteredJournals.length };
      pertemuan.forEach(p => { if (p.status !== '-') summary[p.status as AttendanceStatus]++; });
      return { student, pertemuan, summary };
    }),
    [classStudents, filteredJournals]);

  const getPct = (row: StudentRekapRow) =>
    row.summary.total === 0 ? 0 : Math.round((row.summary.present / row.summary.total) * 100);

  const handleDownload = async () => {
    if (!filteredJournals.length || !rekapData.length || downloading) return;
    setDownloading(true);
    try {
      const today = format(new Date(), 'dd MMMM yyyy', { locale: id });
      const payload = {
        school: 'SMPN 21 Jambi', mapel: selectedSubject, kelas: selectedClass,
        guru: teacherName, dicetak: today,
        pertemuan: filteredJournals.map((j, i) => ({ no: i + 1, tgl: format(parseISO(j.date), 'dd/MM/yy') })),
        siswa: rekapData.map((row, idx) => ({
          no: idx + 1, nis: row.student.nis, nama: row.student.name,
          status: row.pertemuan.map(p => STATUS_LABEL[p.status] ?? '-'),
        })),
      };
      const blob = await buildExcelClient(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = `${selectedSubject}_${selectedClass}`.replace(/[^a-zA-Z0-9_]/g, '_');
      a.href = url; a.download = `Rekap_Kehadiran_${safeName}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download gagal:', err);
      alert('Gagal membuat file Excel. Silakan coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const noJournals = filteredJournals.length === 0;
  const noStudents = classStudents.length === 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rekap Kehadiran</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Rekapitulasi kehadiran siswa per mata pelajaran.
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Info chips */}
        {!noJournals && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
              <Calendar className="w-3 h-3" />{filteredJournals.length} Pertemuan
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              <Users className="w-3 h-3" />{classStudents.length} Siswa
            </span>
            <div className="flex-1" />
            <button
              onClick={handleDownload}
              disabled={noStudents || downloading || noJournals}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Membuat...</>
                : <><Download className="w-4 h-4" />Excel</>}
            </button>
          </div>
        )}
      </div>

      {/* Empty states */}
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
        <>
          {/* ── MOBILE: Card per siswa ── */}
          <div className="block md:hidden space-y-3">
            {rekapData.map((row, idx) => {
              const pct     = getPct(row);
              const isOpen  = expandedId === row.student.id;
              return (
                <div key={row.student.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header kartu */}
                  <button
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedId(isOpen ? null : row.student.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{row.student.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{row.student.nis}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Badge % hadir */}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                        pct >= 50 ? 'bg-amber-100 text-amber-700'     :
                                    'bg-rose-100 text-rose-700'
                      }`}>{pct}%</span>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Ringkasan singkat (selalu tampil) */}
                  <div className="px-4 pb-3 grid grid-cols-4 gap-2">
                    {[
                      { label: 'Hadir', val: row.summary.present, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                      { label: 'Sakit', val: row.summary.sick,    cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                      { label: 'Izin',  val: row.summary.permission, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
                      { label: 'Alpa',  val: row.summary.absent,  cls: 'bg-rose-50 text-rose-700 border-rose-100' },
                    ].map(item => (
                      <div key={item.label} className={`rounded-xl border p-2 text-center ${item.cls}`}>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-lg font-black leading-tight">{item.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Detail per pertemuan (expand) */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Detail per Pertemuan
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.pertemuan.map((p, i) => {
                          const journal = filteredJournals[i];
                          const label   = STATUS_LABEL[p.status] ?? '-';
                          const color   = STATUS_COLOR[label] ?? 'bg-slate-100 text-slate-400';
                          return (
                            <div key={p.journalId} className="flex flex-col items-center gap-0.5">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${color}`}>
                                {label}
                              </span>
                              <span className="text-[9px] text-slate-400 font-medium">
                                {journal ? format(parseISO(journal.date), 'dd/MM') : `P${i + 1}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Footer total mobile */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Total Kelas</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Hadir', val: rekapData.reduce((a, r) => a + r.summary.present, 0),    cls: 'text-emerald-700' },
                  { label: 'Sakit', val: rekapData.reduce((a, r) => a + r.summary.sick, 0),       cls: 'text-amber-600' },
                  { label: 'Izin',  val: rekapData.reduce((a, r) => a + r.summary.permission, 0), cls: 'text-blue-600' },
                  { label: 'Alpa',  val: rekapData.reduce((a, r) => a + r.summary.absent, 0),     cls: 'text-rose-600' },
                ].map(item => (
                  <div key={item.label}>
                    <p className={`text-xl font-black ${item.cls}`}>{item.val}</p>
                    <p className="text-xs text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── DESKTOP: Tabel ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                  const pct   = getPct(row);
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
                        }`}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                  <td />
                  <td className="px-3 py-2.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Total</td>
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
        </>
      )}
    </div>
  );
}