/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WaliMurid } from './components/WaliMurid';
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { JournalForm } from './components/JournalForm';
import { History } from './components/History';
import { Penilaian } from './components/Penilaian';
import { RekapKehadiran } from './components/RekapKehadiran';
import { Students } from './components/Students';
import { Login } from './components/Login';
import { Akun } from './components/Akun';
import { Monitoring } from './components/Monitoring';
import { Tugas } from './components/Tugas';
import { useJournals } from './hooks/useJournals';
import { useStudents } from './hooks/useStudents';
import { useUsers } from './hooks/useUsers';
import { useTugas } from './hooks/useTugas';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('jurnal-guru-current-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');

  const { journals, loading: loadingJournals, error: errorJournals, addJournal, updateJournal, deleteJournal } = useJournals();
  const { students, loading: loadingStudents, error: errorStudents, addStudent, addStudents, updateStudent, deleteStudent, deleteClass } = useStudents();
  const { users, loading: loadingUsers, error: errorUsers, addUser, updateUser, deleteUser } = useUsers();
  const { tugasList, loading: loadingTugas } = useTugas();

  const isLoading = loadingJournals || loadingStudents || loadingUsers || loadingTugas;
  const errors = [errorJournals, errorStudents, errorUsers].filter(Boolean);

  useEffect(() => {
    if (user) {
      localStorage.setItem('jurnal-guru-current-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('jurnal-guru-current-user');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setActiveTab(user.role === 'admin' ? 'admin-dashboard' : 'dashboard');
    }
  }, [user]);

  // Sync user dari users list (agar perubahan waliKelas oleh admin langsung terefleksi)
  useEffect(() => {
    if (user && users.length > 0) {
      const updated = users.find(u => u.id === user.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(user)) {
        setUser(updated);
      }
    }
  }, [users]);

  const classes = Array.from(new Set(students.map(s => s.className))).sort() as string[];

  const handleAddJournal = (entry: any) => {
    addJournal({
      ...entry,
      teacherId: user!.id,
      teacherName: user!.name,
    });
    setActiveTab('history');
  };

  const handleLogin = (loggedInUser: User) => setUser(loggedInUser);
  const handleLogout = () => setUser(null);

  const handleChangePassword = (newPassword: string) => {
    if (user) {
      updateUser(user.id, { password: newPassword });
      setUser({ ...user, password: newPassword });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium text-sm">Memuat data dari server...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        {errors.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {errors.map((err, i) => (
              <div key={i} className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm shadow-sm max-w-sm">
                ⚠️ {err}
              </div>
            ))}
          </div>
        )}
        <Login users={users} onLogin={handleLogin} />
      </div>
    );
  }

  const guruJournals = journals.filter(j => j.teacherId === user.id);
  const tugasGuru = tugasList.find(t => t.guruId === user.id);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      user={user}
      onLogout={handleLogout}
      onChangePassword={handleChangePassword}
    >
      {errors.length > 0 && (
        <div className="mb-4 space-y-2">
          {errors.map((err, i) => (
            <div key={i} className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
              ⚠️ {err}
            </div>
          ))}
        </div>
      )}

      {/* ── GURU ROUTES ── */}
      {user.role === 'guru' && (
        <>
          {activeTab === 'dashboard' && (
            <Dashboard journals={guruJournals} onNavigate={setActiveTab} tugasGuru={tugasGuru} students={students} />
          )}
          {activeTab === 'add' && (
            <JournalForm
              onSubmit={handleAddJournal}
              onCancel={() => setActiveTab('dashboard')}
              classes={classes}
              students={students}
              tugasGuru={tugasGuru}
            />
          )}
          {activeTab === 'penilaian' && (
            <Penilaian
              students={students}
              journals={guruJournals}
              onUpdateJournal={updateJournal}
              tugasGuru={tugasGuru}
            />
          )}
          {activeTab === 'rekap-kehadiran' && (
            <RekapKehadiran
              journals={guruJournals}
              students={students}
              teacherName={user.name}
            />
          )}
          {activeTab === 'history' && (
            <History journals={guruJournals} onDelete={deleteJournal} />
          )}
          {/* Wali Murid — hanya muncul jika guru punya waliKelas */}
          {activeTab === 'wali-murid' && user.waliKelas && (
            <WaliMurid
              students={students}
              journals={journals}
              lockedKelas={user.waliKelas}
              isAdmin={false}
            />
          )}
        </>
      )}

      {/* ── ADMIN ROUTES ── */}
      {user.role === 'admin' && (
        <>
          {activeTab === 'admin-dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col space-y-1">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Admin</h2>
                <p className="text-slate-500">Selamat datang, {user.name}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Guru</h3>
                  <p className="text-3xl font-black text-slate-900">{users.filter(u => u.role === 'guru').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Jurnal</h3>
                  <p className="text-3xl font-black text-slate-900">{journals.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Siswa</h3>
                  <p className="text-3xl font-black text-slate-900">{students.length}</p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'monitoring' && (
            <Monitoring journals={journals} students={students} />
          )}
          {activeTab === 'students' && (
            <Students
              students={students}
              onAdd={addStudent}
              onAddStudents={addStudents}
              onUpdate={updateStudent}
              onDelete={deleteStudent}
              onDeleteClass={deleteClass}
            />
          )}
          {activeTab === 'tugas' && (
            <Tugas users={users} students={students} />
          )}
          {/* Wali Murid untuk admin — dengan tab Kedisiplinan */}
          {activeTab === 'wali-murid' && (
            <WaliMurid
              students={students}
              journals={journals}
              isAdmin={true}
            />
          )}
          {activeTab === 'akun' && (
            <Akun
              users={users}
              classes={classes}
              onAdd={addUser}
              onUpdate={updateUser}
              onDelete={deleteUser}
            />
          )}
        </>
      )}
    </Layout>
  );
}