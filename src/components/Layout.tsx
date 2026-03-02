import { ReactNode, useState, useEffect, FormEvent } from 'react';
import { Home, PlusCircle, BookOpen, Users, Star, LogOut, Shield, Activity, KeyRound, Moon, Sun, ChevronUp, ChevronDown, X, Save, ClipboardList, ClipboardCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { User } from '../types';

const SCHOOL_ICON = 'https://raw.githubusercontent.com/fenomenaaneh/SMPN21-JAMBI/main/public/icon.png';

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: User;
  onLogout: () => void;
  onChangePassword?: (newPassword: string) => void;
};

export function Layout({ children, activeTab, onTabChange, user, onLogout, onChangePassword }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    setIsMenuOpen(false);
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (onChangePassword && newPassword) {
      onChangePassword(newPassword);
      setIsPasswordModalOpen(false);
      setNewPassword('');
      alert('Password berhasil diubah!');
    }
  };

  // Guru tabs — ditambah Rekap Kehadiran
  const guruTabs = [
    { id: 'dashboard',        label: 'Beranda',         icon: Home },
    { id: 'history',          label: 'Riwayat',         icon: BookOpen },
    { id: 'add',              label: 'Isi Jurnal',      icon: PlusCircle },
    { id: 'penilaian',        label: 'Penilaian',       icon: Star },
    { id: 'rekap-kehadiran',  label: 'Rekap Hadir',     icon: ClipboardList },
  ];

  // Admin tabs
  const adminTabs = [
    { id: 'admin-dashboard', label: 'Beranda',    icon: Home },
    { id: 'monitoring',      label: 'Monitoring', icon: Activity },
    { id: 'students',        label: 'Data Siswa', icon: Users },
    { id: 'tugas',           label: 'Tugas',      icon: ClipboardCheck },
    { id: 'akun',            label: 'Akun',       icon: Shield },
  ];

  const tabs = user.role === 'admin' ? adminTabs : guruTabs;

  const SchoolLogo = ({ className }: { className: string }) => (
    <img
      src={SCHOOL_ICON}
      alt="Logo"
      className={className}
      onError={(e) => {
        const t = e.currentTarget;
        t.style.display = 'none';
        const next = t.nextElementSibling as HTMLElement;
        if (next) next.style.display = 'flex';
      }}
    />
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm z-10 transition-colors duration-200">
        <div className="p-6 flex items-center space-x-3">
          <SchoolLogo className="w-9 h-9 object-contain flex-shrink-0" />
          <div style={{ display: 'none' }} className="w-9 h-9 bg-indigo-600 rounded-lg items-center justify-center shadow-sm flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Jurnal Guru</h1>
            <p className="text-[10px] text-slate-400 leading-tight">SMPN 21 Jambi</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
                )}>
                <Icon className={cn("w-5 h-5 mr-3", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 relative">
          {isMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-50">
              <div className="p-2 space-y-1">
                <button onClick={() => { setIsPasswordModalOpen(true); setIsMenuOpen(false); }}
                  className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <KeyRound className="w-4 h-4 mr-3 text-slate-400" />Ganti Password
                </button>
                <button onClick={toggleDarkMode}
                  className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  {isDarkMode ? <><Sun className="w-4 h-4 mr-3 text-slate-400" />Mode Terang</> : <><Moon className="w-4 h-4 mr-3 text-slate-400" />Mode Gelap</>}
                </button>
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button onClick={onLogout}
                  className="w-full flex items-center px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                  <LogOut className="w-4 h-4 mr-3" />Keluar
                </button>
              </div>
            </div>
          )}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-500/30 uppercase">
                {user.name.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200 line-clamp-1">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
              </div>
            </div>
            {isMenuOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        {/* Mobile header */}
        <header className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors duration-200">
          <div className="flex items-center space-x-2">
            <SchoolLogo className="w-8 h-8 object-contain" />
            <div style={{ display: 'none' }} className="w-7 h-7 bg-indigo-600 rounded-md items-center justify-center shadow-sm flex">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Jurnal Guru</h1>
              <p className="text-[9px] text-slate-400 leading-tight">SMPN 21 Jambi</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 relative">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-500/30 uppercase">
                {user.name.charAt(0)}
              </div>
            </button>
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-50">
                {/* Nama akun */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm uppercase flex-shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  <button onClick={() => { setIsPasswordModalOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <KeyRound className="w-4 h-4 mr-3 text-slate-400" />Ganti Password
                  </button>
                  <button onClick={toggleDarkMode}
                    className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    {isDarkMode ? <><Sun className="w-4 h-4 mr-3 text-slate-400" />Mode Terang</> : <><Moon className="w-4 h-4 mr-3 text-slate-400" />Mode Gelap</>}
                  </button>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  <button onClick={onLogout}
                    className="w-full flex items-center px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                    <LogOut className="w-4 h-4 mr-3" />Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-3xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-200">
        <div className="flex justify-around items-center h-16 relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            if (tab.id === 'add') {
              return (
                <div key={tab.id} className="relative w-full h-full flex justify-center">
                  <button onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "absolute -top-6 flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 border-4 border-slate-50 dark:border-slate-900",
                      isActive ? "bg-indigo-700 text-white" : "bg-slate-900 dark:bg-slate-700 text-white"
                    )}>
                    <Icon className="w-8 h-8" />
                  </button>
                </div>
              );
            }
            return (
              <button key={tab.id} onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                  isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}>
                {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-b-full" />}
                <Icon className={cn("w-6 h-6 mt-1", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <KeyRound className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />Ganti Password
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password Baru</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                  placeholder="Masukkan password baru" />
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl mr-2 transition-colors">
                  Batal
                </button>
                <button type="submit"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                  <Save className="w-4 h-4 mr-2" />Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}