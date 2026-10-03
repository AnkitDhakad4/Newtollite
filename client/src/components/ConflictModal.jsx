import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function ConflictModal() {
  const { conflictModal, setConflictModal } = useApp();

  if (!conflictModal.isOpen) return null;

  const serverItem = conflictModal.serverResource;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-800/80 rounded-xl max-w-lg w-full p-5 shadow-2xl shadow-rose-950/50 space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-bold text-base text-white">Concurrent Modification Conflict (HTTP 409)</h3>
          </div>
          <button
            onClick={() => setConflictModal({ isOpen: false, message: '', serverResource: null, onAcceptServer: null })}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conflict Explanation */}
        <p className="text-xs text-slate-300 leading-relaxed">
          {conflictModal.message || 'Another team member has updated this work item since you opened it. Your changes were rejected by Optimistic Concurrency Control to prevent accidental data loss.'}
        </p>

        {/* Server State Snapshot */}
        {serverItem && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1">
              <span className="font-mono text-emerald-400 font-semibold">{serverItem.itemNumber}</span>
              <span className="font-mono text-slate-400">Current Server Version: v{serverItem.version}</span>
            </div>
            <p className="text-slate-200 font-medium">{serverItem.title}</p>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-1">
              <span>Status: <strong className="text-emerald-400">{serverItem.status}</strong></span>
              <span>Owner: <strong className="text-slate-300">{serverItem.assigneeId?.name || 'Unassigned'}</strong></span>
            </div>
          </div>
        )}

        {/* Resolution Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={() => setConflictModal({ isOpen: false, message: '', serverResource: null, onAcceptServer: null })}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              if (conflictModal.onAcceptServer) {
                conflictModal.onAcceptServer();
              } else {
                setConflictModal({ isOpen: false, message: '', serverResource: null, onAcceptServer: null });
              }
            }}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Load Latest Version</span>
          </button>
        </div>

      </div>
    </div>
  );
}

