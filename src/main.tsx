import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { UnifiedAuthProvider } from '@solvera/pace-core';
import { InactivityWarningModal, SessionRestorationLoader } from '@solvera/pace-core/components';
import { useUnifiedAuthContext, OrganisationServiceProvider } from '@solvera/pace-core/providers';
import { createGetAppIdResolver, setupRBAC } from '@solvera/pace-core/rbac';
import { QueryRetryHandler, queryErrorHandler } from '@solvera/pace-core/utils';
import { supabaseClient } from './lib/supabase';
import App, { APP_NAME } from './App';
import './app.css';

const resolveTeamAppId = createGetAppIdResolver(supabaseClient);

setupRBAC(supabaseClient, {
  appName: APP_NAME,
  getAppId: resolveTeamAppId,
});

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

function AppProviders() {
  const { user, session } = useUnifiedAuthContext();
  return (
    <OrganisationServiceProvider supabaseClient={supabaseClient} user={user} session={session}>
      <SessionRestorationLoader message="Restoring session…">
        <App />
      </SessionRestorationLoader>
    </OrganisationServiceProvider>
  );
}

const rootElement = document.getElementById('root');

if (rootElement == null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <UnifiedAuthProvider
        supabaseClient={supabaseClient}
        appName={APP_NAME}
        idleTimeoutMs={30 * 60 * 1000}
        warnBeforeMs={2 * 60 * 1000}
        onIdleLogout={() => {
          void supabaseClient.auth.signOut();
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
        <AppProviders />
      </UnifiedAuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
