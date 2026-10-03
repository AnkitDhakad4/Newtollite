import React from 'react';
import { useApp } from '../context/AppContext';
import { Search, Filter, Bot, User, Clock, CheckCircle } from 'lucide-react';

export default function WorkItemList() {
  const { 
    workItems, 
    pagination, 
    filters, 
    setFilters, 
    selectedItem, 
    setSelectedItem, 
    refreshSelectedItem,
    teams, 
    loading 
  } = useApp();

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-950 text-rose-300 border-rose-800 font-bold animate-pulse';
      case 'HIGH':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'MEDIUM':
        return 'bg-blue-950 text-blue-300 border-blue-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'NEW':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'IN_PROGRESS':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'PENDING_APPROVAL':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'RESOLVED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'CLOSED':
        return 'bg-slate-900 text-slate-500 border-slate-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col h-[750px]">
      
      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, OPS-id, or tags..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Team Filter */}
          <select
            value={filters.teamId}
            onChange={(e) => handleFilterChange('teamId', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Teams</option>
            {teams.map(t => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="TRIAGED">TRIAGED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center space-x-2 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.unassignedOnly}
              onChange={(e) => handleFilterChange('unassignedOnly', e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Show Unassigned Only</span>
          </label>
          <span className="text-slate-500">
            Showing {workItems.length} of {pagination.total} items
          </span>
        </div>
      </div>

      {/* Work Item List / Cards */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
            Loading operational queue...
          </div>
        ) : workItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm space-y-2">
            <p>No operational items match the current filters.</p>
            <button
              onClick={() => setFilters({ teamId: '', status: '', priority: '', search: '', unassignedOnly: false, page: 1 })}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          workItems.map(item => {
            const isSelected = selectedItem?._id === item._id;
            return (
              <div
                key={item._id}
                onClick={() => {
                  setSelectedItem(item);
                  if (refreshSelectedItem) refreshSelectedItem(item._id);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border border-emerald-500/50 shadow-sm shadow-emerald-950'
                    : 'bg-slate-900/40 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {item.itemNumber}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-medium ${getPriorityBadge(item.priority)}`}>
                      {item.priority}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-medium ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* OCC Version Tag */}
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1 py-0.5 rounded" title="OCC Version">
                      v{item.version}
                    </span>

                    {/* AI Agent badge */}
                    {item.aiAnalysis?.status === 'COMPLETED' && (
                      <span className="flex items-center space-x-1 text-[10px] bg-purple-950/80 border border-purple-800 text-purple-300 px-1.5 py-0.5 rounded" title="Enriched by AI Agent">
                        <Bot className="h-3 w-3" />
                        <span>AI Triage</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-slate-100 truncate mb-1">
                  {item.title}
                </h3>

                {/* Meta details */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-slate-500">
                      {item.teamId?.name || 'General'}
                    </span>
                    <span className="flex items-center space-x-1 text-[11px]">
                      <User className="h-3 w-3 text-slate-500" />
                      <span>{item.assigneeId ? item.assigneeId.name : 'Unassigned'}</span>
                    </span>
                  </div>
                  
                  <span className="text-[10px] font-mono text-slate-500">
                    SLA: {new Date(item.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <button
          disabled={pagination.page <= 1}
          onClick={() => handleFilterChange('page', pagination.page - 1)}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded"
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.totalPages || 1}
        </span>
        <button
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => handleFilterChange('page', pagination.page + 1)}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
}

