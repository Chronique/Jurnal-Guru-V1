import { useState } from 'react';
import { JournalEntry } from '../types';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Search, Filter, Calendar as CalendarIcon, Clock, Users, Trash2, ChevronDown } from 'lucide-react';

type HistoryProps = {
  journals: JournalEntry[];
  onDelete: (id: string) => void;
};

export function History({ journals, onDelete }: HistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredJournals = journals.filter((journal) => 
    journal.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    journal.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
    journal.topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Riwayat Jurnal</h2>
        <p className="text-slate-500">Daftar seluruh jurnal mengajar yang telah Anda buat.</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari mata pelajaran, kelas, atau topik..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
          />
        </div>
        <button className="inline-flex items-center justify-center px-4 py-2.5 border border-slate-200 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
          <Filter className="h-4 w-4 mr-2 text-slate-500" />
          Filter
        </button>
      </div>

      {/* Journal List */}
      <div className="space-y-4">
        {filteredJournals.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
            <CalendarIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">Tidak ada jurnal</h3>
            <p className="mt-1 text-sm text-slate-500">Belum ada jurnal yang sesuai dengan pencarian Anda.</p>
          </div>
        ) : (
          filteredJournals.map((journal) => (
            <div 
              key={journal.id} 
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                expandedId === journal.id ? 'border-indigo-200 shadow-md' : 'border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {/* Header / Summary */}
              <div 
                className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                onClick={() => toggleExpand(journal.id)}
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border transition-colors ${
                    expandedId === journal.id ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                  }`}>
                    <span className={`text-xs font-bold uppercase ${expandedId === journal.id ? 'text-indigo-200' : 'text-indigo-600'}`}>
                      {format(parseISO(journal.date), 'MMM', { locale: id })}
                    </span>
                    <span className="text-lg font-black leading-none">
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
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto pl-16 sm:pl-0">
                  <div className="flex -space-x-2 mr-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-xs font-bold text-emerald-700" title="Hadir">
                      {journal.attendance.present}
                    </div>
                    {(journal.attendance.sick > 0 || journal.attendance.permission > 0 || journal.attendance.absent > 0) && (
                      <div className="w-8 h-8 rounded-full bg-rose-100 border-2 border-white flex items-center justify-center text-xs font-bold text-rose-700" title="Tidak Hadir">
                        {journal.attendance.sick + journal.attendance.permission + journal.attendance.absent}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedId === journal.id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === journal.id && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                        Detail Waktu
                      </h5>
                      <p className="text-sm text-slate-900 font-medium">
                        {format(parseISO(journal.date), 'EEEE, dd MMMM yyyy', { locale: id })}
                      </p>
                      <p className="text-sm text-slate-600 mt-1 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Jam ke {journal.startTime} s/d {journal.endTime}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        Detail Kehadiran
                      </h5>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                          <span className="block text-xs text-emerald-600 font-medium">Hadir</span>
                          <span className="block text-sm font-bold text-emerald-700">{journal.attendance.present}</span>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                          <span className="block text-xs text-amber-600 font-medium">Sakit</span>
                          <span className="block text-sm font-bold text-amber-700">{journal.attendance.sick}</span>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                          <span className="block text-xs text-blue-600 font-medium">Izin</span>
                          <span className="block text-sm font-bold text-blue-700">{journal.attendance.permission}</span>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-2 border border-rose-100">
                          <span className="block text-xs text-rose-600 font-medium">Alpa</span>
                          <span className="block text-sm font-bold text-rose-700">{journal.attendance.absent}</span>
                        </div>
                      </div>
                      {journal.absentStudentNames && (
                        <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <p className="text-xs font-medium text-slate-500 mb-1">Siswa Tidak Hadir:</p>
                          <p className="text-sm font-bold text-slate-700">{journal.absentStudentNames}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Topik Pembelajaran</h5>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap">
                      {journal.topic}
                    </div>
                  </div>

                  {journal.learningObjective && (
                    <div className="mt-4">
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tujuan Pembelajaran</h5>
                      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900 whitespace-pre-wrap">
                        {journal.learningObjective}
                      </div>
                    </div>
                  )}

                  {journal.notes && (
                    <div className="mt-4">
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Catatan Tambahan</h5>
                      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 whitespace-pre-wrap">
                        {journal.notes}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Apakah Anda yakin ingin menghapus jurnal ini?')) {
                          onDelete(journal.id);
                        }
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-rose-200 text-xs font-medium rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Hapus Jurnal
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
