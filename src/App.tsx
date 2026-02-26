/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { JournalForm } from './components/JournalForm';
import { History } from './components/History';
import { Presensi } from './components/Presensi';
import { Students } from './components/Students';
import { useJournals } from './hooks/useJournals';
import { useStudents } from './hooks/useStudents';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { journals, addJournal, deleteJournal } = useJournals();
  const { students, addStudent, addStudents, deleteStudent, deleteClass } = useStudents();

  // Get unique classes from students
  const classes = Array.from(new Set(students.map(s => s.className))).sort() as string[];

  const handleAddJournal = (entry: any) => {
    addJournal(entry);
    setActiveTab('history');
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
        <Dashboard journals={journals} onNavigate={setActiveTab} />
      )}
      {activeTab === 'add' && (
        <JournalForm 
          onSubmit={handleAddJournal} 
          onCancel={() => setActiveTab('dashboard')}
          classes={classes}
        />
      )}
      {activeTab === 'presensi' && (
        <Presensi students={students} />
      )}
      {activeTab === 'students' && (
        <Students 
          students={students} 
          onAdd={addStudent} 
          onAddStudents={addStudents}
          onDelete={deleteStudent} 
          onDeleteClass={deleteClass}
        />
      )}
      {activeTab === 'history' && (
        <History journals={journals} onDelete={deleteJournal} />
      )}
    </Layout>
  );
}

