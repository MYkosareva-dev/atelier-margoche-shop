import * as migration_20260925_110217_initial from './20260925_110217_initial';

export const migrations = [
  {
    up: migration_20260925_110217_initial.up,
    down: migration_20260925_110217_initial.down,
    name: '20260925_110217_initial'
  },
];
