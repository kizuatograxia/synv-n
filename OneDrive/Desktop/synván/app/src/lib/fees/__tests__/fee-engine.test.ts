import { FeeEngine, ProductType, FeeAllocation } from '@/lib/fees';

describe('FeeEngine', () => {
  describe('calculateServiceFee', () => {
    it('should calculate zero service fee for free event', () => {
      const fee = FeeEngine.calculateServiceFee(0, 'STANDARD');
      expect(fee).toBe(0);
    });

    it('should calculate 10% service fee for standard events', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'STANDARD');
      expect(fee).toBe(10);
    });

    it('should calculate 10% service fee for standard event with R$39.90', () => {
      const fee = FeeEngine.calculateServiceFee(39.90, 'STANDARD');
      expect(fee).toBe(3.99);
    });

    it('should apply minimum fee of R$3.99 for low-priced tickets', () => {
      const fee = FeeEngine.calculateServiceFee(20, 'STANDARD');
      expect(fee).toBe(2);
    });

    it('should calculate up to 15% for Bileto events', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'BILETO');
      expect(fee).toBe(15);
    });

    it('should apply minimum R$3.99 for Bileto low-priced tickets', () => {
      const fee = FeeEngine.calculateServiceFee(20, 'BILETO');
      expect(fee).toBe(3.99);
    });

    it('should calculate up to 15% for Streaming events', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'STREAMING');
      expect(fee).toBe(15);
    });

    it('should calculate 10% with minimum R$2.50 for Live events', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'LIVE');
      expect(fee).toBe(10);
    });

    it('should apply minimum R$2.50 for Live low-priced tickets', () => {
      const fee = FeeEngine.calculateServiceFee(20, 'LIVE');
      expect(fee).toBe(2.50);
    });

    it('should calculate 10% with minimum R$2.50 for Play events', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'PLAY');
      expect(fee).toBe(10);
    });

    it('should apply minimum R$2.50 for Play low-priced tickets', () => {
      const fee = FeeEngine.calculateServiceFee(20, 'PLAY');
      expect(fee).toBe(2.50);
    });

    it('should apply 15% fee for Bileto events below revenue threshold', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'BILETO', 5000);
      expect(fee).toBe(15);
    });

    it('should apply 10% fee for Bileto events above revenue threshold', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'BILETO', 15000);
      expect(fee).toBe(10);
    });

    it('should apply 15% fee for Bileto events at exactly threshold boundary', () => {
      const fee = FeeEngine.calculateServiceFee(100, 'BILETO', 10000);
      expect(fee).toBe(15);
    });

    it('should test Bileto 10% vs 15% tier boundary behavior', () => {
      const ticketPrice = 100;
      const threshold = 10000;

      // Just below threshold (R$9,999.99) - should apply 15% fee
      const feeBelow = FeeEngine.calculateServiceFee(ticketPrice, 'BILETO', threshold - 0.01);
      expect(feeBelow).toBe(15); // 15% of R$100 = R$15

      // At exactly threshold (R$10,000) - should apply 15% fee
      const feeAtThreshold = FeeEngine.calculateServiceFee(ticketPrice, 'BILETO', threshold);
      expect(feeAtThreshold).toBe(15); // 15% of R$100 = R$15

      // Just above threshold (R$10,000.01) - should apply 10% fee
      const feeAbove = FeeEngine.calculateServiceFee(ticketPrice, 'BILETO', threshold + 0.01);
      expect(feeAbove).toBe(10); // 10% of R$100 = R$10

      // Well above threshold (R$15,000) - should apply 10% fee
      const feeWellAbove = FeeEngine.calculateServiceFee(ticketPrice, 'BILETO', 15000);
      expect(feeWellAbove).toBe(10); // 10% of R$100 = R$10
    });

    it('should apply minimum fee floor for Bileto tickets below threshold', () => {
      // Ticket price R$30, 15% would be R$4.50
      // But minimum fee is R$3.99, so R$4.50 should be applied
      const fee = FeeEngine.calculateServiceFee(30, 'BILETO', 5000);
      expect(fee).toBe(4.50);
    });

    it('should apply minimum fee floor of R$3.99 for low-priced Bileto tickets', () => {
      // Ticket price R$20, 15% would be R$3.00
      // Minimum fee floor of R$3.99 should be applied
      const fee = FeeEngine.calculateServiceFee(20, 'BILETO', 5000);
      expect(fee).toBe(3.99);
    });

    it('should apply minimum fee floor for Streaming tickets below threshold', () => {
      // Ticket price R$25, 15% would be R$3.75
      // Minimum fee floor of R$3.99 should be applied
      const fee = FeeEngine.calculateServiceFee(25, 'STREAMING', 5000);
      expect(fee).toBe(3.99);
    });

    it('should not apply minimum fee floor when percentage is higher than minimum', () => {
      // Ticket price R$50, 15% would be R$7.50
      // This is higher than R$3.99 minimum, so R$7.50 should be applied
      const fee = FeeEngine.calculateServiceFee(50, 'BILETO', 5000);
      expect(fee).toBe(7.50);
    });

    it('should apply minimum fee floor of R$2.50 for low-priced Live tickets', () => {
      // Ticket price R$20, 10% would be R$2.00
      // Minimum fee floor of R$2.50 should be applied
      const fee = FeeEngine.calculateServiceFee(20, 'LIVE');
      expect(fee).toBe(2.50);
    });

    it('should not apply minimum fee floor for Live tickets when percentage is higher', () => {
      // Ticket price R$50, 10% would be R$5.00
      // This is higher than R$2.50 minimum, so R$5.00 should be applied
      const fee = FeeEngine.calculateServiceFee(50, 'LIVE');
      expect(fee).toBe(5);
    });

    it('should apply minimum fee floor of R$2.50 for low-priced Play tickets', () => {
      // Ticket price R$20, 10% would be R$2.00
      // Minimum fee floor of R$2.50 should be applied
      const fee = FeeEngine.calculateServiceFee(20, 'PLAY');
      expect(fee).toBe(2.50);
    });

    it('should not apply minimum fee floor for Play tickets when percentage is higher', () => {
      // Ticket price R$40, 10% would be R$4.00
      // This is higher than R$2.50 minimum, so R$4.00 should be applied
      const fee = FeeEngine.calculateServiceFee(40, 'PLAY');
      expect(fee).toBe(4);
    });
  });

  describe('calculateProcessingFee', () => {
    it('should calculate processing fee between 2% and 2.5%', () => {
      const fee = FeeEngine.calculateProcessingFee(100);
      expect(fee).toBeGreaterThanOrEqual(2);
      expect(fee).toBeLessThanOrEqual(2.5);
    });

    it('should calculate processing fee correctly for R$50 ticket', () => {
      const fee = FeeEngine.calculateProcessingFee(50);
      expect(fee).toBeGreaterThanOrEqual(1);
      expect(fee).toBeLessThanOrEqual(1.25);
    });

    it('should calculate processing fee correctly for R$200 ticket', () => {
      const fee = FeeEngine.calculateProcessingFee(200);
      expect(fee).toBeGreaterThanOrEqual(4);
      expect(fee).toBeLessThanOrEqual(5);
    });
  });

  describe('calculateTotalFees', () => {
    it('should calculate total fees for standard R$100 ticket', () => {
      const result = FeeEngine.calculateTotalFees(100, 'STANDARD');
      expect(result.ticketPrice).toBe(100);
      expect(result.serviceFee).toBe(10);
      expect(result.processingFee).toBeGreaterThanOrEqual(2);
      expect(result.processingFee).toBeLessThanOrEqual(2.5);
      expect(result.totalFee).toBeGreaterThanOrEqual(12);
      expect(result.totalFee).toBeLessThanOrEqual(12.5);
      expect(result.feeAllocation).toBe('ORGANIZER');
    });

    it('should mark minimum fee applied for tickets ≤ R$39.90', () => {
      const result = FeeEngine.calculateTotalFees(39.90, 'STANDARD');
      expect(result.minimumFeeApplied).toBe(true);
    });

    it('should not mark minimum fee applied for tickets > R$39.90', () => {
      const result = FeeEngine.calculateTotalFees(50, 'STANDARD');
      expect(result.minimumFeeApplied).toBe(false);
    });
  });

  describe('calculateFeesWithAllocation', () => {
    it('should pass fees to buyer when allocation is BUYER', () => {
      const result = FeeEngine.calculateFeesWithAllocation(100, 'STANDARD', 'BUYER');
      expect(result.feeAllocation).toBe('BUYER');
      expect(result.buyerPays).toBeGreaterThan(100);
      expect(result.organizerReceives).toBeGreaterThan(100);
    });

    it('should absorb fees by organizer when allocation is ORGANIZER', () => {
      const result = FeeEngine.calculateFeesWithAllocation(100, 'STANDARD', 'ORGANIZER');
      expect(result.feeAllocation).toBe('ORGANIZER');
      expect(result.buyerPays).toBeGreaterThan(100);
      expect(result.buyerPays).toBeLessThanOrEqual(102.5);
      expect(result.organizerReceives).toBeLessThan(100);
    });

    it('should correctly calculate R$100 ticket with BUYER allocation', () => {
      const result = FeeEngine.calculateFeesWithAllocation(100, 'STANDARD', 'BUYER');
      const expectedBuyerPays = 100 + result.serviceFee + result.processingFee;
      expect(result.buyerPays).toBeCloseTo(expectedBuyerPays, 2);
      expect(result.organizerReceives).toBeCloseTo(expectedBuyerPays - result.processingFee, 2);
    });

    it('should correctly calculate R$100 ticket with ORGANIZER allocation', () => {
      const result = FeeEngine.calculateFeesWithAllocation(100, 'STANDARD', 'ORGANIZER');
      const expectedBuyerPays = 100 + result.processingFee;
      expect(result.buyerPays).toBeCloseTo(expectedBuyerPays, 2);
      expect(result.organizerReceives).toBeCloseTo(100 - result.serviceFee, 2);
    });
  });

  describe('calculateInstallmentFees', () => {
    it('should calculate 2 installments for R$100 ticket', () => {
      const result = FeeEngine.calculateInstallmentFees(100, 2);
      expect(result.installments.length).toBe(2);
      expect(result.totalAmount).toBeGreaterThan(100);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.installmentAmount).toBeGreaterThan(50);
    });

    it('should calculate 10 installments for R$100 ticket', () => {
      const result = FeeEngine.calculateInstallmentFees(100, 10);
      expect(result.installments.length).toBe(10);
      expect(result.totalAmount).toBeGreaterThan(100);
    });

    it('should calculate 12 installments for R$500 ticket', () => {
      const result = FeeEngine.calculateInstallmentFees(500, 12);
      expect(result.installments.length).toBe(12);
      expect(result.totalAmount).toBeGreaterThan(500);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.installmentAmount).toBeGreaterThan(0);

      // Verify all 12 installments have the same value
      const firstInstallment = result.installments[0].installmentValue;
      result.installments.forEach((installment) => {
        expect(installment.installmentValue).toBe(firstInstallment);
      });

      // Verify the installment calculation
      // Compound interest: 500 * (1 + 0.0349)^12
      const expectedTotal = 500 * Math.pow(1 + 0.0349, 12);
      expect(result.totalAmount).toBeCloseTo(expectedTotal, 2);
    });

    it('should apply 3.49% monthly interest rate', () => {
      const result = FeeEngine.calculateInstallmentFees(100, 1);
      const expectedInterest = 100 * 0.0349;
      expect(result.totalInterest).toBeCloseTo(expectedInterest, 2);
      expect(result.totalAmount).toBeCloseTo(100 + expectedInterest, 2);
    });

    it('should distribute installments evenly', () => {
      const result = FeeEngine.calculateInstallmentFees(100, 3);
      const installments = result.installments;
      expect(installments[0].installmentValue).toBe(installments[1].installmentValue);
      expect(installments[1].installmentValue).toBe(installments[2].installmentValue);
    });
  });

  describe('validateInstallments', () => {
    it('should validate installments within 1-12 range', () => {
      const result = FeeEngine.validateInstallments(100, 5);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject 0 installments', () => {
      const result = FeeEngine.validateInstallments(100, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Installments must be between 1 and 12');
    });

    it('should reject more than 12 installments', () => {
      const result = FeeEngine.validateInstallments(100, 13);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Installments must be between 1 and 12');
    });

    it('should accept 12 installments for eligible ticket price', () => {
      const result = FeeEngine.validateInstallments(100, 12);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject when installment is less than R$5.00', () => {
      const result = FeeEngine.validateInstallments(9, 2);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Each installment must be at least R$5.00');
    });

    it('should accept when installment is exactly R$5.00', () => {
      const result = FeeEngine.validateInstallments(10, 2);
      expect(result.valid).toBe(true);
    });
  });

  describe('calculatePayout', () => {
    it('should calculate net payout after fees', () => {
      const result = FeeEngine.calculatePayout(1000, 150);
      expect(result.totalSales).toBe(1000);
      expect(result.totalFees).toBe(150);
      expect(result.netAmount).toBe(850);
      expect(result.finalPayout).toBe(850);
    });

    it('should apply bank transfer fee for non-special banks', () => {
      const result = FeeEngine.calculatePayout(1000, 150, undefined, 'Other Bank', false);
      expect(result.bankTransferFee).toBe(7.50);
      expect(result.finalPayout).toBe(842.50);
    });

    it('should not apply bank transfer fee for special banks', () => {
      const result = FeeEngine.calculatePayout(1000, 150, undefined, 'Itaú', true);
      expect(result.bankTransferFee).toBeUndefined();
      expect(result.finalPayout).toBe(850);
    });

    it('should calculate anticipation fee', () => {
      const result = FeeEngine.calculatePayout(1000, 150, 500, 'Itaú', true);
      expect(result.anticipationFee).toBeCloseTo(17.45, 2);
      expect(result.anticipationNetAmount).toBeCloseTo(482.55, 2);
      expect(result.finalPayout).toBeCloseTo(367.45, 2);
    });

    it('should correctly identify special banks', () => {
      expect(FeeEngine.isSpecialBank('Banco do Brasil')).toBe(true);
      expect(FeeEngine.isSpecialBank('Bradesco')).toBe(true);
      expect(FeeEngine.isSpecialBank('Itaú')).toBe(true);
      expect(FeeEngine.isSpecialBank('Santander')).toBe(true);
      expect(FeeEngine.isSpecialBank('Nubank')).toBe(false);
    });
  });

  describe('validateAnticipationRequest', () => {
    it('should validate valid anticipation request', () => {
      const result = FeeEngine.validateAnticipationRequest(500, 5, false, true, true, false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject Play content', () => {
      const result = FeeEngine.validateAnticipationRequest(500, 5, false, true, true, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Payment anticipation is not available for Simprão Play content');
    });

    it('should reject private events', () => {
      const result = FeeEngine.validateAnticipationRequest(500, 5, true, true, true, false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Payment anticipation is not available for private events');
    });

    it('should reject unpublished events', () => {
      const result = FeeEngine.validateAnticipationRequest(500, 5, false, false, true, false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event must be published to request anticipation');
    });

    it('should reject events without bank account', () => {
      const result = FeeEngine.validateAnticipationRequest(500, 5, false, true, false, false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bank account must be registered');
    });

    it('should reject sales below R$300', () => {
      const result = FeeEngine.validateAnticipationRequest(299, 5, false, true, true, false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Minimum of R$300 in confirmed sales required');
    });

    it('should reject requests less than 4 days before event', () => {
      const result = FeeEngine.validateAnticipationRequest(500, 3, false, true, true, false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request must be made at least 4 days before event start');
    });
  });

  describe('calculateRefund', () => {
    it('should refund full amount within 7 days', () => {
      const result = FeeEngine.calculateRefund(100, true, true, false);
      expect(result.serviceFeeRefunded).toBe(true);
      expect(result.processingFeeRefunded).toBe(false);
      expect(result.refundAmount).toBeGreaterThan(97);
      expect(result.refundAmount).toBeLessThan(100);
    });

    it('should refund full amount more than 48h before event', () => {
      const result = FeeEngine.calculateRefund(100, false, true, false);
      expect(result.serviceFeeRefunded).toBe(true);
      expect(result.processingFeeRefunded).toBe(false);
      expect(result.refundAmount).toBeGreaterThan(97);
      expect(result.refundAmount).toBeLessThan(100);
    });

    it('should refund minus service fee when not within 7 days and less than 48h before event', () => {
      const result = FeeEngine.calculateRefund(100, false, false, false);
      expect(result.serviceFeeRefunded).toBe(false);
      expect(result.processingFeeRefunded).toBe(false);
      expect(result.refundAmount).toBeGreaterThan(87);
      expect(result.refundAmount).toBeLessThan(90);
    });

    it('should refund zero when ticket is used', () => {
      const result = FeeEngine.calculateRefund(100, true, true, true);
      expect(result.serviceFeeRefunded).toBe(false);
      expect(result.processingFeeRefunded).toBe(false);
      expect(result.refundAmount).toBe(0);
    });

    it('should handle processing fee not being refundable', () => {
      const result = FeeEngine.calculateRefund(100, true, true, false);
      expect(result.processingFeeRefunded).toBe(false);
      const serviceFee = 100 * 0.10;
      const processingFee = FeeEngine.calculateProcessingFee(100);
      expect(result.refundAmount).toBeCloseTo(100 - processingFee, 2);
    });

    it('should refund based on discounted price when promocode was used', () => {
      // Original price: R$ 100
      // Promocode discount: 20% (R$ 20)
      // Amount actually paid: R$ 80
      const discountedPrice = 80;
      const originalPrice = 100;

      const result = FeeEngine.calculateRefund(discountedPrice, true, true, false);

      // Refund should be based on the R$ 80 actually paid, not the original R$ 100
      expect(result.originalAmount).toBe(discountedPrice);
      expect(result.refundAmount).toBeLessThan(discountedPrice); // Minus processing fee

      // Processing fee is calculated on the discounted amount
      const processingFee = FeeEngine.calculateProcessingFee(discountedPrice);
      expect(result.refundAmount).toBeCloseTo(discountedPrice - processingFee, 2);
    });

    it('should always deduct processing fee from refund amount', () => {
      const amount = 100;
      const processingFee = FeeEngine.calculateProcessingFee(amount);

      // Test within 7 days (service fee refunded)
      const result1 = FeeEngine.calculateRefund(amount, true, true, false);
      expect(result1.processingFeeRefunded).toBe(false);
      expect(result1.refundAmount).toBeCloseTo(amount - processingFee, 2);

      // Test more than 48h before event (service fee refunded)
      const result2 = FeeEngine.calculateRefund(amount, false, true, false);
      expect(result2.processingFeeRefunded).toBe(false);
      expect(result2.refundAmount).toBeCloseTo(amount - processingFee, 2);

      // Test not within 7 days and less than 48h before (neither refunded)
      const result3 = FeeEngine.calculateRefund(amount, false, false, false);
      expect(result3.processingFeeRefunded).toBe(false);
      const serviceFee = amount * 0.10;
      expect(result3.refundAmount).toBeCloseTo(amount - serviceFee - processingFee, 2);
    });
  });

  describe('State Tax Compliance', () => {
    it('should apply 2% state tax for ES (Espírito Santo)', () => {
      const ticketPrice = 100;
      const standardFee = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD');
      const feeWithTax = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'ES');

      // Standard fee: 10% = R$10
      // ES state tax: 2% = R$2
      // Total: R$12
      expect(standardFee).toBe(10);
      expect(feeWithTax).toBe(12);
    });

    it('should apply 2% state tax for RR (Roraima)', () => {
      const ticketPrice = 100;
      const standardFee = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD');
      const feeWithTax = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'RR');

      // Standard fee: 10% = R$10
      // RR state tax: 2% = R$2
      // Total: R$12
      expect(standardFee).toBe(10);
      expect(feeWithTax).toBe(12);
    });

    it('should apply 2% state tax for AC (Acre)', () => {
      const ticketPrice = 100;
      const standardFee = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD');
      const feeWithTax = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'AC');

      // Standard fee: 10% = R$10
      // AC state tax: 2% = R$2
      // Total: R$12
      expect(standardFee).toBe(10);
      expect(feeWithTax).toBe(12);
    });

    it('should not apply state tax for states without special rates', () => {
      const ticketPrice = 100;
      const standardFee = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD');
      const feeWithTaxSP = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'SP');
      const feeWithTaxRJ = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'RJ');

      // No additional tax for SP and RJ
      expect(standardFee).toBe(10);
      expect(feeWithTaxSP).toBe(10);
      expect(feeWithTaxRJ).toBe(10);
    });

    it('should handle case-insensitive state codes', () => {
      const ticketPrice = 100;
      const feeLower = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'es');
      const feeUpper = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'ES');
      const feeMixed = FeeEngine.calculateServiceFee(ticketPrice, 'STANDARD', 0, 'Es');

      expect(feeLower).toBe(12);
      expect(feeUpper).toBe(12);
      expect(feeMixed).toBe(12);
    });

    it('should include state tax in total fee calculation', () => {
      const ticketPrice = 100;
      const fees = FeeEngine.calculateTotalFees(ticketPrice, 'STANDARD', 0, 'ES');

      // Service fee: R$10 (10%) + R$2 (2% state tax) = R$12
      // Processing fee: R$2 (2%)
      // Total: R$14
      expect(fees.serviceFee).toBe(12);
      expect(fees.processingFee).toBe(2);
      expect(fees.totalFee).toBe(14);
    });

    it('should include state tax in fee calculation with allocation', () => {
      const ticketPrice = 100;
      const fees = FeeEngine.calculateFeesWithAllocation(
        ticketPrice,
        'STANDARD',
        'ORGANIZER',
        0,
        'RR'
      );

      // Service fee: R$10 (10%) + R$2 (2% state tax) = R$12
      // Processing fee: R$2 (2%)
      // Total: R$14
      expect(fees.serviceFee).toBe(12);
      expect(fees.processingFee).toBe(2);
      expect(fees.totalFee).toBe(14);
    });
  });
});
