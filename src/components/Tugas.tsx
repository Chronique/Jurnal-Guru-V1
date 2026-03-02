import { useState, useMemo } from 'react';
import { User } from '../types';
import { KelasItem, MapelKelas, useTugas } from '../hooks/useTugas';
import { Student } from '../hooks/useStudents';
import {
  BookOpen, Plus, Trash2, Save, ChevronDown, ChevronUp,
  Clock, Users, Pencil, X, GraduationCap, RefreshCw,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const DAFTAR_MAPEL = [
  'PAI', 'PKN', 'B INDO', 'MTK', 'IPA',
  'IPS', 'B ING', 'PJOK', 'TIK', 'PRAKARYA',
];

type TugasProps = {
  users: User[];
  students: Student[];
};

// ── Tipe sementara saat edit ───────────────────────────────────────────────────
type EditState = {
  guruId: string;
  kelas: KelasItem[];
};

// ── Helper ─────────────────────────────────────────────────────────────────────
const totalJamGuru = (kelas: KelasItem[] | undefined) =>
  (kelas ?? []).reduce((a, k) => a + (k.mapel ?? []).reduce((b, m) => b + (m.jamPerMinggu ?? 0), 0), 0);

// Hitung jumlah mapel unik dari seluruh kelas guru:
// - Mapel yang sama di kelas berbeda = 1 (nama unik global)
// - Lebih dari 1 entri mapel dengan nama sama di kelas yang sama = tetap 1
const totalMapelGuru = (kelas: KelasItem[] | undefined) => {
  const namaUnikGlobal = new Set(
    (kelas ?? []).flatMap(k => (k.mapel ?? []).map(m => m.namaMapel)).filter(Boolean)
  );
  return namaUnikGlobal.size;
};

// Hitung pertemuan unik per kelas: mapel yang sama (nama sama) dianggap 1 pertemuan.
// Juga: jika ada lebih dari 1 mapel dalam seminggu, tetap dihitung 1 pertemuan per kelas.
// Hitung total pertemuan/minggu:
// Tiap entri mapel yang unik namanya (per kelas) dihitung sesuai pertemuanPerMinggu-nya.
// Mapel dengan nama sama dalam satu kelas → ambil pertemuanPerMinggu terbesar (deduplikasi).
const totalPertemuanUnik = (kelas: KelasItem[] | undefined) =>
  (kelas ?? []).reduce((total, k) => {
    // Deduplikasi mapel per kelas: nama sama → ambil pertemuanPerMinggu terbesar
    const byNama: Record<string, number> = {};
    (k.mapel ?? []).forEach(m => {
      const ppm = m.pertemuanPerMinggu ?? 1;
      if (!byNama[m.namaMapel] || ppm > byNama[m.namaMapel]) {
        byNama[m.namaMapel] = ppm;
      }
    });
    // Jumlahkan pertemuanPerMinggu dari setiap mapel unik di kelas ini
    const sumKelas = Object.values(byNama).reduce((s, v) => s + v, 0);
    return total + sumKelas;
  }, 0);

// ── Komponen baris mapel dalam satu kelas ─────────────────────────────────────
function MapelRow({
  mapel,
  index,
  onChange,
  onDelete,
}: {
  mapel: MapelKelas;
  index: number;
  onChange: (field: keyof MapelKelas, value: string | number) => void;
  onDelete: () => void;
}) {
  // Jam per minggu = pertemuanPerMinggu × jam tiap pertemuan
  // Kita simpan jamPerMinggu langsung, pertemuanPerMinggu hanya info tampilan
  const [jamPerPertemuan, setJamPerPertemuan] = useState(
    Math.round(mapel.jamPerMinggu / mapel.pertemuanPerMinggu) || 2
  );

  const handlePertemuanChange = (ppm: number) => {
    onChange('pertemuanPerMinggu', ppm);
    onChange('jamPerMinggu', ppm * jamPerPertemuan);
  };

  const handleJamPerPertemuanChange = (jam: number) => {
    setJamPerPertemuan(jam);
    onChange('jamPerMinggu', mapel.pertemuanPerMinggu * jam);
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
      {/* Kolom kiri: dropdown + baris jam */}
      <div className="space-y-2">
        {/* Dropdown mapel */}
        <div className="relative">
          <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            value={mapel.namaMapel}
            onChange={e => onChange('namaMapel', e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none text-slate-900"
          >
            <option value="">-- Pilih Mata Pelajaran --</option>
            {DAFTAR_MAPEL.map(mp => (
              <option key={mp} value={mp}>{mp}</option>
            ))}
          </select>
        </div>

        {/* Baris: pertemuan/minggu + jam/pertemuan → total */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pertemuan per minggu */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <RefreshCw className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500 whitespace-nowrap">Pertemuan/minggu:</span>
            <div className="flex gap-1">
              {[1, 2].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handlePertemuanChange(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    mapel.pertemuanPerMinggu === n
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>

          {/* Jam per pertemuan */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500 whitespace-nowrap">Jam/pertemuan:</span>
            <input
              type="number"
              min={1}
              max={8}
              value={jamPerPertemuan}
              onChange={e => handleJamPerPertemuanChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-10 text-center text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 py-0.5"
            />
            <span className="text-[10px] text-slate-500">jam</span>
          </div>

          {/* Total otomatis */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">=</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3" />{mapel.jamPerMinggu} jam/minggu
            </span>
            {mapel.pertemuanPerMinggu === 2 && (
              <span className="text-[10px] text-indigo-500 font-medium">(2× pertemuan)</span>
            )}
          </div>
        </div>
      </div>

      {/* Tombol hapus */}
      <button
        type="button"
        onClick={onDelete}
        className="mt-1 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Komponen utama ─────────────────────────────────────────────────────────────
export function Tugas({ users, students }: TugasProps) {
  const { tugasList, loading, setTugasGuru } = useTugas();

  const guruList = useMemo(() => users.filter(u => u.role === 'guru'), [users]);

  // Kelas unik dari data siswa
  const allKelas = useMemo(() =>
    Array.from(new Set(students.map(s => s.className))).sort(),
    [students]
  );

  const [expandedGuru, setExpandedGuru] = useState<string | null>(null);
  const [editState,    setEditState]    = useState<EditState | null>(null);

  // ── Buka editor ──────────────────────────────────────────────────────────────
  const handleEdit = (guru: User) => {
    const existing = tugasList.find(t => t.guruId === guru.id);
    setEditState({
      guruId: guru.id,
      kelas: existing?.kelas ? JSON.parse(JSON.stringify(existing.kelas)) : [],
    });
    setExpandedGuru(guru.id);
  };

  // ── Tambah kelas baru ────────────────────────────────────────────────────────
  const handleAddKelas = (namaKelas: string) => {
    if (!editState) return;
    if (editState.kelas.find(k => k.namaKelas === namaKelas)) return; // sudah ada
    setEditState(prev => prev ? {
      ...prev,
      kelas: [...prev.kelas, { id: uuidv4(), namaKelas, mapel: [] }],
    } : null);
  };

  // ── Hapus kelas ──────────────────────────────────────────────────────────────
  const handleDeleteKelas = (kelasId: string) => {
    setEditState(prev => prev ? { ...prev, kelas: prev.kelas.filter(k => k.id !== kelasId) } : null);
  };

  // ── Tambah mapel ke kelas ────────────────────────────────────────────────────
  const handleAddMapel = (kelasId: string) => {
    setEditState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        kelas: prev.kelas.map(k => k.id !== kelasId ? k : {
          ...k,
          mapel: [...k.mapel, {
            id: uuidv4(),
            namaMapel: '',
            jamPerMinggu: 2,
            pertemuanPerMinggu: 1,
          }],
        }),
      };
    });
  };

  // ── Update field mapel ───────────────────────────────────────────────────────
  const handleMapelChange = (kelasId: string, mapelId: string, field: keyof MapelKelas, value: string | number) => {
    setEditState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        kelas: prev.kelas.map(k => k.id !== kelasId ? k : {
          ...k,
          mapel: k.mapel.map(m => m.id !== mapelId ? m : { ...m, [field]: value }),
        }),
      };
    });
  };

  // ── Hapus mapel ──────────────────────────────────────────────────────────────
  const handleDeleteMapel = (kelasId: string, mapelId: string) => {
    setEditState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        kelas: prev.kelas.map(k => k.id !== kelasId ? k : {
          ...k,
          mapel: k.mapel.filter(m => m.id !== mapelId),
        }),
      };
    });
  };

  // ── Simpan ───────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!editState) return;
    const guru = users.find(u => u.id === editState.guruId);
    if (!guru) return;

    for (const k of editState.kelas) {
      if (k.mapel.length === 0) {
        alert(`Kelas ${k.namaKelas} belum memiliki mata pelajaran.`); return;
      }
      for (const m of k.mapel) {
        if (!m.namaMapel) {
          alert(`Pilih mata pelajaran untuk semua baris di kelas ${k.namaKelas}.`); return;
        }
      }
    }

    setTugasGuru(guru.id, guru.name, editState.kelas);
    setEditState(null);
  };

  const handleCancel = () => setEditState(null);

  // Kelas yang belum dipilih untuk guru ini
  const remainingKelas = (edit: EditState) =>
    allKelas.filter(k => !edit.kelas.find(ek => ek.namaKelas === k));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tugas Mengajar</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Kelola kelas, mata pelajaran, dan jam mengajar setiap guru per minggu.
        </p>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">{guruList.length}</span>
          <span className="text-xs font-medium text-slate-500 mt-0.5">Total Guru</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">
            {tugasList.reduce((a, t) => a + (t.kelas ?? []).length, 0)}
          </span>
          <span className="text-xs font-medium text-slate-500 mt-0.5">Total Kelas Diampu</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-slate-900">
            {tugasList.reduce((a, t) => a + totalJamGuru(t.kelas ?? []), 0)}
          </span>
          <span className="text-xs font-medium text-slate-500 mt-0.5">Total Jam/Minggu</span>
        </div>
      </div>

      {/* Daftar guru */}
      {guruList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center gap-3">
          <Users className="w-10 h-10 text-slate-300" />
          <p className="text-slate-600 font-semibold">Belum ada akun guru</p>
          <p className="text-slate-400 text-sm">Tambahkan akun guru di menu Akun terlebih dahulu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guruList.map(guru => {
            const tugasGuru  = tugasList.find(t => t.guruId === guru.id);
            const isExpanded = expandedGuru === guru.id;
            const isEditing  = editState?.guruId === guru.id;
            const jam        = totalJamGuru(tugasGuru?.kelas ?? []);
            const nKelas     = (tugasGuru?.kelas ?? []).length;
            const nPertemuan = totalPertemuanUnik(tugasGuru?.kelas ?? []);

            return (
              <div key={guru.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                {/* ── Header card guru ──────────────────────────── */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                  onClick={() => { if (!isEditing) setExpandedGuru(isExpanded ? null : guru.id); }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm uppercase flex-shrink-0">
                      {guru.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{guru.name}</p>
                      <p className="text-xs text-slate-400 font-mono">@{guru.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {nKelas > 0 ? (
                      <div className="hidden sm:flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          <GraduationCap className="w-3 h-3" />{nKelas} Kelas
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                          <RefreshCw className="w-3 h-3" />{nPertemuan}× /Mgg
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" />{jam} Jam/Mgg
                        </span>
                      </div>
                    ) : (
                      <span className="hidden sm:inline text-xs text-slate-400 italic">Belum ada tugas</span>
                    )}

                    {!isEditing && (
                      <button
                        onClick={e => { e.stopPropagation(); handleEdit(guru); }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* ── Panel expanded ────────────────────────────── */}
                {isExpanded && (
                  <div className="border-t border-slate-100">

                    {isEditing ? (
                      /* ══ MODE EDIT ════════════════════════════════════════ */
                      <div className="p-5 space-y-5">

                        {/* Pilih kelas yang diajar */}
                        {remainingKelas(editState!).length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5" /> Tambah Kelas yang Diajar
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {remainingKelas(editState!).map(k => (
                                <button
                                  key={k}
                                  onClick={() => handleAddKelas(k)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-dashed border-indigo-200 text-indigo-600 text-xs font-semibold rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-all"
                                >
                                  <Plus className="w-3 h-3" /> {k}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {allKelas.length === 0 && (
                          <p className="text-sm text-slate-400 italic text-center py-2">
                            Belum ada data kelas. Input data siswa terlebih dahulu di menu Data Siswa.
                          </p>
                        )}

                        {/* Kelas yang sudah dipilih */}
                        {editState!.kelas.length === 0 ? (
                          <p className="text-sm text-slate-400 italic text-center py-4">
                            Pilih kelas di atas untuk mulai mengisi tugas mengajar.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {editState!.kelas.map(k => (
                              <div key={k.id} className="rounded-2xl border border-slate-200 overflow-hidden">

                                {/* Header kelas */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                                  <div className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                                    <span className="text-sm font-bold text-indigo-800">{k.namaKelas}</span>
                                    <span className="text-xs text-indigo-400">
                                      · {k.mapel.length} mapel · {k.mapel.reduce((a, m) => a + m.jamPerMinggu, 0)} jam/mgg
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteKelas(k.id)}
                                    className="p-1 text-indigo-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Hapus kelas ini"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Daftar mapel kelas ini */}
                                <div className="p-4 space-y-3">
                                  {k.mapel.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic text-center py-2">
                                      Belum ada mata pelajaran. Klik "+ Tambah Mapel" di bawah.
                                    </p>
                                  ) : (
                                    k.mapel.map((m, idx) => (
                                      <div key={m.id} className={`p-3 rounded-xl ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white border border-slate-100'}`}>
                                        <MapelRow
                                          mapel={m}
                                          index={idx}
                                          onChange={(field, value) => handleMapelChange(k.id, m.id, field, value)}
                                          onDelete={() => handleDeleteMapel(k.id, m.id)}
                                        />
                                      </div>
                                    ))
                                  )}

                                  {/* Tambah mapel ke kelas ini */}
                                  <button
                                    onClick={() => handleAddMapel(k.id)}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 text-slate-500 text-xs font-medium rounded-xl hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Tambah Mata Pelajaran
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Ringkasan total */}
                            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                              <span className="text-xs font-bold text-amber-700">Total Jam Mengajar/Minggu</span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-black bg-amber-100 text-amber-700">
                                <Clock className="w-3.5 h-3.5" />
                                {editState!.kelas.reduce((a, k) => a + k.mapel.reduce((b, m) => b + m.jamPerMinggu, 0), 0)} jam
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Tombol aksi */}
                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                          <button
                            onClick={handleCancel}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                          >
                            <X className="w-4 h-4" /> Batal
                          </button>
                          <button
                            onClick={handleSave}
                            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            <Save className="w-4 h-4" /> Simpan
                          </button>
                        </div>
                      </div>

                    ) : (
                      /* ══ MODE VIEW ════════════════════════════════════════ */
                      <div className="p-5">
                        {!tugasGuru || !(tugasGuru.kelas ?? []).length ? (
                          <div className="text-center py-6 flex flex-col items-center gap-2">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                            <p className="text-sm text-slate-400 italic">Belum ada tugas mengajar.</p>
                            <button
                              onClick={() => handleEdit(guru)}
                              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Tambahkan Tugas
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(tugasGuru.kelas ?? []).map(k => (
                              <div key={k.id} className="rounded-xl border border-slate-200 overflow-hidden">
                                {/* Header kelas */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                                  <div className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                                    <span className="text-sm font-bold text-indigo-800">{k.namaKelas}</span>
                                  </div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                    <Clock className="w-3 h-3" />
                                    {k.mapel.reduce((a, m) => a + m.jamPerMinggu, 0)} jam/mgg
                                  </span>
                                </div>

                                {/* Tabel mapel */}
                                <div className="divide-y divide-slate-50">
                                  {k.mapel.map((m, idx) => (
                                    <div key={m.id} className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                      {/* Nama mapel */}
                                      <span className="text-sm font-semibold text-slate-800">{m.namaMapel}</span>

                                      {/* Badge pertemuan */}
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                                        m.pertemuanPerMinggu === 2
                                          ? 'bg-indigo-100 text-indigo-700'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}>
                                        <RefreshCw className="w-2.5 h-2.5" />
                                        {m.pertemuanPerMinggu}× /mgg
                                      </span>

                                      {/* Badge jam */}
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                                        <Clock className="w-3 h-3" />{m.jamPerMinggu} jam
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {/* Total keseluruhan */}
                            <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100 flex-wrap gap-2">
                              <div className="text-xs font-bold text-indigo-700">
                                Total: {totalMapelGuru(tugasGuru.kelas ?? [])} mapel · {nKelas} kelas · {nPertemuan}× pertemuan/minggu
                              </div>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-black bg-indigo-100 text-indigo-700">
                                <Clock className="w-3.5 h-3.5" />{jam} jam/minggu
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}