/**
 * Payment Constants
 *
 * Configuration values for payment processing and refunds
 */

/**
 * When true, refunds are calculated based on the discounted price paid by the customer
 * (after promocode application), not the original ticket price.
 *
 * Example:
 * - Original price: R$ 100
 * - Promocode discount: R$ 20 (20% off)
 * - Amount paid: R$ 80
 * - Refund amount: R$ 80 minus applicable fees
 *
 * When false, refunds would be calculated based on the original R$ 100 price.
 */
export const REFUND_USES_DISCOUNTED_PRICE = true;

/**
 * Processing fee is never refundable
 * This fee is charged by payment gateways for transaction processing
 */
export const PROCESSING_FEE_NON_REFUNDABLE = true;

/**
 * Service fee refundability rules
 */
export const SERVICE_FULL_REFUND_WITHIN_7_DAYS = true;
export const SERVICE_FULL_REFUND_48H_BEFORE_EVENT = true;
