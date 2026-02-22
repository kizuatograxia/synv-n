/**
 * State-specific tax rates for Brazilian states
 *
 * Some Brazilian states have special tax regulations for event ticketing:
 * - ES (Espírito Santo): Specific state tax rate
 * - RR (Roraima): Specific state tax rate
 * - AC (Acre): Specific state tax rate
 *
 * All other states use the standard federal rate (no additional state tax).
 *
 * Reference: docs/state-taxes.md
 */

export type BrazilianState = 'ES' | 'RR' | 'AC' | string;

export interface StateTaxRate {
  state: BrazilianState;
  rate: number; // Tax rate as a decimal (e.g., 0.02 for 2%)
  description: string;
}

/**
 * STATE_TAX_RATES - Additional tax rates by state
 *
 * These rates are applied on top of the standard service fees for organizers
 * based in specific Brazilian states.
 */
export const STATE_TAX_RATES: Record<string, StateTaxRate> = {
  ES: {
    state: 'ES',
    rate: 0.02, // 2% tax for Espírito Santo
    description: 'Imposto sobre serviços para o estado do Espírito Santo',
  },
  RR: {
    state: 'RR',
    rate: 0.02, // 2% tax for Roraima
    description: 'Imposto sobre serviços para o estado de Roraima',
  },
  AC: {
    state: 'AC',
    rate: 0.02, // 2% tax for Acre
    description: 'Imposto sobre serviços para o estado do Acre',
  },
};

/**
 * Gets the state tax rate for a given Brazilian state.
 *
 * @param state - The two-letter Brazilian state code (e.g., 'ES', 'SP', 'RJ')
 * @returns The state tax rate, or 0 if the state has no special tax
 */
export function getStateTaxRate(state: BrazilianState): number {
  const stateTax = STATE_TAX_RATES[state.toUpperCase()];
  return stateTax ? stateTax.rate : 0;
}

/**
 * Checks if a state has a special tax rate.
 *
 * @param state - The two-letter Brazilian state code
 * @returns true if the state has a special tax rate, false otherwise
 */
export function hasStateTax(state: BrazilianState): boolean {
  return STATE_TAX_RATES.hasOwnProperty(state.toUpperCase());
}
