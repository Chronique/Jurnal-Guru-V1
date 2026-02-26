import { ReactNode } from 'react';
import { Home, PlusCircle, BookOpen, ClipboardCheck, Users } from 'lucide-react';
import { cn } from '../lib/utils';

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const tabs = [
    { id: 'dashboard', label: 'Beranda', icon: Home },
    { id: 'history', label: 'Riwayat', icon: BookOpen },
    { id: 'add', label: 'Isi Jurnal', icon: PlusCircle },
    { id: 'presensi', label: 'Presensi', icon: ClipboardCheck },
    { id: 'students', label: 'Data Siswa', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shadow-sm z-10">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Jurnal Guru</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-medium shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className={cn("w-5 h-5 mr-3", isActive ? "text-indigo-600" : "text-slate-400")} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center space-x-3 px-4 py-2">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">
              G
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Guru Pengajar</p>
              <p className="text-xs text-slate-500">NIP. 198001012005011001</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Jurnal Guru</h1>
          </div>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">
            G
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-3xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Bottom nav for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16 relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            if (tab.id === 'add') {
              return (
                <div key={tab.id} className="relative w-full h-full flex justify-center">
                  <button
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "absolute -top-6 flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 border-4 border-slate-50",
                      isActive ? "bg-indigo-700 text-white" : "bg-slate-900 text-white"
                    )}
                  >
                    <Icon className="w-8 h-8" />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                  isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-indigo-600 rounded-b-full" />
                )}
                <Icon className={cn("w-6 h-6 mt-1", isActive ? "text-indigo-600" : "text-slate-400")} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
