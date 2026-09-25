import * as migration_20260925_110217_initial from './20260925_110217_initial';
import * as migration_20260925_121430_orders from './20260925_121430_orders';

export const migrations = [
  {
    up: migration_20260925_110217_initial.up,
    down: migration_20260925_110217_initial.down,
    name: '20260925_110217_initial',
  },
  {
    up: migration_20260925_121430_orders.up,
    down: migration_20260925_121430_orders.down,
    name: '20260925_121430_orders'
  },
];
