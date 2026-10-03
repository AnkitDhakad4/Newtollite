import React, { createContext, useContext, useEffect } from 'react';
import { useOperationsStore } from '../store/useOperationsStore.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const store = useOperationsStore();

  useEffect(() => {
    store.fetchInitialData();
    store.initSocket();
  }, []);

  return (
    <AppContext.Provider value={store}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    // Gracefully fallback to Zustand directly if used outside provider
    return useOperationsStore();
  }
  return context;
}

export default AppContext;

