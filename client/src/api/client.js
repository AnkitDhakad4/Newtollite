// API Client with automatic Idempotency-Key and multi-actor header injection

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function apiRequest(endpoint, options = {}, activeUserId = null) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Attach active simulated user header
  if (activeUserId) {
    headers['x-user-id'] = activeUserId;
  }

  // Automatically attach Idempotency-Key for state-mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers['idempotency-key']) {
    headers['idempotency-key'] = generateUUID();
  }

  const response = await fetch(endpoint, {
    ...options,
    method,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.code = data?.code;
    throw error;
  }

  return data;
}

export const api = {
  // Auth & Team
  getMe: (userId) => apiRequest('/api/auth/me', {}, userId),
  getUsers: (userId) => apiRequest('/api/auth/users', {}, userId),
  getTeams: (userId) => apiRequest('/api/teams', {}, userId),

  // Work Items
  getWorkItems: (params = {}, userId) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    return apiRequest(`/api/work-items?${searchParams.toString()}`, {}, userId);
  },
  getAttentionFeed: (userId) => apiRequest('/api/work-items/attention-feed', {}, userId),
  getWorkItemById: (id, userId) => apiRequest(`/api/work-items/${id}`, {}, userId),
  createWorkItem: (payload, userId) => 
    apiRequest('/api/work-items', { method: 'POST', body: JSON.stringify(payload) }, userId),
  updateWorkItem: (id, payload, userId) =>
    apiRequest(`/api/work-items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, userId),
  
  // Concurrency & Workflow Operations
  claimWorkItem: (id, version, userId) =>
    apiRequest(`/api/work-items/${id}/claim`, { method: 'POST', body: JSON.stringify({ version }) }, userId),
  assignWorkItem: (id, targetUserId, version, userId) =>
    apiRequest(`/api/work-items/${id}/assign`, { method: 'POST', body: JSON.stringify({ targetUserId, version }) }, userId),
  transitionStatus: (id, targetStatus, reason, version, userId) =>
    apiRequest(`/api/work-items/${id}/transition`, { method: 'POST', body: JSON.stringify({ targetStatus, reason, version }) }, userId),
  requestApproval: (id, reason, approverId, version, userId) =>
    apiRequest(`/api/work-items/${id}/request-approval`, { method: 'POST', body: JSON.stringify({ reason, approverId, version }) }, userId),
  decideApproval: (id, decision, reason, version, userId) =>
    apiRequest(`/api/work-items/${id}/decide-approval`, { method: 'POST', body: JSON.stringify({ decision, reason, version }) }, userId),

  // Audit Log & Collaboration
  getHistory: (id, page = 1, userId) =>
    apiRequest(`/api/work-items/${id}/history?page=${page}`, {}, userId),
  addComment: (id, comment, userId) =>
    apiRequest(`/api/work-items/${id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) }, userId)
};

