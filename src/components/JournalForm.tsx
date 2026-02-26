import React, { useState, useEffect } from 'react';
import { JournalEntry, AttendanceStatus } from '../types';
import { Save, X, Calendar, Clock, BookOpen, Users, FileText, CheckCircle2, XCircle, AlertCircle, Clock as ClockIcon } from 'lucide-react';
import { Student } from '../hooks/useStudents';

type JournalFormProps = {
  onSubmit: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  classes: string[];
  students: Student[];
};

export function JournalForm({ onSubmit, onCancel, classes, students }: JournalFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '07:00',
    endTime: '08:30',
    className: classes.length > 0 ? classes[0] : '',
    subject: '',
    topic: '',
    learningObjective: '',
    notes: '',
  });

  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceStatus>>({});

  // Filter students by selected class
  const classStudents = students.filter(s => s.className === formData.className);

  // Initialize attendance when class changes
  useEffect(() => {
    const initialAttendance: Record<string, AttendanceStatus> = {};
    classStudents.forEach(student => {
      initialAttendance[student.id] = 'present';
    });
    setStudentAttendance(initialAttendance);
  }, [formData.className, students]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStudentAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setStudentAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const calculateTotalAttendance = () => {
    const totals: Record<AttendanceStatus, number> = {
      present: 0,
      sick: 0,
      permission: 0,
      absent: 0,
    };

    Object.values(studentAttendance).forEach(status => {
      totals[status as AttendanceStatus]++;
    });

    return totals;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.className) {
      alert('Silakan pilih atau buat kelas terlebih dahulu di menu Data Siswa.');
      return;
    }
    
    onSubmit({
      ...formData,
      attendance: calculateTotalAttendance(),
      studentAttendance,
    });
  };

  const attendanceTotals = calculateTotalAttendance();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
          Isi Jurnal Baru
        </h2>
        <button 
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* Waktu & Kelas */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            Waktu & Kelas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal</label>
              <input
                type="date"
                name="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mulai</label>
                <input
                  type="time"
                  name="startTime"
                  required
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Selesai</label>
                <input
                  type="time"
                  name="endTime"
                  required
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Kelas</label>
              <select
                name="className"
                required
                value={formData.className}
                onChange={handleChange}
                disabled={classes.length === 0}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 appearance-none disabled:opacity-50"
              >
                {classes.length > 0 ? (
                  classes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))
                ) : (
                  <option value="">Belum ada kelas</option>
                )}
              </select>
              {classes.length === 0 && (
                <p className="mt-1 text-xs text-rose-500">Silakan tambahkan kelas di menu Data Siswa.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mata Pelajaran</label>
              <input
                type="text"
                name="subject"
                required
                placeholder="Contoh: Matematika"
                value={formData.subject}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Materi */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
            <FileText className="w-4 h-4 mr-2 text-slate-400" />
            Materi Pembelajaran
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Topik / Materi</label>
              <textarea
                name="topic"
                required
                rows={3}
                placeholder="Jelaskan materi yang diajarkan hari ini..."
                value={formData.topic}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tujuan Pembelajaran</label>
              <textarea
                name="learningObjective"
                rows={3}
                placeholder="Tujuan yang ingin dicapai pada pembelajaran ini..."
                value={formData.learningObjective}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 resize-none"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Kehadiran */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <Users className="w-4 h-4 mr-2 text-slate-400" />
              Kehadiran Siswa
            </h3>
            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Total: {classStudents.length} Siswa
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-emerald-800 mb-1">Hadir</span>
              <span className="text-2xl font-bold text-emerald-600">{attendanceTotals.present}</span>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-amber-800 mb-1">Sakit</span>
              <span className="text-2xl font-bold text-amber-600">{attendanceTotals.sick}</span>
            </div>
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-blue-800 mb-1">Izin</span>
              <span className="text-2xl font-bold text-blue-600">{attendanceTotals.permission}</span>
            </div>
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-rose-800 mb-1">Alpa</span>
              <span className="text-2xl font-bold text-rose-600">{attendanceTotals.absent}</span>
            </div>
          </div>

          {/* Student List */}
          {classStudents.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12 text-center">No</th>
                    <th className="px-4 py-3 font-medium">Nama Siswa</th>
                    <th className="px-4 py-3 font-medium text-center">Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-center">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStudentAttendanceChange(student.id, 'present')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              studentAttendance[student.id] === 'present'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStudentAttendanceChange(student.id, 'sick')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              studentAttendance[student.id] === 'sick'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Sakit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStudentAttendanceChange(student.id, 'permission')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              studentAttendance[student.id] === 'permission'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStudentAttendanceChange(student.id, 'absent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              studentAttendance[student.id] === 'absent'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Alpa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Belum ada siswa di kelas ini.</p>
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Catatan */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
            <FileText className="w-4 h-4 mr-2 text-slate-400" />
            Catatan Tambahan
          </h3>
          <div>
            <textarea
              name="notes"
              rows={2}
              placeholder="Catatan khusus, evaluasi, atau kejadian penting..."
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 resize-none"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={classes.length === 0}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            Simpan Jurnal
          </button>
        </div>
      </form>
    </div>
  );
}
