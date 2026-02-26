import React, { useState, useRef } from 'react';
import { Student } from '../hooks/useStudents';
import { Users, Plus, Trash2, Search, Upload } from 'lucide-react';

type StudentsProps = {
  students: Student[];
  onAdd: (student: Omit<Student, 'id'>) => void;
  onAddStudents: (students: Omit<Student, 'id'>[]) => void;
  onDelete: (id: string) => void;
  onDeleteClass: (className: string) => void;
};

export function Students({ students, onAdd, onAddStudents, onDelete, onDeleteClass }: StudentsProps) {
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newStudent, setNewStudent] = useState({ name: '', nis: '' });
  const [newClass, setNewClass] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique classes from students
  const classes = Array.from(new Set(students.map(s => s.className))).sort();

  // If no class is selected but classes exist, select the first one
  if (!selectedClass && classes.length > 0) {
    setSelectedClass(classes[0]);
  }

  const filteredStudents = students.filter(
    (s) =>
      s.className === selectedClass &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nis.includes(searchTerm))
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.nis || !selectedClass) return;
    
    onAdd({
      name: newStudent.name,
      nis: newStudent.nis,
      className: selectedClass,
    });
    
    setNewStudent({ name: '', nis: '' });
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.trim()) return;
    
    const className = newClass.trim();
    if (!classes.includes(className)) {
      setSelectedClass(className);
    }
    setNewClass('');
  };

  const handleDeleteClass = () => {
    if (!selectedClass) return;
    if (confirm(`Apakah Anda yakin ingin menghapus kelas ${selectedClass} beserta seluruh data siswanya?`)) {
      onDeleteClass(selectedClass);
      setSelectedClass('');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const newStudents: Omit<Student, 'id'>[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Try to split by comma or semicolon
        const separator = line.includes(';') ? ';' : ',';
        const parts = line.split(separator);
        
        if (parts.length >= 2) {
          const nis = parts[0].trim();
          const name = parts[1].trim();
          
          // Skip header row if it exists
          if (nis.toLowerCase() === 'nis' || name.toLowerCase() === 'nama' || name.toLowerCase() === 'nama siswa') continue;

          newStudents.push({
            nis,
            name,
            className: selectedClass
          });
        }
      }

      if (newStudents.length > 0) {
        onAddStudents(newStudents);
        alert(`Berhasil mengimpor ${newStudents.length} siswa ke kelas ${selectedClass}`);
      } else {
        alert('Format CSV tidak valid atau kosong. Gunakan format: NIS,Nama');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data Siswa</h2>
        <p className="text-slate-500">Kelola daftar siswa untuk setiap kelas yang Anda ajar.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Controls & Add Form */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-slate-900">Pilih Kelas</label>
              {selectedClass && (
                <button
                  onClick={handleDeleteClass}
                  className="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Hapus Kelas
                </button>
              )}
            </div>
            <div className="space-y-3">
              {classes.length > 0 ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-slate-50 font-medium text-slate-900"
                  >
                    {classes.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Belum ada kelas.</p>
              )}

              <form onSubmit={handleAddClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama kelas baru..."
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={!newClass.trim()}
                  className="px-3 py-2 bg-slate-100 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Tambah
                </button>
              </form>
            </div>
          </div>

          {selectedClass && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <Plus className="w-4 h-4 mr-1.5 text-indigo-600" />
                  Tambah Siswa Baru
                </h3>
                <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center bg-indigo-50 px-2 py-1 rounded-md transition-colors">
                  <Upload className="w-3 h-3 mr-1" />
                  Import CSV
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleImport} 
                    ref={fileInputRef}
                  />
                </label>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NIS</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 1001"
                    value={newStudent.nis}
                    onChange={(e) => setNewStudent({ ...newStudent, nis: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Budi"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Simpan ke {selectedClass}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Student List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              Daftar Siswa {selectedClass && <span className="text-indigo-600 ml-1">({filteredStudents.length})</span>}
            </h3>
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Cari nama atau NIS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!selectedClass}
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedClass ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">Pilih atau buat kelas terlebih dahulu</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">Belum ada data siswa</p>
                <p className="text-xs text-slate-500 mt-1">
                  Silakan tambahkan siswa untuk kelas {selectedClass} melalui form di samping.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-5 py-3 font-medium">No</th>
                    <th className="px-5 py-3 font-medium">NIS</th>
                    <th className="px-5 py-3 font-medium">Nama Siswa</th>
                    <th className="px-5 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-500 w-12">{index + 1}</td>
                      <td className="px-5 py-3 text-slate-500 font-mono text-xs w-24">{student.nis}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{student.name}</td>
                      <td className="px-5 py-3 text-right w-24">
                        <button
                          onClick={() => {
                            if (confirm(`Hapus ${student.name} dari kelas ini?`)) {
                              onDelete(student.id);
                            }
                          }}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
