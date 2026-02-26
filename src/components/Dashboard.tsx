import { JournalEntry } from '../types';
import { BookOpen, Users, Calendar, Clock, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

type DashboardProps = {
  journals: JournalEntry[];
  onNavigate: (tab: string) => void;
};

export function Dashboard({ journals, onNavigate }: DashboardProps) {
  const recentJournals = journals.slice(0, 5);
  
  const totalStudentsPresent = journals.reduce((acc, curr) => acc + curr.attendance.present, 0);
  const totalClasses = journals.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Selamat Datang, Guru!</h2>
        <p className="text-slate-500">Berikut adalah ringkasan aktivitas mengajar Anda.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-3xl font-bold text-slate-900">{totalClasses}</span>
          <span className="text-sm font-medium text-slate-500 mt-1">Total Jurnal</span>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-3xl font-bold text-slate-900">{totalStudentsPresent}</span>
          <span className="text-sm font-medium text-slate-500 mt-1">Siswa Hadir</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-3xl font-bold text-slate-900">
            {new Set(journals.map(j => j.date)).size}
          </span>
          <span className="text-sm font-medium text-slate-500 mt-1">Hari Mengajar</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-3xl font-bold text-slate-900">
            {journals.reduce((acc, curr) => {
              const start = parseInt(curr.startTime) || 1;
              const end = parseInt(curr.endTime) || 1;
              const hours = Math.max(1, end - start + 1);
              return acc + hours;
            }, 0)}
          </span>
          <span className="text-sm font-medium text-slate-500 mt-1">Total Jam Pelajaran</span>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Jurnal Terbaru</h3>
          <button 
            onClick={() => onNavigate('history')}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center"
          >
            Lihat Semua <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        <div className="divide-y divide-slate-100">
          {recentJournals.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">Belum ada jurnal yang diisi.</p>
              <button 
                onClick={() => onNavigate('add')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Isi Jurnal Sekarang
              </button>
            </div>
          ) : (
            recentJournals.map((journal) => (
              <div key={journal.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center flex-shrink-0 border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-600 uppercase">
                      {format(parseISO(journal.date), 'MMM', { locale: id })}
                    </span>
                    <span className="text-lg font-black text-indigo-700 leading-none">
                      {format(parseISO(journal.date), 'dd')}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">{journal.subject}</h4>
                    <p className="text-sm text-slate-500 mt-0.5 flex items-center">
                      <span className="font-medium text-slate-700">{journal.className}</span>
                      <span className="mx-2 w-1 h-1 rounded-full bg-slate-300"></span>
                      Jam ke {journal.startTime} - {journal.endTime}
                    </p>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-1">{journal.topic}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 sm:self-center pl-16 sm:pl-0">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-xs font-bold text-emerald-700" title="Hadir">
                      {journal.attendance.present}
                    </div>
                    {(journal.attendance.sick > 0 || journal.attendance.permission > 0 || journal.attendance.absent > 0) && (
                      <div className="w-8 h-8 rounded-full bg-rose-100 border-2 border-white flex items-center justify-center text-xs font-bold text-rose-700" title="Tidak Hadir">
                        {journal.attendance.sick + journal.attendance.permission + journal.attendance.absent}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
