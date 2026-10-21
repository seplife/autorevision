import type { TestProject } from 'vitest/node';
import { start, fresh } from '../../scripts/db-local.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    dbUrl: string;
  }
}

/** Démarre PostgreSQL local et crée une base de test vierge avec toutes les migrations. */
export default function setup(project: TestProject) {
  start();
  const url: string = fresh('rsci_test');
  project.provide('dbUrl', url);
}
