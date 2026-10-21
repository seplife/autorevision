import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Connexion from '@/pages/public/Connexion';
import Inscription from '@/pages/public/Inscription';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('formulaire de connexion', () => {
  it('valide côté client et relie les erreurs aux champs (accessibilité)', async () => {
    wrap(<Connexion />);
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    const email = screen.getByLabelText('Adresse e-mail');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Saisissez une adresse e-mail valide.');
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription('Saisissez votre mot de passe.');
  });
});

describe('formulaire d’inscription', () => {
  it('ne propose que les comptes élève et parent', () => {
    wrap(<Inscription />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['eleve', 'parent']);
  });

  it('signale des mots de passe différents et l’absence d’accord', async () => {
    wrap(<Inscription />);
    await userEvent.type(screen.getByLabelText('Ton prénom et ton nom'), 'Awa Konan');
    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'awa@exemple.ci');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'abidjan2026');
    await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'abidjan2027');
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument();
    expect(screen.getByText('Vous devez accepter la politique de confidentialité.')).toBeInTheDocument();
  });

  it('adapte le libellé du nom au type de compte', async () => {
    wrap(<Inscription />);
    await userEvent.click(screen.getByRole('radio', { name: 'Parent ou tuteur' }));
    expect(screen.getByLabelText('Votre prénom et votre nom')).toBeInTheDocument();
  });
});
