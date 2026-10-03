import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import AttentionFeed from './components/AttentionFeed';
import WorkItemList from './components/WorkItemList';
import WorkItemDetail from './components/WorkItemDetail';
import ConflictModal from './components/ConflictModal';
import CreateItemModal from './components/CreateItemModal';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

function Dashboard() {
  const { toast } = useApp();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Bar with Actor Switcher & Urgent Badges */}
      <Navbar onOpenCreateModal={() => setIsCreateModalOpen(true)} />

      {/* Main Operations Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-5 flex-1 flex flex-col">
        
        {/* Cockpit Attention Feed for high priority items */}
        <AttentionFeed />

        {/* Operational Split Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          
          {/* Left Column: Filterable Work Queue */}
          <div className="lg:col-span-5">
            <WorkItemList />
          </div>

          {/* Right Column: Work Item Detail, Concurrency Actions, and Audit Trail */}
          <div className="lg:col-span-7">
            <WorkItemDetail />
          </div>

        </div>

      </main>

      {/* Conflict Resolution Modal (OCC HTTP 409) */}
      <ConflictModal />

      {/* Create New Item Modal */}
      <CreateItemModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold border ${
            toast.type === 'error'
              ? 'bg-rose-950 border-rose-800 text-rose-200'
              : toast.type === 'warning'
              ? 'bg-amber-950 border-amber-800 text-amber-200'
              : 'bg-emerald-950 border-emerald-800 text-emerald-200'
          }`}>
            {toast.type === 'error' && <AlertCircle className="h-4 w-4" />}
            {toast.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
            {toast.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {toast.type === 'info' && <Info className="h-4 w-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}

