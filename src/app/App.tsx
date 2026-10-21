import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { LoadingScreen } from '@/components/Loading';
import { AuthProvider, useAuth } from '@/features/authentification/AuthProvider';
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from '@/features/authentification/guards';
import { ConnectivityProvider } from '@/features/connectivite/ConnectivityProvider';
import { AppLayout, PublicLayout } from '@/layouts/Layouts';
import { appConfig } from '@/lib/env';
import { AccesRefuse, CompteEnAttente, Confidentialite, EspaceRedirect, NonConfigure, NotFound } from '@/pages/public/Divers';
import { UpdatePrompt } from './pwa';
import { ThemeProvider } from './theme';

// Découpage du code : chaque espace n'est téléchargé que s'il est utilisé
// (puis précaché par le Service Worker pour l'usage hors connexion).
const Accueil = lazy(() => import('@/pages/public/Accueil'));
const Presentation = lazy(() => import('@/pages/public/Presentation'));
const Connexion = lazy(() => import('@/pages/public/Connexion'));
const Inscription = lazy(() => import('@/pages/public/Inscription'));
const MotDePasseOublie = lazy(() => import('@/pages/public/MotDePasse').then((m) => ({ default: m.MotDePasseOublie })));
const NouveauMotDePasse = lazy(() => import('@/pages/public/MotDePasse').then((m) => ({ default: m.NouveauMotDePasse })));
const TableauDeBordEleve = lazy(() => import('@/pages/eleve/TableauDeBordEleve'));
const ChoixClasse = lazy(() => import('@/pages/eleve/ChoixClasse'));
const LiaisonParents = lazy(() => import('@/pages/eleve/LiaisonParents'));
const TableauDeBordParent = lazy(() => import('@/pages/parent/TableauDeBordParent'));
const EspacePedagogique = lazy(() => import('@/pages/enseignant/EspacePedagogique'));
const ListeCours = lazy(() => import('@/pages/enseignant/GestionCours').then((m) => ({ default: m.ListeCours })));
const EditeurCours = lazy(() => import('@/pages/enseignant/GestionCours').then((m) => ({ default: m.EditeurCours })));
const MesCours = lazy(() => import('@/pages/eleve/MesCours'));
const GestionUtilisateurs = lazy(() => import('@/pages/administration/GestionUtilisateurs'));
const ParametresPlateforme = lazy(() => import('@/pages/administration/ParametresPlateforme'));
const Parametres = lazy(() => import('@/pages/Parametres'));

const page = (el: React.ReactNode) => <Suspense fallback={<LoadingScreen />}>{el}</Suspense>;

/** Après un clic sur le lien de réinitialisation, on force l'écran « nouveau mot de passe ». */
function RecoveryGate({ children }: { children: React.ReactNode }) {
  const { passwordRecovery } = useAuth();
  if (passwordRecovery && window.location.pathname !== '/nouveau-mot-de-passe') {
    return <Navigate to="/nouveau-mot-de-passe" replace />;
  }
  return <>{children}</>;
}

export const routes = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: page(<Accueil />) },
      { path: '/presentation', element: page(<Presentation />) },
      { path: '/confidentialite', element: <Confidentialite /> },
      { path: '/connexion', element: <RedirectIfAuthenticated>{page(<Connexion />)}</RedirectIfAuthenticated> },
      { path: '/inscription', element: <RedirectIfAuthenticated>{page(<Inscription />)}</RedirectIfAuthenticated> },
      { path: '/mot-de-passe-oublie', element: page(<MotDePasseOublie />) },
      { path: '/nouveau-mot-de-passe', element: page(<NouveauMotDePasse />) },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: (
          <RecoveryGate>
            <AppLayout />
          </RecoveryGate>
        ),
        children: [
          { path: '/espace', element: <EspaceRedirect /> },
          { path: '/compte-en-attente', element: <CompteEnAttente /> },
          { path: '/acces-refuse', element: <AccesRefuse /> },
          { path: '/parametres', element: page(<Parametres />) },
          {
            element: <RequireRole allowed={['eleve']} />,
            children: [
              { path: '/eleve', element: page(<TableauDeBordEleve />) },
              { path: '/eleve/classe', element: page(<ChoixClasse />) },
              { path: '/eleve/cours', element: page(<MesCours />) },
              { path: '/eleve/parents', element: page(<LiaisonParents />) },
            ],
          },
          {
            element: <RequireRole allowed={['parent']} />,
            children: [{ path: '/parent', element: page(<TableauDeBordParent />) }],
          },
          {
            element: <RequireRole allowed={['enseignant', 'responsable_pedagogique', 'administrateur']} />,
            children: [
              { path: '/enseignant', element: page(<EspacePedagogique />) },
              { path: '/enseignant/cours', element: page(<ListeCours />) },
              { path: '/enseignant/cours/:id', element: page(<EditeurCours />) },
            ],
          },
          {
            element: <RequireRole allowed={['administrateur']} />,
            children: [
              { path: '/administration', element: page(<GestionUtilisateurs />) },
              { path: '/administration/parametres', element: page(<ParametresPlateforme />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const router = createBrowserRouter(routes);

export function App() {
  if (!appConfig.configured) {
    return (
      <ThemeProvider>
        <NonConfigure problems={appConfig.problems} />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectivityProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <UpdatePrompt />
          </AuthProvider>
        </ConnectivityProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
