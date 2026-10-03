import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  History, 
  MessageSquare, 
  UserCheck, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Bot, 
  AlertTriangle, 
  Clock 
} from 'lucide-react';

export default function AuditTimeline({ workItemId, version }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      if (!workItemId) return;
      setLoading(true);
      try {
        const res = await api.getHistory(workItemId);
        if (res.success) {
          setEvents(res.data);
        }
      } catch (err) {
        console.error('Failed to load audit history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [workItemId, version]);

  const getEventIcon = (type) => {
    switch (type) {
      case 'CREATED':
        return <Clock className="h-3.5 w-3.5 text-cyan-400" />;
      case 'CLAIMED':
      case 'ASSIGNED':
        return <UserCheck className="h-3.5 w-3.5 text-emerald-400" />;
      case 'STATUS_CHANGED':
        return <ArrowRight className="h-3.5 w-3.5 text-blue-400" />;
      case 'APPROVAL_REQUESTED':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
      case 'APPROVAL_DECIDED':
        return <CheckCircle className="h-3.5 w-3.5 text-purple-400" />;
      case 'AI_ENRICHED':
      case 'AI_DUPLICATE_FLAGGED':
        return <Bot className="h-3.5 w-3.5 text-purple-400" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="h-3.5 w-3.5 text-slate-400" />;
      default:
        return <History className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
          <History className="h-3.5 w-3.5 text-emerald-400" />
          <span>Immutable Audit Trail & History</span>
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {events.length} Records
        </span>
      </div>

      {loading && events.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">Loading event history...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">No historical events recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt._id} className="relative pl-6 pb-2 border-l border-slate-800 text-xs">
              
              {/* Event bullet point */}
              <div className="absolute -left-2 top-0.5 h-4 w-4 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                {getEventIcon(evt.eventType)}
              </div>

              {/* Event Header */}
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-200">
                    {evt.actor?.name || 'System'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ({evt.actor?.role || 'SYSTEM'})
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-1 rounded">
                    seq#{evt.sequenceNumber}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Event Comment */}
              {evt.comment && (
                <p className="text-slate-300 text-xs mt-0.5">
                  {evt.comment}
                </p>
              )}

              {/* Field Diffs */}
              {evt.changes && evt.changes.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {evt.changes.map((ch, idx) => (
                    <div key={idx} className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800/80">
                      <span className="text-slate-300 font-semibold">{ch.field}:</span>{' '}
                      <span className="line-through text-rose-400">{String(ch.oldValue ?? 'none')}</span>{' '}
                      &rarr;{' '}
                      <span className="text-emerald-400 font-bold">{String(ch.newValue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

