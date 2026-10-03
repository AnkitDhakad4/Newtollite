import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, AlertTriangle, CheckCircle2, UserCheck, Flame, ArrowRight } from 'lucide-react';
import { api } from '../api/client';

export default function AttentionFeed() {
  const { attentionFeed, setSelectedItem, activeUser, refreshSelectedItem, handleApiError, showToast } = useApp();
  const { slaBreaching, unassignedUrgent, pendingApprovals, myActiveWork } = attentionFeed;

  const handleQuickClaim = async (item, e) => {
    e.stopPropagation();
    try {
      const res = await api.claimWorkItem(item._id, item.version, activeUser._id);
      if (res.success) {
        showToast(`Successfully claimed ${item.itemNumber}!`, 'success');
        refreshSelectedItem(item._id);
      }
    } catch (err) {
      handleApiError(err, () => refreshSelectedItem(item._id));
    }
  };

  const hasUrgentItems = (slaBreaching?.length > 0) || (unassignedUrgent?.length > 0) || (pendingApprovals?.length > 0);

  if (!hasUrgentItems && (!myActiveWork || myActiveWork.length === 0)) {
    return null;
  }

  return (
    <section className="mb-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Flame className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Immediate Attention Feed
          </h2>
        </div>
        <span className="text-xs text-slate-400">Live operational priorities</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Card 1: SLA Breach Risks */}
        <div className="bg-slate-900 border border-rose-900/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-rose-400 flex items-center space-x-1">
              <Clock className="h-3.5 w-3.5" />
              <span>SLA At Risk (&lt; 4h)</span>
            </span>
            <span className="text-xs font-bold text-rose-400 bg-rose-950 px-1.5 py-0.5 rounded">
              {slaBreaching?.length || 0}
            </span>
          </div>
          {slaBreaching && slaBreaching.length > 0 ? (
            <div className="space-y-2">
              {slaBreaching.slice(0, 2).map(item => (
                <div
                  key={item._id}
                  onClick={() => {
                    setSelectedItem(item);
                    refreshSelectedItem(item._id);
                  }}
                  className="p-2 rounded bg-slate-800/80 hover:bg-slate-800 cursor-pointer border border-slate-700/60 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-emerald-400 font-semibold">{item.itemNumber}</span>
                    <span className="text-rose-400 text-[10px] font-mono">
                      Due {new Date(item.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 truncate">{item.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">No items breaching SLA.</p>
          )}
        </div>

        {/* Card 2: Unassigned Urgent Incidents */}
        <div className="bg-slate-900 border border-amber-900/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400 flex items-center space-x-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Unassigned Critical</span>
            </span>
            <span className="text-xs font-bold text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded">
              {unassignedUrgent?.length || 0}
            </span>
          </div>
          {unassignedUrgent && unassignedUrgent.length > 0 ? (
            <div className="space-y-2">
              {unassignedUrgent.slice(0, 2).map(item => (
                <div
                  key={item._id}
                  onClick={() => {
                    setSelectedItem(item);
                    refreshSelectedItem(item._id);
                  }}
                  className="p-2 rounded bg-slate-800/80 hover:bg-slate-800 cursor-pointer border border-slate-700/60 transition-colors flex items-center justify-between"
                >
                  <div className="truncate mr-2">
                    <div className="flex items-center space-x-1 text-xs mb-0.5">
                      <span className="font-mono text-emerald-400 font-semibold">{item.itemNumber}</span>
                      <span className="text-[10px] bg-rose-950 text-rose-300 px-1 rounded">{item.priority}</span>
                    </div>
                    <p className="text-xs text-slate-200 truncate">{item.title}</p>
                  </div>
                  <button
                    onClick={(e) => handleQuickClaim(item, e)}
                    className="shrink-0 bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] px-2 py-1 rounded font-medium transition"
                    title="Atomically claim this work item"
                  >
                    Claim
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">All critical work claimed.</p>
          )}
        </div>

        {/* Card 3: Pending Operational Approvals */}
        <div className="bg-slate-900 border border-indigo-900/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-400 flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Awaiting Approval</span>
            </span>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded">
              {pendingApprovals?.length || 0}
            </span>
          </div>
          {pendingApprovals && pendingApprovals.length > 0 ? (
            <div className="space-y-2">
              {pendingApprovals.slice(0, 2).map(item => (
                <div
                  key={item._id}
                  onClick={() => {
                    setSelectedItem(item);
                    refreshSelectedItem(item._id);
                  }}
                  className="p-2 rounded bg-slate-800/80 hover:bg-slate-800 cursor-pointer border border-slate-700/60 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-emerald-400 font-semibold">{item.itemNumber}</span>
                    <span className="text-indigo-300 text-[10px] bg-indigo-950 px-1 rounded">Gate Required</span>
                  </div>
                  <p className="text-xs text-slate-200 truncate">{item.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">No pending approval gates.</p>
          )}
        </div>

      </div>
    </section>
  );
}

