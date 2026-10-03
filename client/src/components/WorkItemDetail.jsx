import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import AuditTimeline from './AuditTimeline';
import { 
  Bot, 
  UserCheck, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertOctagon, 
  Send, 
  Edit3, 
  Save, 
  X,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

export default function WorkItemDetail() {
  const { 
    selectedItem, 
    setSelectedItem, 
    activeUser, 
    users, 
    refreshSelectedItem, 
    handleApiError, 
    showToast 
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!selectedItem) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl h-[750px] flex flex-col items-center justify-center text-slate-500 p-8 text-center">
        <FileText className="h-12 w-12 text-slate-700 mb-3" />
        <h3 className="text-base font-semibold text-slate-300 mb-1">No Work Item Selected</h3>
        <p className="text-xs max-w-sm">Select an operational request from the queue to view details, claim ownership, inspect AI triage, and track audit history.</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditTitle(selectedItem.title);
    setEditDesc(selectedItem.description);
    setEditPriority(selectedItem.priority);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  // OCC Edit Save
  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.updateWorkItem(
        selectedItem._id,
        {
          version: selectedItem.version, // Client's OCC version
          title: editTitle,
          description: editDesc,
          priority: editPriority
        },
        activeUser._id
      );

      if (res.success) {
        showToast('Work item updated successfully.', 'success');
        setIsEditing(false);
        refreshSelectedItem(selectedItem._id);
      }
    } catch (err) {
      handleApiError(err, () => setIsEditing(false));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Atomic Claim
  const handleClaim = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.claimWorkItem(selectedItem._id, selectedItem.version, activeUser._id);
      if (res.success) {
        showToast('You have successfully claimed this work item.', 'success');
        refreshSelectedItem(selectedItem._id);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign to User
  const handleAssign = async () => {
    if (!assigneeId) return;
    setIsSubmitting(true);
    try {
      const res = await api.assignWorkItem(selectedItem._id, assigneeId, selectedItem.version, activeUser._id);
      if (res.success) {
        showToast('Reassigned successfully.', 'success');
        setAssigneeId('');
        refreshSelectedItem(selectedItem._id);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transition Status
  const handleTransition = async () => {
    if (!targetStatus) return;
    setIsSubmitting(true);
    try {
      const res = await api.transitionStatus(
        selectedItem._id,
        targetStatus,
        actionReason,
        selectedItem.version,
        activeUser._id
      );
      if (res.success) {
        showToast(`Status shifted to ${targetStatus}.`, 'success');
        setTargetStatus('');
        setActionReason('');
        refreshSelectedItem(selectedItem._id);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approval Decision (Approve / Reject)
  const handleApproval = async (decision) => {
    setIsSubmitting(true);
    try {
      const res = await api.decideApproval(
        selectedItem._id,
        decision,
        actionReason || `Approval ${decision} by ${activeUser.name}`,
        selectedItem.version,
        activeUser._id
      );
      if (res.success) {
        showToast(`Decision recorded: ${decision}.`, 'success');
        setActionReason('');
        refreshSelectedItem(selectedItem._id);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Post Comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await api.addComment(selectedItem._id, commentText, activeUser._id);
      if (res.success) {
        showToast('Comment appended to audit trail.', 'success');
        setCommentText('');
        refreshSelectedItem(selectedItem._id);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAssignedToMe = selectedItem.assigneeId?._id === activeUser?._id;
  const isUnassigned = !selectedItem.assigneeId;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col h-[750px] overflow-hidden">
      
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-base font-bold text-emerald-400">
            {selectedItem.itemNumber}
          </span>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono border border-slate-700">
            OCC v{selectedItem.version}
          </span>
          <span className="text-xs text-slate-400">
            in <strong className="text-slate-200">{selectedItem.teamId?.name || 'Operations'}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <button
              onClick={startEdit}
              className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1">
              <button
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="flex items-center space-x-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 rounded-lg transition"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save</span>
              </button>
              <button
                onClick={cancelEdit}
                className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1.5 rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Title & Description Box */}
        {isEditing ? (
          <div className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Priority</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Description</label>
              <textarea
                rows={4}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-bold text-white mb-2">{selectedItem.title}</h2>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {selectedItem.description}
            </div>
          </div>
        )}

        {/* Operational Status & Assignment Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Status</span>
            <span className="font-semibold text-emerald-400">{selectedItem.status}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Priority</span>
            <span className="font-semibold text-amber-400">{selectedItem.priority}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">Owner</span>
            <span className="font-semibold text-slate-200">
              {selectedItem.assigneeId ? selectedItem.assigneeId.name : 'Unassigned'}
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
            <span className="text-[10px] uppercase text-slate-500 font-semibold block">SLA Target</span>
            <span className="font-mono text-rose-400 font-semibold">
              {new Date(selectedItem.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* AGENTIC AI TRIAGE & ROOT CAUSE SECTION */}
        {selectedItem.aiAnalysis && selectedItem.aiAnalysis.status === 'COMPLETED' && (
          <div className="bg-purple-950/20 border border-purple-900/50 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-purple-300">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>Agentic AI OpsCopilot Analysis</span>
              </div>
              <span className="text-[10px] text-purple-400 font-mono">
                {selectedItem.aiAnalysis.modelUsed}
              </span>
            </div>

            <p className="text-xs text-purple-200 leading-relaxed">
              {selectedItem.aiAnalysis.summary}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-purple-950/50 border border-purple-800/40 p-2 rounded">
                <span className="text-[10px] text-purple-400 font-semibold uppercase block">Hypothesis</span>
                <p className="text-slate-300 text-[11px]">{selectedItem.aiAnalysis.rootCauseHypothesis}</p>
              </div>
              <div className="bg-purple-950/50 border border-purple-800/40 p-2 rounded">
                <span className="text-[10px] text-purple-400 font-semibold uppercase block">What Requires Attention Next</span>
                <p className="text-slate-300 text-[11px]">{selectedItem.aiAnalysis.suggestedNextStep}</p>
              </div>
            </div>

            {/* Duplicate Suspect Warning */}
            {selectedItem.aiAnalysis.duplicateSuspects?.length > 0 && (
              <div className="mt-2 bg-amber-950/40 border border-amber-800/60 rounded p-2 text-xs text-amber-200 flex items-start space-x-2">
                <AlertOctagon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Duplicate Alert:</span> Overlapping symptoms found with{' '}
                  {selectedItem.aiAnalysis.duplicateSuspects.map(d => d.itemNumber).join(', ')}. Coordinate to avoid split-brain work!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cross-Team Read-Only Notice if outside active persona's team */}
        {activeUser?.globalRole !== 'ADMIN' &&
          !activeUser?.teams?.some(
            (t) => t.teamId?.toString() === (selectedItem.teamId?._id || selectedItem.teamId)?.toString()
          ) && (
            <div className="p-2.5 bg-amber-950/20 border border-amber-900/40 rounded-lg text-xs text-amber-300 flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                Cross-Team Purview: Viewing an incident outside your assigned team. Modifications require team membership or Admin privileges.
              </span>
            </div>
        )}

        {/* CONCURRENT ACTION CONTROLS */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Operational Actions & Workflow
          </span>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Atomic Claim Button or Claimed Indicator */}
            {isUnassigned ? (
              <button
                onClick={handleClaim}
                disabled={isSubmitting}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-sm shadow-emerald-950"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Take Responsibility (Claim)</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg">
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Claimed by <strong className="text-slate-100">{selectedItem.assigneeId?.name || 'Operator'}</strong></span>
              </div>
            )}

            {/* Reassign dropdown */}
            <div className="flex items-center space-x-1">
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1.5 text-slate-200 focus:outline-none"
              >
                <option value="">Reassign to...</option>
                {users.map(u => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!assigneeId || isSubmitting}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs px-2.5 py-1.5 rounded text-slate-200 font-medium transition"
              >
                Assign
              </button>
            </div>

            {/* Workflow Transition */}
            <div className="flex items-center space-x-1">
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1.5 text-slate-200 focus:outline-none"
              >
                <option value="">Transition Status...</option>
                <option value="TRIAGED">TRIAGED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
              <button
                onClick={handleTransition}
                disabled={!targetStatus || isSubmitting}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs px-2.5 py-1.5 rounded text-slate-200 font-medium transition"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Dual Authorization / Approval Gate Actions */}
          {selectedItem.requiresApproval && selectedItem.approvalDetails?.state === 'PENDING' && (
            <div className="mt-3 p-3 bg-indigo-950/30 border border-indigo-900/60 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-300 block">Approval Gate Pending</span>
                <span className="text-[11px] text-slate-400">Requires Team Lead or Admin verification before resolution.</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleApproval('APPROVED')}
                  disabled={isSubmitting}
                  className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1.5 rounded font-medium transition"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => handleApproval('REJECTED')}
                  disabled={isSubmitting}
                  className="flex items-center space-x-1 bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-1.5 rounded font-medium transition"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AUDIT LOG TIMELINE */}
        <AuditTimeline workItemId={selectedItem._id} version={selectedItem.version} />

      </div>

      {/* Comment Input Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90">
        <form onSubmit={handleAddComment} className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Add operational update or decision note..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center space-x-1 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Comment</span>
          </button>
        </form>
      </div>

    </div>
  );
}

