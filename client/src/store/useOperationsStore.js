import { create } from 'zustand';
import { api } from '../api/client.js';
import { io } from 'socket.io-client';

export const useOperationsStore = create((set, get) => ({
  // State
  users: [],
  teams: [],
  activeUser: null,
  workItems: [],
  pagination: { page: 1, limit: 15, total: 0, totalPages: 1 },
  selectedItem: null,
  attentionFeed: {
    slaBreaching: [],
    unassignedUrgent: [],
    pendingApprovals: [],
    myActiveWork: []
  },
  filters: {
    teamId: '',
    status: '',
    priority: '',
    search: '',
    unassignedOnly: false,
    page: 1
  },
  loading: false,
  conflictModal: {
    isOpen: false,
    message: '',
    serverResource: null,
    onAcceptServer: null
  },
  toast: null,
  socket: null,

  // Synchronous setters
  setActiveUser: (user) => {
    set({ activeUser: user });
    get().fetchWorkItems();
    get().fetchAttentionFeed();
  },

  setSelectedItem: (item) => set({ selectedItem: item }),

  setFilters: (filterUpdater) => {
    set((state) => ({
      filters: typeof filterUpdater === 'function' ? filterUpdater(state.filters) : { ...state.filters, ...filterUpdater }
    }));
    get().fetchWorkItems();
  },

  setConflictModal: (modalState) => set({ conflictModal: modalState }),

  showToast: (message, type = 'info') => {
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => {
      set((state) => (state.toast?.message === message ? { toast: null } : {}));
    }, 4000);
  },

  // Async Actions
  fetchInitialData: async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        api.getUsers(),
        api.getTeams()
      ]);
      if (usersRes.success) {
        set({ users: usersRes.data, activeUser: usersRes.data[0] || null });
      }
      if (teamsRes.success) {
        set({ teams: teamsRes.data });
      }
      if (usersRes.data?.[0]) {
        get().fetchWorkItems();
        get().fetchAttentionFeed();
      }
    } catch (err) {
      console.error('[Zustand] Failed to load initial data:', err);
    }
  },

  fetchWorkItems: async () => {
    const { activeUser, filters } = get();
    if (!activeUser) return;
    set({ loading: true });
    try {
      const res = await api.getWorkItems(filters, activeUser._id);
      if (res.success) {
        set((state) => ({
          workItems: res.data,
          pagination: res.pagination,
          selectedItem: state.selectedItem
            ? (res.data.find((i) => i._id === state.selectedItem._id) || state.selectedItem)
            : (res.data[0] || null)
        }));
      }
    } catch (err) {
      console.error('[Zustand] Failed to fetch work items:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchAttentionFeed: async () => {
    const { activeUser } = get();
    if (!activeUser) return;
    try {
      const res = await api.getAttentionFeed(activeUser._id);
      if (res.success) {
        set({ attentionFeed: res.feed });
      }
    } catch (err) {
      console.error('[Zustand] Failed to fetch attention feed:', err);
    }
  },

  refreshSelectedItem: async (id) => {
    const { activeUser } = get();
    if (!activeUser || !id) return;
    try {
      const res = await api.getWorkItemById(id, activeUser._id);
      if (res.success) {
        set({ selectedItem: res.data });
        get().fetchWorkItems();
        get().fetchAttentionFeed();
      }
    } catch (err) {
      console.error('[Zustand] Failed to refresh item:', err);
    }
  },

  // Real-time Socket.io lifecycle
  initSocket: () => {
    if (get().socket) return;

    const socketUrl = typeof window !== 'undefined' && window.location.port === '5173' 
      ? 'http://localhost:5000' 
      : (typeof window !== 'undefined' ? window.location.origin : '/');
    const socketInstance = io(socketUrl, { transports: ['websocket', 'polling'] });

    socketInstance.on('connect', () => {
      console.log('[Zustand Socket.io] Connected to operational stream:', socketInstance.id);
    });

    // Real-time Event: Work item claimed by another client
    socketInstance.on('WORK_ITEM_CLAIMED', (data) => {
      console.log('[Zustand Socket.io] Real-time claim broadcast received:', data);

      // 1. Atomically update workItems array in store
      set((state) => ({
        workItems: state.workItems.map((item) =>
          item._id === data.workItemId
            ? { ...item, assigneeId: data.assignee, status: data.status, version: data.version, claimedAt: data.claimedAt }
            : item
        ),
        // 2. If the user currently has this item open in the detail view, update it instantly
        selectedItem:
          state.selectedItem && state.selectedItem._id === data.workItemId
            ? { ...state.selectedItem, assigneeId: data.assignee, status: data.status, version: data.version, claimedAt: data.claimedAt }
            : state.selectedItem
      }));

      // 3. Notify operator of real-time claim
      get().showToast(`${data.itemNumber} was claimed by ${data.assignee.name} (OCC v${data.version})`, 'info');

      // 4. Refresh attention feed
      get().fetchAttentionFeed();
    });

    // Real-time Event: Work item updated
    socketInstance.on('WORK_ITEM_UPDATED', (updatedItem) => {
      set((state) => ({
        workItems: state.workItems.map((item) =>
          item._id === updatedItem._id ? updatedItem : item
        ),
        selectedItem:
          state.selectedItem && state.selectedItem._id === updatedItem._id
            ? updatedItem
            : state.selectedItem
      }));
      get().fetchAttentionFeed();
    });

    // Real-time Event: New work item created
    socketInstance.on('WORK_ITEM_CREATED', (newItem) => {
      set((state) => ({
        workItems: [newItem, ...state.workItems]
      }));
      get().fetchAttentionFeed();
      get().showToast(`New incident logged: ${newItem.itemNumber}`, 'info');
    });

    set({ socket: socketInstance });
  },

  // Conflict & error handler (OCC HTTP 409)
  handleApiError: (err, onResolved) => {
    if (err.status === 409) {
      const serverResource = err.data?.details?.currentResource || err.data?.currentResource;
      set({
        conflictModal: {
          isOpen: true,
          message: err.message,
          serverResource,
          onAcceptServer: () => {
            if (serverResource) {
              set({ selectedItem: serverResource });
            }
            get().fetchWorkItems();
            get().fetchAttentionFeed();
            set({ conflictModal: { isOpen: false, message: '', serverResource: null, onAcceptServer: null } });
            if (onResolved) onResolved();
          }
        }
      });
    } else {
      get().showToast(err.message, 'error');
    }
  }
}));
