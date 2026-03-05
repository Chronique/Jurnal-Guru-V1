import { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import { Student } from '../hooks/useStudents';
import { TugasGuru } from '../hooks/useTugas';
import { Star, Download, Filter, Users, BookOpen, Info, ChevronDown, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

type PenilaianProps = {
  students: Student[];
  journals: JournalEntry[];
  onUpdateJournal: (id: string, data: Partial<JournalEntry>) => void;
  tugasGuru?: TugasGuru;
};

type GradeRecord = Record<string, Record<string, string>>;

// ── Warna ────────────────────────────────────────────────────────────────────
const C = {
  indigo:   'FF3730A3', indigo2: 'FF4F46E5', indigo3: 'FF6366F1',
  indigoL:  'FFEEF2FF', white:   'FFFFFFFF', slate50: 'FFF8FAFC',
  slate100: 'FFF1F5F9', slate200:'FFE2E8F0', dark:    'FF1E293B',
  emerald:  'FF059669', emeraldL:'FFD1FAE5',
  amber:    'FFD97706', amberL:  'FFFEF3C7',
  rose:     'FFE11D48', roseL:   'FFFFE4E6',
  gray:     'FF94A3B8',
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder(argb = C.slate200): Partial<ExcelJS.Borders> {
  const s = { style: 'thin' as ExcelJS.BorderStyle, color: { argb } };
  return { top: s, bottom: s, left: s, right: s };
}

function setCell(
  ws: ExcelJS.Worksheet, row: number, col: number,
  value: ExcelJS.CellValue,
  opts: {
    bold?: boolean; size?: number; fgColor?: string; bgColor?: string;
    hAlign?: ExcelJS.Alignment['horizontal']; border?: boolean; wrap?: boolean;
  } = {}
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font  = { name: 'Arial', bold: opts.bold ?? false, size: opts.size ?? 9, color: { argb: opts.fgColor ?? C.dark } };
  cell.alignment = { horizontal: opts.hAlign ?? 'left', vertical: 'middle', wrapText: opts.wrap ?? false };
  if (opts.bgColor) cell.fill = solidFill(opts.bgColor);
  if (opts.border !== false) cell.border = thinBorder();
}

// ── Builder Excel ─────────────────────────────────────────────────────────────
async function buildExcel(data: {
  school: string; mapel: string; kelas: string; guru: string; dicetak: string;
  pertemuan: { no: number; tgl: string; mapel: string }[];
  siswa: { no: number; nis: string; nama: string; nilai: (string | number)[]; avg: string }[];
}): Promise<Blob> {
  const { school, mapel, kelas, guru, dicetak, pertemuan, siswa } = data;
  const N  = pertemuan.length;
  const NS = siswa.length;

  const COL_NO   = 1;
  const COL_NIS  = 2;
  const COL_NAMA = 3;
  const COL_P1   = 4;
  const COL_PE   = COL_P1 + N - 1;
  const COL_AVG  = COL_PE + 1;
  const LAST     = COL_AVG;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Nilai');
  ws.views = [{ showGridLines: false }];

  // Lebar kolom
  ws.getColumn(COL_NO).width   = 5;
  ws.getColumn(COL_NIS).width  = 14;
  ws.getColumn(COL_NAMA).width = 32;
  for (let i = 0; i < N; i++) ws.getColumn(COL_P1 + i).width = 10;
  ws.getColumn(COL_AVG).width  = 11;

  // Baris 1 — Banner sekolah
  ws.getRow(1).height = 32;
  ws.mergeCells(1, 1, 1, LAST);
  setCell(ws, 1, 1, school, {
    bold: true, size: 15, fgColor: C.white, bgColor: C.indigo,
    hAlign: 'center', border: false,
  });

  // Baris 2 — Judul
  ws.getRow(2).height = 24;
  ws.mergeCells(2, 1, 2, LAST);
  setCell(ws, 2, 1, 'REKAP NILAI SISWA', {
    bold: true, size: 12, fgColor: C.indigo, bgColor: C.indigoL,
    hAlign: 'center', border: false,
  });

  // Baris 3 — Spasi
  ws.getRow(3).height = 5;

  // Baris 4-6 — Info
  const half = Math.floor(LAST / 2);
  const infoRows: [string, string, string, string][] = [
    ['Mata Pelajaran', mapel,   'Kelas',             kelas],
    ['Guru',           guru,    'Jumlah Pertemuan',  String(N)],
    ['Dicetak',        dicetak, '',                  ''],
  ];
  infoRows.forEach(([k1, v1, k2, v2], ri) => {
    const r = 4 + ri;
    ws.getRow(r).height = 17;
    ws.mergeCells(r, 1, r, half);
    setCell(ws, r, 1, `  ${k1}  :  ${v1}`, { bold: ri === 0, bgColor: C.slate50, border: false });
    ws.mergeCells(r, half + 1, r, LAST);
    setCell(ws, r, half + 1, k2 ? `  ${k2}  :  ${v2}` : '', { bgColor: C.slate50, border: false });
  });

  // Baris 7 — Spasi
  ws.getRow(7).height = 5;

  // Baris 8-9 — Header tabel
  const R_H1 = 8, R_H2 = 9;
  ws.getRow(R_H1).height = 34;
  ws.getRow(R_H2).height = 28;

  const hdr = (r: number, c: number, val: string, secondary = false) => {
    setCell(ws, r, c, val, {
      bold: true, size: secondary ? 8 : 9, fgColor: C.white,
      bgColor: secondary ? C.indigo2 : C.indigo,
      hAlign: 'center', wrap: true, border: false,
    });
    ws.getCell(r, c).border = thinBorder(secondary ? C.indigo3 : C.indigo2);
  };

  // Merge header kolom tetap
  [[COL_NO, 'No'], [COL_NIS, 'NIS'], [COL_NAMA, 'Nama Siswa']].forEach(([ci, lbl]) => {
    ws.mergeCells(R_H1, ci as number, R_H2, ci as number);
    hdr(R_H1, ci as number, lbl as string);
  });

  // Header pertemuan
  ws.mergeCells(R_H1, COL_P1, R_H1, COL_PE);
  hdr(R_H1, COL_P1, 'Pertemuan Ke-');
  pertemuan.forEach((pt, i) => {
    hdr(R_H2, COL_P1 + i, `P${pt.no}\n${pt.tgl}`, true);
  });

  // Header rata-rata
  ws.mergeCells(R_H1, COL_AVG, R_H2, COL_AVG);
  hdr(R_H1, COL_AVG, 'Rata-\nrata');

  // Data siswa
  const R_DATA = R_H2 + 1;
  siswa.forEach((s, si) => {
    const r  = R_DATA + si;
    const bg = si % 2 === 0 ? C.white : C.slate50;
    ws.getRow(r).height = 20;

    setCell(ws, r, COL_NO,   si + 1, { hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_NIS,  s.nis,  { hAlign: 'center', bgColor: bg });
    setCell(ws, r, COL_NAMA, s.nama, { bold: true, bgColor: bg });

    // Nilai per pertemuan
    s.nilai.forEach((val, pi) => {
      const ci   = COL_P1 + pi;
      const num  = val === '-' || val === '' ? null : Number(val);
      const cell = ws.getCell(r, ci);
      cell.value     = num !== null ? num : '-';
      const fg = num === null ? C.gray : num >= 75 ? C.emerald : num >= 60 ? C.amber : C.rose;
      const bg2 = num === null ? C.slate100 : num >= 75 ? C.emeraldL : num >= 60 ? C.amberL : C.roseL;
      cell.font      = { name: 'Arial', bold: num !== null, size: 9, color: { argb: fg } };
      cell.fill      = solidFill(bg2);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = thinBorder();
    });

    // Rata-rata
    const avgNum  = s.avg === '-' ? null : Number(s.avg);
    const avgFg   = avgNum === null ? C.gray : avgNum >= 75 ? C.emerald : avgNum >= 60 ? C.amber : C.rose;
    const avgBg   = avgNum === null ? C.slate100 : avgNum >= 75 ? C.emeraldL : avgNum >= 60 ? C.amberL : C.roseL;
    const avgCell = ws.getCell(r, COL_AVG);
    avgCell.value     = s.avg;
    avgCell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: avgFg } };
    avgCell.fill      = solidFill(avgBg);
    avgCell.alignment = { horizontal: 'center', vertical: 'middle' };
    avgCell.border    = thinBorder();
  });

  // Baris statistik kelas
  const R_STAT = R_DATA + NS;
  ws.getRow(R_STAT).height = 22;
  ws.mergeCells(R_STAT, COL_NO, R_STAT, COL_NAMA);
  setCell(ws, R_STAT, COL_NO, 'RATA-RATA KELAS PER PERTEMUAN', {
    bold: true, fgColor: C.white, bgColor: C.indigo, hAlign: 'center',
  });

  pertemuan.forEach((_, i) => {
    const ci     = COL_P1 + i;
    const vals   = siswa.map(s => s.nilai[i]).filter(v => v !== '-' && v !== '').map(Number);
    const kelasAvg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
    const num    = kelasAvg === '-' ? null : Number(kelasAvg);
    const cell   = ws.getCell(R_STAT, ci);
    cell.value     = kelasAvg;
    cell.font      = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
    cell.fill      = solidFill(num !== null && num >= 75 ? C.emerald : num !== null && num >= 60 ? C.amber : C.indigo2);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = thinBorder();
  });

  // Rata-rata keseluruhan kelas
  const allAvgs   = siswa.map(s => s.avg).filter(v => v !== '-').map(Number);
  const grandAvg  = allAvgs.length ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1) : '-';
  const gNum      = grandAvg === '-' ? null : Number(grandAvg);
  const grandCell = ws.getCell(R_STAT, COL_AVG);
  grandCell.value     = grandAvg;
  grandCell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: C.white } };
  grandCell.fill      = solidFill(gNum !== null && gNum >= 75 ? C.emerald : gNum !== null && gNum >= 60 ? C.amber : C.indigo2);
  grandCell.alignment = { horizontal: 'center', vertical: 'middle' };
  grandCell.border    = thinBorder();

  // Freeze & print
  ws.views = [{ state: 'frozen', xSplit: COL_P1 - 1, ySplit: R_DATA - 1, showGridLines: false }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${R_H2}` };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Komponen utama ────────────────────────────────────────────────────────────
export function Penilaian({ students, journals, onUpdateJournal, tugasGuru }: PenilaianProps) {

  const availableKelas = useMemo(() => {
    if (tugasGuru && (tugasGuru.kelas ?? []).length > 0)
      return (tugasGuru.kelas ?? []).map(k => k.namaKelas).sort();
    return Array.from(new Set(students.map(s => s.className))).sort();
  }, [tugasGuru, students]);

  const hasTugas = tugasGuru && (tugasGuru.kelas ?? []).length > 0;

  const [selectedKelas,  setSelectedKelas]  = useState<string>(availableKelas[0] ?? '');
  const [selectedMapel,  setSelectedMapel]  = useState<string>('');
  const [localGrades,    setLocalGrades]    = useState<GradeRecord>({});
  const [saved,          setSaved]          = useState(false);
  const [downloading,    setDownloading]    = useState(false);

  const mapelOptions = useMemo(() => {
    if (!tugasGuru) return [];
    const kelasItem = (tugasGuru.kelas ?? []).find(k => k.namaKelas === selectedKelas);
    return (kelasItem?.mapel ?? []).map(m => m.namaMapel);
  }, [tugasGuru, selectedKelas]);

  const filteredJournals = useMemo(() =>
    journals
      .filter(j => j.className === selectedKelas && (selectedMapel ? j.subject === selectedMapel : true))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [journals, selectedKelas, selectedMapel]);

  const kelasStudents = useMemo(
    () => students.filter(s => s.className === selectedKelas),
    [students, selectedKelas]
  );

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }); }
    catch { return dateStr; }
  };

  const getGrade = (studentId: string, journalId: string): string => {
    if (localGrades[studentId]?.[journalId] !== undefined) return localGrades[studentId][journalId];
    const journal = journals.find(j => j.id === journalId);
    return (journal?.grades as Record<string, string>)?.[studentId] ?? '';
  };

  const handleGradeChange = (studentId: string, journalId: string, value: string) => {
    const num     = value.replace(/[^0-9]/g, '');
    const clamped = num === '' ? '' : String(Math.min(100, Number(num)));
    setLocalGrades(prev => ({ ...prev, [studentId]: { ...(prev[studentId] ?? {}), [journalId]: clamped } }));
    setSaved(false);
  };

  const handleSave = () => {
    const byJournal: Record<string, Record<string, string>> = {};
    for (const [studentId, byJournalId] of Object.entries(localGrades)) {
      for (const [journalId, nilai] of Object.entries(byJournalId)) {
        if (!byJournal[journalId]) byJournal[journalId] = {};
        byJournal[journalId][studentId] = nilai;
      }
    }
    for (const [journalId, gradesMap] of Object.entries(byJournal)) {
      const journal = journals.find(j => j.id === journalId);
      if (!journal) continue;
      const existing = (journal.grades as Record<string, string>) ?? {};
      onUpdateJournal(journalId, { grades: { ...existing, ...gradesMap } });
    }
    setSaved(true);
    setLocalGrades({});
    setTimeout(() => setSaved(false), 3000);
  };

  const getAverage = (studentId: string): string => {
    const values: number[] = [];
    for (const j of filteredJournals) {
      const g = getGrade(studentId, j.id);
      if (g !== '') values.push(Number(g));
    }
    if (values.length === 0) return '-';
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  // ── Export Excel ────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (!filteredJournals.length || !kelasStudents.length || downloading) return;
    setDownloading(true);
    try {
      const today    = format(new Date(), 'dd MMMM yyyy', { locale: id });
      const guruName = filteredJournals[0]?.teacherName ?? 'Guru';

      const payload = {
        school:    'SMPN 21 Jambi',
        mapel:     selectedMapel || 'Semua Mata Pelajaran',
        kelas:     selectedKelas,
        guru:      guruName,
        dicetak:   today,
        pertemuan: filteredJournals.map((j, i) => ({
          no:    i + 1,
          tgl:   formatDate(j.date),
          mapel: j.subject,
        })),
        siswa: kelasStudents.map((s, idx) => ({
          no:    idx + 1,
          nis:   s.nis,
          nama:  s.name,
          nilai: filteredJournals.map(j => {
            const v = getGrade(s.id, j.id);
            return v === '' ? '-' : v;
          }),
          avg: getAverage(s.id),
        })),
      };

      const blob     = await buildExcel(payload);
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      const safeName = `${selectedKelas}${selectedMapel ? '_' + selectedMapel : ''}`.replace(/[^a-zA-Z0-9_]/g, '_');
      a.href = url;
      a.download = `Rekap_Nilai_${safeName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export gagal:', err);
      alert('Gagal membuat file Excel. Silakan coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const hasUnsaved = Object.keys(localGrades).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            Penilaian Siswa
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Input nilai per pertemuan berdasarkan jurnal mengajar.</p>
        </div>
        <div className="flex gap-2">
          {hasUnsaved && (
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
              Simpan Nilai
            </button>
          )}
          {filteredJournals.length > 0 && kelasStudents.length > 0 && (
            <button onClick={handleExportExcel} disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50">
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Membuat...</>
                : <><Download className="w-4 h-4" />Export Excel</>
              }
            </button>
          )}
        </div>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          ✓ Nilai berhasil disimpan
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          Filter
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kelas</label>
            {availableKelas.length > 0 ? (
              <div className="relative">
                <select value={selectedKelas}
                  onChange={e => { setSelectedKelas(e.target.value); setSelectedMapel(''); }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 appearance-none">
                  {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <Info className="w-4 h-4 flex-shrink-0" />
                {hasTugas ? 'Belum ada kelas di tugas.' : 'Belum ada kelas tersedia.'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mata Pelajaran</label>
            <div className="relative">
              <select value={selectedMapel} onChange={e => setSelectedMapel(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 appearance-none">
                <option value="">Semua Mata Pelajaran</option>
                {(hasTugas && mapelOptions.length > 0 ? mapelOptions :
                  Array.from(new Set(filteredJournals.map(j => j.subject))).filter(Boolean)
                ).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {selectedKelas && (
          <div className="flex gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{kelasStudents.length} siswa</span>
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{filteredJournals.length} pertemuan</span>
          </div>
        )}
      </div>

      {/* Tabel nilai */}
      {kelasStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada siswa di kelas ini.</p>
        </div>
      ) : filteredJournals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada jurnal untuk kelas{selectedMapel ? ` / ${selectedMapel}` : ''} ini.</p>
          <p className="text-slate-400 text-sm mt-1">Isi jurnal terlebih dahulu di menu Isi Jurnal.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 w-8">No</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-8 bg-slate-50 min-w-[160px]">Nama Siswa</th>
                  {filteredJournals.map(j => (
                    <th key={j.id} className="px-2 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[80px]">
                      <div>{formatDate(j.date)}</div>
                      {j.subject && <div className="font-normal text-slate-400 normal-case truncate max-w-[80px]">{j.subject}</div>}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider min-w-[80px]">Rata-rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kelasStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-slate-400 text-xs text-center sticky left-0 bg-white">{idx + 1}</td>
                    <td className="px-3 py-2.5 sticky left-8 bg-white">
                      <p className="font-semibold text-slate-900">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.nis}</p>
                    </td>
                    {filteredJournals.map(j => {
                      const val     = getGrade(student.id, j.id);
                      const num     = val === '' ? null : Number(val);
                      const colorClass = num === null ? '' : num >= 75 ? 'text-emerald-700' : num >= 60 ? 'text-amber-700' : 'text-rose-700';
                      return (
                        <td key={j.id} className="px-2 py-2.5 text-center">
                          <input type="number" min="0" max="100" value={val}
                            onChange={e => handleGradeChange(student.id, j.id, e.target.value)}
                            placeholder="—"
                            className={`w-16 text-center px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-sm font-semibold transition-colors ${colorClass}`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const avg = getAverage(student.id);
                        const num = avg === '-' ? null : Number(avg);
                        return (
                          <span className={`text-sm font-bold ${num === null ? 'text-slate-400' : num >= 75 ? 'text-emerald-700' : num >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {avg}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasUnsaved && (
            <div className="px-5 py-4 border-t border-slate-100 bg-amber-50 flex items-center justify-between">
              <p className="text-sm text-amber-700 font-medium">⚠ Ada nilai yang belum disimpan</p>
              <button onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                Simpan Sekarang
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}