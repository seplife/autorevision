import { Link } from 'react-router-dom';
import { usePlatform } from '@/app/usePlatform';

const PARCOURS = [
  { classe: 'Troisième', examen: 'BEPC', texte: 'Programme de 3e organisé par matière et par chapitre, entraînement de type BEPC.' },
  { classe: 'Terminale A', examen: 'BAC A', texte: 'Méthodes de dissertation, analyse de textes, argumentation et sujets d’entraînement.' },
  { classe: 'Terminale D', examen: 'BAC D', texte: 'Mathématiques, SVT, Physique-Chimie : méthodes, exercices progressifs, corrections détaillées.' },
];

export default function Accueil() {
  const { platform_name, slogan } = usePlatform();
  return (
    <>
      <section className="bg-gradient-to-b from-marine-900 to-marine-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="font-semibold text-ciel-300">{slogan}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            Réviser à la maison, même sans connexion Internet.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-marine-100">
            {platform_name} accompagne les élèves de 3e et de Terminale A et D, et permet aux parents de suivre le travail
            de leur enfant.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/inscription" className="inline-flex min-h-11 items-center rounded-lg bg-savane-600 px-5 py-3 font-bold text-white hover:bg-savane-500">
              Créer un compte gratuit
            </Link>
            <Link to="/presentation" className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-5 py-3 font-semibold hover:bg-white/10">
              Comment ça marche ?
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="parcours-titre">
        <h2 id="parcours-titre" className="text-2xl font-bold text-marine-900 dark:text-white">
          Trois parcours de préparation
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {PARCOURS.map((p) => (
            <li key={p.classe} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-marine-800 dark:bg-marine-900">
              <p className="text-sm font-semibold uppercase tracking-wide text-savane-700 dark:text-savane-500">{p.examen}</p>
              <h3 className="mt-1 text-xl font-bold text-marine-900 dark:text-white">{p.classe}</h3>
              <p className="mt-2 text-slate-700 dark:text-slate-300">{p.texte}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-lg bg-marine-50 p-4 text-sm text-marine-900 dark:bg-marine-900 dark:text-marine-100">
          Les contenus pédagogiques sont en cours de préparation. Chaque programme et chaque ressource affiche son statut de
          vérification : seuls les contenus marqués « Validé pédagogiquement » ont été contrôlés par un responsable
          pédagogique à partir des référentiels officiels.
        </p>
      </section>
    </>
  );
}
