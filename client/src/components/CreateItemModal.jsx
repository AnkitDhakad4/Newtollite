import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { X, Plus, Sparkles } from 'lucide-react';

export default function CreateItemModal({ isOpen, onClose }) {
  const { teams, activeUser, refreshSelectedItem, showToast, handleApiError } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CUSTOMER_ISSUE');
  const [priority, setPriority] = useState('MEDIUM');
  const [teamId, setTeamId] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [slaHours, setSlaHours] = useState('24');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Title and description are required.', 'error');
      return;
    }

    const selectedTeam = teamId || (teams[0]?._id);
    if (!selectedTeam) {
      showToast('Please select a team.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        teamId: selectedTeam,
        requiresApproval,
        slaHours: parseInt(slaHours) || 24,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await api.createWorkItem(payload, activeUser._id);
      if (res.success) {
        showToast(`Created ${res.data.itemNumber} successfully! AI Copilot queued for triage.`, 'success');
        refreshSelectedItem(res.data._id);
        onClose();
        // Reset form
        setTitle('');
        setDescription('');
        setTags('');
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white">Create Operational Work Item</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Gateway settlement discrepancy on batch #4810"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Team *</label>
              <select
                value={teamId || (teams[0]?._id || '')}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {teams.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="CUSTOMER_ISSUE">Customer Issue</option>
                <option value="INCIDENT">Production Incident</option>
                <option value="PAYMENT_INVESTIGATION">Payment Investigation</option>
                <option value="COMPLIANCE">Compliance & Sanctions</option>
                <option value="OPERATIONAL_APPROVAL">Operational Approval</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">SLA Resolution Target (Hours)</label>
              <input
                type="number"
                min="1"
                max="168"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Description *</label>
            <textarea
              required
              rows={4}
              placeholder="Detail symptoms, affected customer IDs, error codes, and operational context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              placeholder="gateway, ach, eu-central, urgent"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-1 flex items-center space-x-2">
            <input
              type="checkbox"
              id="reqApproval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <label htmlFor="reqApproval" className="text-slate-300 cursor-pointer">
              Requires Team Lead Operational Approval Gate before resolution
            </label>
          </div>

          {/* AI Notice */}
          <div className="bg-purple-950/30 border border-purple-900/50 rounded-lg p-2.5 flex items-center space-x-2 text-purple-300 text-[11px]">
            <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
            <span>Upon submission, Agentic AI OpsCopilot will asynchronously evaluate root cause, assess urgency, and check for duplicate tickets.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow disabled:opacity-40"
            >
              {isSubmitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

