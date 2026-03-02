import React, { useState, useEffect, useRef, useMemo } from 'react';
import { JournalEntry, AttendanceStatus } from '../types';
import { Save, X, Calendar, BookOpen, Users, FileText, Clock as ClockIcon, Camera, Image as ImageIcon, AlertCircle, Info } from 'lucide-react';
import { Student } from '../hooks/useStudents';
import { TugasGuru } from '../hooks/useTugas';

type JournalFormProps = {
  onSubmit: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  classes: string[];
  students: Student[];
  tugasGuru?: TugasGuru;
};

const ATTENDANCE_OPTIONS: {
  status: AttendanceStatus;
  label: string;
  short: string;
  active: string;
  inactive: string;
  summaryBg: string;
  summaryText: string;
  summaryValue: string;
}[] = [
  {
    status: 'present', label: 'Hadir', short: 'H',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-300 ring-emerald-200',
    inactive: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
    summaryBg: 'bg-emerald-50 border-emerald-100', summaryText: 'text-emerald-700', summaryValue: 'text-emerald-600',
  },
  {
    status: 'sick', label: 'Sakit', short: 'S',
    active: 'bg-amber-100 text-amber-700 border-amber-300 ring-amber-200',
    inactive: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
    summaryBg: 'bg-amber-50 border-amber-100', summaryText: 'text-amber-700', summaryValue: 'text-amber-600',
  },
  {
    status: 'permission', label: 'Izin', short: 'I',
    active: 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200',
    inactive: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
    summaryBg: 'bg-blue-50 border-blue-100', summaryText: 'text-blue-700', summaryValue: 'text-blue-600',
  },
  {
    status: 'absent', label: 'Alpa', short: 'A',
    active: 'bg-rose-100 text-rose-700 border-rose-300 ring-rose-200',
    inactive: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',
    summaryBg: 'bg-rose-50 border-rose-100', summaryText: 'text-rose-700', summaryValue: 'text-rose-600',
  },
];

type FormErrors = {
  subject?: string;
  topic?: string;
  photo?: string;
};

export function JournalForm({ onSubmit, onCancel, classes, students, tugasGuru }: JournalFormProps) {

  // Kelas yang tersedia — dari tugas guru jika ada, fallback ke semua kelas
  const availableKelas = useMemo(() => {
    if (tugasGuru && (tugasGuru.kelas ?? []).length > 0) {
      return (tugasGuru.kelas ?? []).map(k => k.namaKelas).sort();
    }
    return classes;
  }, [tugasGuru, classes]);

  // Mapel tersedia untuk kelas tertentu — dari tugas guru
  const getMapelForKelas = (namaKelas: string): string[] => {
    if (!tugasGuru) return [];
    const kelasItem = (tugasGuru.kelas ?? []).find(k => k.namaKelas === namaKelas);
    return Array.from(new Set((kelasItem?.mapel ?? []).map(m => m.namaMapel).filter(Boolean)));
  };

  const hasTugas = tugasGuru && (tugasGuru.kelas ?? []).length > 0;

  // Gunakan tanggal lokal agar sesuai timezone guru (bukan UTC)
  const getLocalDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [formData, setFormData] = useState({
    date: getLocalDateString(),
    startTime: '1',
    endTime: '2',
    className: availableKelas.length > 0 ? availableKelas[0] : '',
    subject: '',
    topic: '',
    learningObjective: '',
    notes: '',
  });

  const [studentAttendance, setStudentAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);

  const classStudents = students.filter(s => s.className === formData.className);
  const mapelOptions  = getMapelForKelas(formData.className);

  useEffect(() => {
    const initialAttendance: Record<string, AttendanceStatus> = {};
    classStudents.forEach(student => { initialAttendance[student.id] = 'present'; });
    setStudentAttendance(initialAttendance);
  }, [formData.className, students]);

  useEffect(() => {
    if (submitted) validate();
  }, [formData.subject, formData.topic, photoUrl, submitted]);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!formData.subject.trim()) errs.subject = 'Mata pelajaran wajib dipilih.';
    if (!formData.topic.trim())   errs.topic   = 'Topik / materi wajib diisi.';
    if (!photoUrl)                errs.photo   = 'Foto pembelajaran wajib diupload.';
    setErrors(errs);
    return errs;
  };

  // Reset subject saat kelas berubah (mapelnya bisa berbeda)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'className') {
      setFormData(prev => ({ ...prev, className: value, subject: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleStudentAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setStudentAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const calculateTotalAttendance = () => {
    const totals: Record<AttendanceStatus, number> = { present: 0, sick: 0, permission: 0, absent: 0 };
    Object.values(studentAttendance).forEach(status => { totals[status as AttendanceStatus]++; });
    return totals;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!formData.className) {
      alert('Silakan pilih atau buat kelas terlebih dahulu di menu Data Siswa.');
      return;
    }

    const errs = validate();

    // Scroll ke field pertama yang error
    if (errs.subject) {
      subjectRef.current?.focus();
      subjectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (errs.topic) {
      topicRef.current?.focus();
      topicRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (errs.photo) {
      photoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const absentNames = classStudents
      .filter(s => studentAttendance[s.id] && studentAttendance[s.id] !== 'present')
      .map(s => {
        const status = studentAttendance[s.id];
        const code = status === 'sick' ? 'S' : status === 'permission' ? 'I' : 'A';
        return `${s.name} (${code})`;
      })
      .join(', ');

    onSubmit({
      ...formData,
      attendance: calculateTotalAttendance(),
      studentAttendance,
      absentStudentNames: absentNames,
      photoUrl,
    });
  };

  const attendanceTotals = calculateTotalAttendance();

  const inputError = 'border-rose-400 bg-rose-50 focus:ring-rose-400 focus:border-rose-400';
  const inputNormal = 'border-slate-200 bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
          Isi Jurnal Baru
        </h2>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8" noValidate>

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
                max={getLocalDateString()}
                onChange={e => {
                  // Tidak boleh pilih tanggal masa depan
                  if (e.target.value <= getLocalDateString()) {
                    handleChange(e);
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900"
              />
              <p className="mt-1 text-[11px] text-slate-400">Hanya dapat memilih hari ini atau sebelumnya.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Jam Mengajar (Ke-)</label>
              <div className="flex items-center justify-between">
                <div className="relative flex-1">
                  <select name="startTime" value={formData.startTime} onChange={handleChange}
                    className="w-full bg-transparent text-slate-900 font-bold text-lg focus:outline-none appearance-none cursor-pointer pr-8">
                    {[...Array(11)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                    <ClockIcon className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <span className="text-slate-400 font-medium px-4">s/d</span>
                <div className="relative flex-1">
                  <select name="endTime" value={formData.endTime} onChange={handleChange}
                    className="w-full bg-transparent text-slate-900 font-bold text-lg focus:outline-none appearance-none cursor-pointer pr-8 text-right">
                    {[...Array(11)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                    <ClockIcon className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kelas — dari tugas guru */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kelas <span className="text-rose-500">*</span>
              </label>
              {hasTugas ? (
                <select
                  name="className"
                  value={formData.className}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 appearance-none"
                >
                  {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              ) : (
                <>
                  <select
                    name="className"
                    value={formData.className}
                    onChange={handleChange}
                    disabled={availableKelas.length === 0}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 appearance-none disabled:opacity-50"
                  >
                    {availableKelas.length > 0
                      ? availableKelas.map(k => <option key={k} value={k}>{k}</option>)
                      : <option value="">Belum ada kelas</option>}
                  </select>
                  {availableKelas.length === 0 && (
                    <p className="mt-1 text-xs text-rose-500">Kelas belum tersedia. Hubungi Admin.</p>
                  )}
                </>
              )}
            </div>

            {/* Mata Pelajaran — dropdown dari tugas guru */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              {hasTugas && mapelOptions.length > 0 ? (
                <>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 transition-colors text-slate-900 appearance-none ${errors.subject ? inputError : inputNormal}`}
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {mapelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {errors.subject && (
                    <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{errors.subject}
                    </p>
                  )}
                </>
              ) : hasTugas && mapelOptions.length === 0 ? (
                <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Belum ada mata pelajaran untuk kelas <strong>{formData.className}</strong>. Hubungi Admin untuk mengisi menu Tugas.
                  </p>
                </div>
              ) : (
                <>
                  <input
                    ref={subjectRef}
                    type="text"
                    name="subject"
                    placeholder="Contoh: Matematika"
                    value={formData.subject}
                    onChange={handleChange}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 transition-colors text-slate-900 ${errors.subject ? inputError : inputNormal}`}
                  />
                  <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />Tugas mengajar belum diatur oleh Admin.
                  </p>
                  {errors.subject && (
                    <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{errors.subject}
                    </p>
                  )}
                </>
              )}
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

            {/* Topik — WAJIB */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Topik / Materi <span className="text-rose-500">*</span>
              </label>
              <textarea
                ref={topicRef}
                name="topic"
                rows={3}
                placeholder="Jelaskan materi yang diajarkan hari ini..."
                value={formData.topic}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 transition-colors text-slate-900 resize-none ${errors.topic ? inputError : inputNormal}`}
              />
              {errors.topic && (
                <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />{errors.topic}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tujuan Pembelajaran</label>
              <textarea name="learningObjective" rows={3} placeholder="Tujuan yang ingin dicapai pada pembelajaran ini..." value={formData.learningObjective} onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 resize-none" />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Kehadiran */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <Users className="w-4 h-4 mr-2 text-slate-400" />
              Kehadiran Siswa
            </h3>
            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Total: {classStudents.length} Siswa
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ATTENDANCE_OPTIONS.map(opt => (
              <div key={opt.status} className={`p-2 rounded-xl border text-center ${opt.summaryBg}`}>
                <span className={`block text-xs font-medium mb-0.5 ${opt.summaryText}`}>{opt.label}</span>
                <span className={`block text-xl font-bold ${opt.summaryValue}`}>{attendanceTotals[opt.status]}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
            {ATTENDANCE_OPTIONS.map(opt => (
              <span key={opt.status} className="flex items-center gap-1">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded font-bold text-[10px] border ${opt.active}`}>{opt.short}</span>
                {opt.label}
              </span>
            ))}
          </div>
          {classStudents.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 font-medium w-8 text-center">No</th>
                    <th className="px-3 py-3 font-medium">Nama Siswa</th>
                    <th className="px-3 py-3 font-medium text-center">Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((student, index) => {
                    const current = studentAttendance[student.id] ?? 'present';
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-3 text-slate-400 text-center text-xs">{index + 1}</td>
                        <td className="px-3 py-3 font-medium text-slate-900 text-sm">{student.name}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-center">
                            {ATTENDANCE_OPTIONS.map(opt => (
                              <button key={opt.status} type="button" title={opt.label}
                                onClick={() => handleStudentAttendanceChange(student.id, opt.status)}
                                className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
                                  current === opt.status ? `${opt.active} ring-2 ring-offset-1` : opt.inactive
                                }`}>
                                {opt.short}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

        {/* Foto Pembelajaran — WAJIB */}
        <div className="space-y-3" ref={photoRef}>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
            <Camera className="w-4 h-4 mr-2 text-slate-400" />
            Foto Pembelajaran <span className="text-rose-500 ml-1">*</span>
          </h3>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
          {photoUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              <img src={photoUrl} alt="Foto Pembelajaran" className="w-full h-48 object-cover" />
              <button type="button" onClick={() => setPhotoUrl(undefined)}
                className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-lg text-slate-700 hover:text-rose-600 hover:bg-white transition-colors shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                errors.photo
                  ? 'border-rose-400 bg-rose-50 text-rose-500 hover:bg-rose-100'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              <ImageIcon className={`w-8 h-8 mb-2 ${errors.photo ? 'text-rose-400' : 'text-slate-400'}`} />
              <span className="text-sm font-medium">Klik untuk upload foto kegiatan</span>
            </button>
          )}
          {errors.photo && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.photo}
            </p>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Catatan */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
            <FileText className="w-4 h-4 mr-2 text-slate-400" />
            Catatan Tambahan
          </h3>
          <textarea name="notes" rows={2} placeholder="Catatan khusus, evaluasi, atau kejadian penting..." value={formData.notes} onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 resize-none" />
        </div>

        {/* Ringkasan error di atas tombol simpan */}
        {submitted && Object.keys(errors).length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-rose-700">
              <p className="font-semibold mb-1">Harap lengkapi isian berikut:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                {errors.subject && <li>{errors.subject}</li>}
                {errors.topic   && <li>{errors.topic}</li>}
                {errors.photo   && <li>{errors.photo}</li>}
              </ul>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end space-x-3">
          <button type="button" onClick={onCancel}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Batal
          </button>
          <button type="submit" disabled={availableKelas.length === 0}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4 mr-2" />
            Simpan Jurnal
          </button>
        </div>
      </form>
    </div>
  );
}