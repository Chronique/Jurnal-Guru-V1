import { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import { Student } from '../hooks/useStudents';
import {
  Activity, Search, Filter, ChevronDown, BookOpen,
  Users, Calendar, Clock, Image as ImageIcon, Eye, X,
} from 'lucide-react';

type MonitoringProps = {
  journals: JournalEntry[];
  students: Student[];
};

export function Monitoring({ journals, students }: MonitoringProps) {

  const [search, setSearch]           = useState('');
  const [filterGuru, setFilterGuru]   = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Daftar guru unik dari jurnal
  const guruList = useMemo(() =>
    Array.from(new Set(journals.map(j => j.teacherName).filter(Boolean))).sort()
  , [journals]);

  // Daftar kelas unik
  const kelasList = useMemo(() =>
    Array.from(new Set(journals.map(j => j.className).filter(Boolean))).sort()
  , [journals]);

  const filtered = useMemo(() => {
    let result = [...journals];
    if (filterGuru)  result = result.filter(j => j.teacherName === filterGuru);
    if (filterKelas) result = result.filter(j => j.className === filterKelas);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(j =>
        j.teacherName?.toLowerCase().includes(q) ||
        j.className?.toLowerCase().includes(q) ||
        j.subject?.toLowerCase().includes(q) ||
        j.topic?.toLowerCase().includes(q)
      );
    }
    // Urutkan: terbaru dulu (berdasarkan waktu input = createdAt)
    return result.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [journals, filterGuru, filterKelas, search]);

  // Format tanggal jurnal (date field = tanggal mengajar)
  const formatTanggal = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  // Format waktu input (createdAt = kapan guru klik simpan)
  const formatWaktuInput = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
      }) + ' ' + d.toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return isoStr; }
  };

  // Relative time (berapa lama yang lalu)
  const relativeTime = (isoStr: string) => {
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1)   return 'Baru saja';
      if (diffMin < 60)  return `${diffMin} menit lalu`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24)    return `${diffH} jam lalu`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 30)    return `${diffD} hari lalu`;
      return formatWaktuInput(isoStr);
    } catch { return ''; }
  };

  const getAttTotal = (j: JournalEntry) => {
    const att = (j.attendance ?? {}) as Record<string, number>;
    return Object.values(att).reduce((a, v) => a + v, 0);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-500" />
          Monitoring Jurnal
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {journals.length} jurnal dari {guruList.length} guru
        </p>
      </div>

      {/* Stat ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Jurnal',   value: journals.length,   color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
          { label: 'Total Guru',     value: guruList.length,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Total Kelas',    value: kelasList.length,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
          { label: 'Total Siswa',    value: students.length,   color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Filter className="w-4 h-4 text-slate-400" />
          Filter
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text" placeholder="Cari guru, kelas, mapel..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
            />
          </div>
          {/* Filter guru */}
          <div className="relative">
            <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-slate-50 appearance-none">
              <option value="">Semua Guru</option>
              {guruList.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {/* Filter kelas */}
          <div className="relative">
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 bg-slate-50 appearance-none">
              <option value="">Semua Kelas</option>
              {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        {(filterGuru || filterKelas || search) && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{filtered.length} hasil</span>
            <button onClick={() => { setFilterGuru(''); setFilterKelas(''); setSearch(''); }}
              className="flex items-center gap-1 text-rose-500 hover:text-rose-600 font-medium">
              <X className="w-3 h-3" /> Reset filter
            </button>
          </div>
        )}
      </div>

      {/* Tabel jurnal */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Belum ada jurnal.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Guru</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />Tgl Mengajar</div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kelas · Mapel</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Topik</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1"><Users className="w-3 h-3" />Hadir</div>
                  </th>
                  {/* Kolom waktu input — BARU */}
                  <th className="px-4 py-3 text-left text-xs font-bold text-indigo-600 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" />Waktu Input</div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(j => {
                  const attTotal = getAttTotal(j);
                  const hadir = (j.attendance as Record<string, number>)?.['present'] ?? 0;
                  return (
                    <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Guru */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 text-sm">{j.teacherName ?? '-'}</p>
                      </td>
                      {/* Tgl mengajar */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">
                        {formatTanggal(j.date)}
                        <div className="text-[10px] text-slate-400">Jam ke-{j.startTime}–{j.endTime}</div>
                      </td>
                      {/* Kelas · Mapel */}
                      <td className="px-4 py-3">
                        <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full mb-0.5">{j.className}</span>
                        <p className="text-xs text-slate-600">{j.subject}</p>
                      </td>
                      {/* Topik */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-xs text-slate-700 line-clamp-2">{j.topic || '-'}</p>
                      </td>
                      {/* Hadir */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${hadir > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {hadir}
                        </span>
                        {attTotal > 0 && (
                          <span className="text-xs text-slate-400">/{attTotal}</span>
                        )}
                      </td>
                      {/* Waktu Input — tampilkan createdAt */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-semibold text-slate-700">{formatWaktuInput(j.createdAt)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{relativeTime(j.createdAt)}</p>
                      </td>
                      {/* Foto */}
                      <td className="px-4 py-3 text-center">
                        {j.photoUrl ? (
                          <button
                            onClick={() => setPreviewPhoto(j.photoUrl!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Lihat
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs flex items-center justify-center gap-1">
                            <ImageIcon className="w-3 h-3" />–
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal preview foto */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-600 hover:text-rose-500 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={previewPhoto} alt="Foto Pembelajaran" className="w-full rounded-2xl shadow-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}