import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Users, Plus, Radio, Zap } from 'lucide-react';

export default function Navbar({ onOpenCreateModal }) {
  const { users, activeUser, setActiveUser, attentionFeed } = useApp();

  const totalUrgent = 
    (attentionFeed.slaBreaching?.length || 0) + 
    (attentionFeed.unassignedUrgent?.length || 0) + 
    (attentionFeed.pendingApprovals?.length || 0);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-white text-lg">NEWTONITE</span>
              <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                Ops Cockpit
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Operations Under Pressure Coordination Engine</p>
          </div>
        </div>

        {/* Right Controls: Persona Switcher, Urgent Badge, New Button */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          
          {/* Urgent Attention Alert Badge */}
          {totalUrgent > 0 && (
            <div className="flex items-center space-x-1.5 bg-rose-950/60 border border-rose-800/80 text-rose-300 px-2.5 py-1 rounded-full text-xs font-medium animate-pulse">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              <span>{totalUrgent} High Priority</span>
            </div>
          )}

          {/* Simulated Actor Switcher for Testing Concurrency & RBAC */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1">
            <Users className="h-4 w-4 text-slate-400 ml-1.5 mr-1" />
            <select
              value={activeUser?._id || ''}
              onChange={(e) => {
                const found = users.find(u => u._id === e.target.value);
                if (found) setActiveUser(found);
              }}
              className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer pr-2"
              title="Switch user persona to test concurrent actions & team authorization"
            >
              {users.map(u => {
                const teamRoles = u.teams?.map(t => `${t.teamId?.name || 'Team'}: ${t.role}`).join(', ');
                const label = u.globalRole === 'ADMIN' ? `${u.name} (Global Admin)` : `${u.name} (${teamRoles || u.globalRole})`;
                return (
                  <option key={u._id} value={u._id} className="bg-slate-900 text-slate-100">
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* New Work Item Button */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-sm shadow-emerald-900/50"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Request</span>
          </button>
        </div>
      </div>
    </header>
  );
}

