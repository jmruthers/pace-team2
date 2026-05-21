import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { createGetAppIdResolver, setupRBAC } from '@solvera/pace-core/rbac';
import {
  UnifiedAuthProvider,
  InactivityWarningModal,
  SessionRestorationLoader,
  QueryRetryHandler,
  queryErrorHandler,
} from '@solvera/pace-core';
import { supabaseClient } from '@/lib/supabase';
import './app.css';
import App from './App';

const APP_NAME = 'YOUR_APP';

setupRBAC(supabaseClient, {
  appName: APP_NAME,
  getAppId: createGetAppIdResolver(supabaseClient),
});

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: QueryRetryHandler,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => queryErrorHandler(error, 'Query'),
  }),
  mutationCache: new MutationCache({
    onError: (error) => queryErrorHandler(error, 'Mutation'),
  }),
});
const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <UnifiedAuthProvider
        supabaseClient={supabaseClient}
        appName={APP_NAME}
        idleTimeoutMs={IDLE_TIMEOUT_MS}
        warnBeforeMs={WARN_BEFORE_MS}
        onIdleLogout={async () => {
          await supabaseClient.auth.signOut();
        }}
        renderInactivityWarning={({ timeRemaining, onStaySignedIn, onSignOutNow }) => (
          <InactivityWarningModal
            isOpen
            timeRemaining={timeRemaining}
            onStaySignedIn={onStaySignedIn}
            onSignOutNow={onSignOutNow}
          />
        )}
      >
        <SessionRestorationLoader message="Restoring session…">
          <App />
        </SessionRestorationLoader>
      </UnifiedAuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
