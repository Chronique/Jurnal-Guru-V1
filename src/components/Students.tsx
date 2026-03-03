import React, { useState, useMemo } from 'react';
import { Student } from '../hooks/useStudents';
import {
  Users, Plus, Trash2, Pencil, X, Check, Upload,
  ChevronDown, ChevronUp, Search, AlertCircle,
} from 'lucide-react';

type StudentsProps = {
  students: Student[];
  onAdd: (student: Omit<Student, 'id'>) => void;
  onAddStudents: (students: Omit<Student, 'id'>[]) => void;
  onUpdate: (id: string, data: Partial<Student>) => void;
  onDelete: (id: string) => void;
  onDeleteClass: (className: string) => void;
};

type EditForm = { name: string; nis: string; className: string };

export function Students({
  students, onAdd, onAddStudents, onUpdate, onDelete, onDeleteClass,
}: StudentsProps) {

  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addForm, setAddForm] = useState<EditForm>({ name: '', nis: '', className: '' });
  const [addError, setAddError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', nis: '', className: '' });
  const [editError, setEditError] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, Student[]> = {};
    students.forEach(s => {
      if (!map[s.className]) map[s.className] = [];
      map[s.className].push(s);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [students]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped
      .map(([kls, list]) => [kls, list.filter(s =>
        s.name.toLowerCase().includes(q) || s.nis.includes(q)
      )] as [string, Student[]])
      .filter(([, list]) => list.length > 0);
  }, [grouped, search]);

  const handleAdd = () => {
    if (!addForm.name.trim()) { setAddError('Nama wajib diisi.'); return; }
    if (!addForm.nis.trim())  { setAddError('NIS wajib diisi.'); return; }
    if (!addForm.className.trim()) { setAddError('Kelas wajib diisi.'); return; }
    onAdd({ name: addForm.name.trim(), nis: addForm.nis.trim(), className: addForm.className.trim() });
    setAddForm({ name: '', nis: '', className: '' });
    setAddError('');
    setShowAddForm(false);
  };

  const startEdit = (s: Student) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, nis: s.nis, className: s.className });
    setEditError('');
  };

  const cancelEdit = () => { setEditingId(null); setEditError(''); };

  const saveEdit = (id: string) => {
    if (!editForm.name.trim()) { setEditError('Nama wajib diisi.'); return; }
    if (!editForm.nis.trim())  { setEditError('NIS wajib diisi.'); return; }
    if (!editForm.className.trim()) { setEditError('Kelas wajib diisi.'); return; }
    onUpdate(id, { name: editForm.name.trim(), nis: editForm.nis.trim(), className: editForm.className.trim() });
    setEditingId(null);
    setEditError('');
  };

  // ── CSV parser — support UTF-8, UTF-8 BOM, dan Windows-1252 ───────────────
  const parseCSV = (text: string) => {
    // Buang BOM jika ada
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
    const imported: Omit<Student, 'id'>[] = [];
    let skipped = 0;
    const startIdx = isNaN(Number(lines[0]?.split(',')[0]?.trim())) ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      let nis = '', name = '', className = '';
      if (cols.length >= 4)       { [, nis, name, className] = cols; }
      else if (cols.length === 3) { [nis, name, className] = cols; }
      else { skipped++; continue; }
      if (name && nis && className) { imported.push({ name, nis, className }); }
      else { skipped++; }
    }
    if (imported.length > 0) {
      onAddStudents(imported);
      setImportResult(`✓ ${imported.length} siswa berhasil diimport${skipped > 0 ? `, ${skipped} baris dilewati` : ''}.`);
    } else {
      setImportResult('⚠ Tidak ada data valid. Format: NIS, Nama, Kelas.');
    }
    setTimeout(() => setImportResult(null), 5000);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Jika ada karakter pengganti (karakter rusak), coba Windows-1252
      if (text.includes('\uFFFD')) {
        const reader2 = new FileReader();
        reader2.onload = (ev2) => parseCSV(ev2.target?.result as string);
        reader2.readAsText(file, 'windows-1252');
        return;
      }
      parseCSV(text);
    };
    // Baca dengan UTF-8 dulu (support BOM otomatis lewat parseCSV)
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 transition-colors';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Data Siswa
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">{students.length} siswa · {grouped.length} kelas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
            <Upload className="w-4 h-4" />
            Import CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport} />
          </label>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`px-4 py-3 rounded-xl text-sm border ${
          importResult.startsWith('✓')
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {importResult}
        </div>
      )}

      {/* Form tambah */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Tambah Siswa Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Nama Lengkap *" value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <input className={inputCls} placeholder="NIS *" value={addForm.nis}
              onChange={e => setAddForm(f => ({ ...f, nis: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <input className={inputCls} placeholder="Kelas (cth: IX A) *" value={addForm.className}
              onChange={e => setAddForm(f => ({ ...f, className: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              list="kelas-options" />
            <datalist id="kelas-options">
              {grouped.map(([k]) => <option key={k} value={k} />)}
            </datalist>
          </div>
          {addError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{addError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAddForm(false); setAddError(''); }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
              Batal
            </button>
            <button onClick={handleAdd}
              className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700">
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {students.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Cari nama atau NIS..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900" />
        </div>
      )}

      {/* Daftar kelas */}
      {filteredGrouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {students.length === 0 ? 'Belum ada data siswa.' : 'Tidak ada hasil pencarian.'}
          </p>
          {students.length === 0 && <p className="text-slate-400 text-sm mt-1">Klik "Tambah Siswa" atau import CSV.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGrouped.map(([kelas, list]) => {
            const isOpen = expandedClass === kelas;
            return (
              <div key={kelas} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  onClick={() => setExpandedClass(isOpen ? null : kelas)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <span className="text-xs font-black text-indigo-700">{list.length}</span>
                    </div>
                    <span className="font-bold text-slate-900">Kelas {kelas}</span>
                    <span className="text-xs text-slate-400">{list.length} siswa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Hapus semua ${list.length} siswa di kelas ${kelas}?`)) {
                          onDeleteClass(kelas);
                          if (expandedClass === kelas) setExpandedClass(null);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus seluruh kelas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-8">No</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Siswa</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">NIS</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kelas</th>
                          <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {list.map((student, idx) => {
                          const isEditing = editingId === student.id;
                          return (
                            <tr key={student.id} className={`transition-colors ${isEditing ? 'bg-indigo-50/60' : 'hover:bg-slate-50/50'}`}>
                              <td className="px-4 py-2.5 text-slate-400 text-xs">{idx + 1}</td>
                              {isEditing ? (
                                <>
                                  <td className="px-3 py-2">
                                    <input autoFocus className={inputCls} value={editForm.name}
                                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                      onKeyDown={e => e.key === 'Enter' && saveEdit(student.id)}
                                      placeholder="Nama *" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input className={inputCls} value={editForm.nis}
                                      onChange={e => setEditForm(f => ({ ...f, nis: e.target.value }))}
                                      onKeyDown={e => e.key === 'Enter' && saveEdit(student.id)}
                                      placeholder="NIS *" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input className={inputCls} value={editForm.className}
                                      onChange={e => setEditForm(f => ({ ...f, className: e.target.value }))}
                                      onKeyDown={e => e.key === 'Enter' && saveEdit(student.id)}
                                      placeholder="Kelas *" list="kelas-options-edit" />
                                    <datalist id="kelas-options-edit">
                                      {grouped.map(([k]) => <option key={k} value={k} />)}
                                    </datalist>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center justify-center gap-1.5 flex-col">
                                      {editError && <span className="text-[10px] text-rose-500">{editError}</span>}
                                      <div className="flex gap-1.5">
                                        <button onClick={() => saveEdit(student.id)}
                                          className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors" title="Simpan">
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={cancelEdit}
                                          className="p-1.5 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors" title="Batal">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-2.5 font-medium text-slate-900">{student.name}</td>
                                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{student.nis}</td>
                                  <td className="px-4 py-2.5 text-slate-500">{student.className}</td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button onClick={() => startEdit(student)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit siswa">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => { if (confirm(`Hapus ${student.name}?`)) onDelete(student.id); }}
                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus siswa">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info CSV */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-600">Format Import CSV:</p>
        <p>Kolom: <code className="bg-white px-1 rounded border border-slate-200">NIS, Nama, Kelas</code> atau <code className="bg-white px-1 rounded border border-slate-200">No, NIS, Nama, Kelas</code></p>
        <p>Baris pertama boleh header, akan diabaikan otomatis.</p>
        <p className="text-slate-400">💡 Dari Excel: simpan sebagai <strong className="text-slate-500">CSV UTF-8 (dengan BOM)</strong> agar terbaca dengan benar.</p>
      </div>
    </div>
  );
}