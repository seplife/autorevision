import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/Card';

export default function Presentation() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Présentation de la plateforme" />
      <div className="space-y-8 text-slate-800 dark:text-slate-200">
        <section>
          <h2 className="text-xl font-bold text-marine-900 dark:text-white">Pour les élèves</h2>
          <p className="mt-2">
            Choisis ta classe et ta série. Le parcours de révision, en cours de développement, proposera chapitre par
            chapitre : objectifs, cours, fiche de mémorisation, exercices progressifs et corrections expliquées. Les
            ressources téléchargées resteront disponibles sans connexion, et tes réponses seront enregistrées sur ton
            appareil puis envoyées au serveur dès que la connexion reviendra.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-marine-900 dark:text-white">Pour les parents</h2>
          <p className="mt-2">
            Votre enfant génère un code de liaison depuis son espace et vous le communique. Une fois saisi, vous voyez
            uniquement les informations de vos enfants liés. Les résultats affichés sont ceux qui ont été synchronisés : la
            date de dernière synchronisation est toujours indiquée.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-marine-900 dark:text-white">Pour les enseignants</h2>
          <p className="mt-2">
            Les enseignants rédigeront cours et exercices ; un responsable pédagogique les vérifiera avant publication.
            Les sujets d’entraînement ne seront jamais présentés comme des sujets officiels.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-marine-900 dark:text-white">Installer l’application</h2>
          <p className="mt-2">
            Sur Android avec Chrome, ouvrez le menu puis « Installer l’application » ou « Ajouter à l’écran d’accueil ». Sur
            ordinateur, utilisez l’icône d’installation de la barre d’adresse. Sur iPhone, utilisez « Partager » puis « Sur
            l’écran d’accueil ». Les possibilités d’installation et l’espace de stockage disponible varient selon le
            navigateur et l’appareil.
          </p>
        </section>
        <Link to="/inscription" className="inline-flex min-h-11 items-center rounded-lg bg-marine-900 px-5 py-3 font-semibold text-white dark:bg-ciel-400 dark:text-marine-950">
          Créer un compte
        </Link>
      </div>
    </div>
  );
}
