import { useMemo } from 'react';
import { JournalEntry } from '../types';
import { BookOpen, Users, Calendar, Clock, PlusCircle, TrendingUp } from 'lucide-react';
import { TugasGuru } from '../hooks/useTugas';
import { Student } from '../hooks/useStudents';

type DashboardProps = {
  journals: JournalEntry[];
  onNavigate: (tab: string) => void;
  tugasGuru?: TugasGuru;
  students?: Student[];
};

export function Dashboard({ journals, onNavigate, tugasGuru, students = [] }: DashboardProps) {

  const totalJamTarget = useMemo(() => {
    if (!tugasGuru) return 0;
    return (tugasGuru.kelas ?? []).reduce(
      (a, k) => a + k.mapel.reduce((b, m) => b + m.jamPerMinggu, 0), 0
    );
  }, [tugasGuru]);

  const totalPertemuanTarget = useMemo(() => {
    if (!tugasGuru) return 0;
    return (tugasGuru.kelas ?? []).reduce((total, k) => {
      // Deduplikasi: mapel nama sama dalam satu kelas → pakai pertemuanPerMinggu terbesar
      const byNama: Record<string, number> = {};
      (k.mapel ?? []).forEach(m => {
        const ppm = m.pertemuanPerMinggu ?? 1;
        if (!byNama[m.namaMapel] || ppm > byNama[m.namaMapel]) byNama[m.namaMapel] = ppm;
      });
      return total + Object.values(byNama).reduce((s, v) => s + v, 0);
    }, 0);
  }, [tugasGuru]);

  const totalJurnal = journals.length;

  const hariMengajar = useMemo(() => new Set(journals.map(j => j.date)).size, [journals]);

  const { totalHadir, totalSiswa } = useMemo(() => {
    // totalHadir = akumulasi siswa hadir dari semua jurnal
    let hadir = 0;
    journals.forEach(j => {
      const att = (j.attendance ?? {}) as Record<string, number>;
      hadir += att['present'] ?? 0;
    });
    // totalSiswa = jumlah siswa terdaftar di kelas yang diampu guru
    const kelasGuru = new Set((tugasGuru?.kelas ?? []).map(k => k.namaKelas));
    const siswaTarget = kelasGuru.size > 0
      ? students.filter(s => kelasGuru.has(s.className)).length
      : 0;
    return { totalHadir: hadir, totalSiswa: siswaTarget };
  }, [journals, students, tugasGuru]);

  const totalJamDiinput = useMemo(() => {
    return journals.reduce((acc, j) => {
      const start = parseInt(j.startTime) || 1;
      const end   = parseInt(j.endTime)   || 1;
      return acc + Math.max(end - start + 1, 1);
    }, 0);
  }, [journals]);

  const recentJournals = useMemo(() => {
    return [...journals]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [journals]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return dateStr; }
  };

  const stats = [
    {
      label: 'Total Jurnal',
      value: totalJurnal,
      target: totalPertemuanTarget > 0 ? totalPertemuanTarget : undefined,
      sub: totalPertemuanTarget > 0 ? `pertemuan/minggu` : undefined,
      icon: BookOpen,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
      progress: totalPertemuanTarget > 0
        ? Math.min(Math.round((totalJurnal / totalPertemuanTarget) * 100), 100)
        : undefined,
    },
    {
      label: 'Siswa Hadir',
      value: totalHadir,
      target: totalSiswa > 0 ? totalSiswa : undefined,
      sub: totalSiswa > 0 ? `total siswa` : undefined,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      progress: totalSiswa > 0 ? Math.round((totalHadir / totalSiswa) * 100) : undefined,
    },
    {
      label: 'Hari Mengajar',
      value: hariMengajar,
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
    {
      label: 'Total Jam Pelajaran',
      value: totalJamDiinput,
      target: totalJamTarget > 0 ? totalJamTarget : undefined,
      sub: totalJamTarget > 0 ? `jam/minggu target` : undefined,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      progress: totalJamTarget > 0
        ? Math.min(Math.round((totalJamDiinput / totalJamTarget) * 100), 100)
        : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Beranda</h2>
        <p className="text-slate-500 text-sm mt-0.5">Ringkasan aktivitas mengajar Anda.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                {stat.progress !== undefined && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    stat.progress >= 75 ? 'bg-emerald-100 text-emerald-700' :
                    stat.progress >= 40 ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {stat.progress}%
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                  {stat.target !== undefined && (
                    <p className="text-base font-bold text-slate-400">/{stat.target}</p>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</p>
                {stat.sub && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>
                )}
              </div>
              {stat.progress !== undefined && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stat.progress >= 75 ? 'bg-emerald-500' :
                      stat.progress >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recentJournals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Jurnal Terbaru
            </h3>
            <button onClick={() => onNavigate('history')} className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
              Lihat semua →
            </button>
          </div>
          <div className="space-y-2">
            {recentJournals.map(j => (
              <div key={j.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{j.subject}</p>
                  <p className="text-xs text-slate-500">{j.className} · {formatDate(j.date)}</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {j.attendance?.present ?? 0} hadir
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {journals.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-slate-600 font-semibold">Belum ada jurnal</p>
          <p className="text-slate-400 text-sm">Mulai isi jurnal pertama Anda hari ini.</p>
          <button
            onClick={() => onNavigate('add')}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Isi Jurnal Sekarang
          </button>
        </div>
      )}
    </div>
  );
}