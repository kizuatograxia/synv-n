import {
  ProductType,
  FeeAllocation,
  FeeBreakdown,
  InstallmentFeeResult,
  PayoutCalculation,
  RefundCalculation,
} from './types';
import { getStateTaxRate } from './state-taxes';

export class FeeEngine {
  private static readonly STANDARD_SERVICE_FEE_PERCENTAGE = 0.10;
  private static readonly BILETO_PREMIUM_FEE_PERCENTAGE = 0.15;
  private static readonly PROCESSING_FEE_MIN = 0.02;
  private static readonly PROCESSING_FEE_MAX = 0.025;
  private static readonly MINIMUM_FEE = 3.99;
  private static readonly MINIMUM_FEE_THRESHOLD = 39.90;
  private static readonly INSTALLMENT_INTEREST_RATE = 0.0349;
  private static readonly ANTICIPATION_FEE_RATE = 0.0349;
  private static readonly MIN_INSTALLMENT_AMOUNT = 5.00;
  private static readonly BILETO_FEE_TIER_THRESHOLD = Number(process.env.BILETO_FEE_TIER_THRESHOLD) || 10000;

  static calculateServiceFee(
    ticketPrice: number,
    productType: ProductType,
    eventRevenue: number = 0,
    organizerState?: string
  ): number {
    let baseFee: number;

    if (productType === 'BILETO' || productType === 'STREAMING') {
      // Use premium fee (15%) if event revenue is at or below threshold, otherwise standard fee (10%)
      const feePercentage = eventRevenue <= this.BILETO_FEE_TIER_THRESHOLD
        ? this.BILETO_PREMIUM_FEE_PERCENTAGE
        : this.STANDARD_SERVICE_FEE_PERCENTAGE;
      const biletoStreamingFee = ticketPrice * feePercentage;
      baseFee = Math.max(biletoStreamingFee, this.MINIMUM_FEE);
    } else if (productType === 'LIVE') {
      const liveFee = ticketPrice * this.STANDARD_SERVICE_FEE_PERCENTAGE;
      baseFee = Math.max(liveFee, 2.50);
    } else if (productType === 'PLAY') {
      const playFee = ticketPrice * this.STANDARD_SERVICE_FEE_PERCENTAGE;
      baseFee = Math.max(playFee, 2.50);
    } else {
      baseFee = ticketPrice * this.STANDARD_SERVICE_FEE_PERCENTAGE;
    }

    // Apply state tax if applicable
    if (organizerState) {
      const stateTaxRate = getStateTaxRate(organizerState);
      if (stateTaxRate > 0) {
        const stateTax = ticketPrice * stateTaxRate;
        baseFee += stateTax;
      }
    }

    return baseFee;
  }

  static calculateProcessingFee(ticketPrice: number): number {
    return ticketPrice * this.PROCESSING_FEE_MIN;
  }

  static calculateTotalFees(
    ticketPrice: number,
    productType: ProductType,
    eventRevenue: number = 0,
    organizerState?: string
  ): FeeBreakdown {
    const serviceFee = this.calculateServiceFee(ticketPrice, productType, eventRevenue, organizerState);
    const processingFee = this.calculateProcessingFee(ticketPrice);
    const totalFee = serviceFee + processingFee;

    return {
      ticketPrice,
      serviceFee: Math.round(serviceFee * 100) / 100,
      processingFee: Math.round(processingFee * 100) / 100,
      minimumFeeApplied: ticketPrice <= this.MINIMUM_FEE_THRESHOLD,
      totalFee: Math.round(totalFee * 100) / 100,
      feeAllocation: 'ORGANIZER',
      organizerReceives: ticketPrice,
      buyerPays: ticketPrice,
    };
  }

  static calculateFeesWithAllocation(
    ticketPrice: number,
    productType: ProductType,
    feeAllocation: FeeAllocation,
    eventRevenue: number = 0,
    organizerState?: string
  ): FeeBreakdown {
    const fees = this.calculateTotalFees(ticketPrice, productType, eventRevenue, organizerState);
    fees.feeAllocation = feeAllocation;

    if (feeAllocation === 'BUYER') {
      fees.buyerPays = Math.round((ticketPrice + fees.totalFee) * 100) / 100;
      fees.organizerReceives = Math.round((fees.buyerPays - fees.processingFee) * 100) / 100;
    } else {
      fees.buyerPays = Math.round((ticketPrice + fees.processingFee) * 100) / 100;
      fees.organizerReceives = Math.round((ticketPrice - fees.serviceFee) * 100) / 100;
    }

    return fees;
  }

  static calculateInstallmentFees(
    ticketPrice: number,
    installments: number
  ): InstallmentFeeResult {
    const totalAmount = ticketPrice * Math.pow(1 + this.INSTALLMENT_INTEREST_RATE, installments);
    const totalInterest = totalAmount - ticketPrice;
    const installmentAmount = totalAmount / installments;

    const installmentsDetails = Array.from({ length: installments }, (_, i) => ({
      installmentNumber: i + 1,
      installmentValue: Math.round(installmentAmount * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalWithInterest: Math.round(totalAmount * 100) / 100,
    }));

    return {
      installmentAmount: Math.round(installmentAmount * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      installments: installmentsDetails,
    };
  }

  static validateInstallments(ticketPrice: number, installments: number): {
    valid: boolean;
    error?: string;
  } {
    if (installments < 1 || installments > 12) {
      return {
        valid: false,
        error: 'Installments must be between 1 and 12',
      };
    }

    const installmentAmount = ticketPrice / installments;
    if (installmentAmount < this.MIN_INSTALLMENT_AMOUNT) {
      return {
        valid: false,
        error: `Each installment must be at least R$${this.MIN_INSTALLMENT_AMOUNT.toFixed(2)}`,
      };
    }

    return { valid: true };
  }

  static calculatePayout(
    totalSales: number,
    totalFees: number,
    anticipationAmount?: number,
    bank?: string,
    isSpecialBank: boolean = false
  ): PayoutCalculation {
    const netAmount = totalSales - totalFees;

    let bankTransferFee: number | undefined;
    if (bank && !isSpecialBank) {
      bankTransferFee = 7.50;
    }

    let anticipationFee: number | undefined;
    let anticipationNetAmount: number | undefined;

    if (anticipationAmount && anticipationAmount > 0) {
      anticipationFee = anticipationAmount * this.ANTICIPATION_FEE_RATE;
      anticipationNetAmount = anticipationAmount - anticipationFee;
    }

    const finalPayout = netAmount - (anticipationNetAmount || 0) - (bankTransferFee || 0);

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      anticipationFee: anticipationFee ? Math.round(anticipationFee * 100) / 100 : undefined,
      anticipationNetAmount: anticipationNetAmount ? Math.round(anticipationNetAmount * 100) / 100 : undefined,
      bankTransferFee: bankTransferFee ? Math.round(bankTransferFee * 100) / 100 : undefined,
      finalPayout: Math.round(finalPayout * 100) / 100,
    };
  }

  static calculateRefund(
    originalAmount: number,
    isWithin7Days: boolean,
    isMoreThan48hBeforeEvent: boolean,
    ticketUsed: boolean,
    promocodeDiscount?: number
  ): RefundCalculation {
    if (ticketUsed) {
      return {
        originalAmount,
        serviceFeeRefunded: false,
        processingFeeRefunded: false,
        refundAmount: 0,
      };
    }

    let serviceFeeRefunded = false;
    let processingFeeRefunded = false;

    // Processing fee is never refundable (charged by payment gateways)
    processingFeeRefunded = false;

    if (isWithin7Days) {
      serviceFeeRefunded = true;
    }

    if (isMoreThan48hBeforeEvent) {
      serviceFeeRefunded = true;
    }

    const serviceFee = originalAmount * this.STANDARD_SERVICE_FEE_PERCENTAGE;
    const processingFee = this.calculateProcessingFee(originalAmount);

    let refundAmount = originalAmount;

    if (!serviceFeeRefunded) {
      refundAmount -= serviceFee;
    }

    // Processing fee is always deducted from refund
    if (!processingFeeRefunded) {
      refundAmount -= processingFee;
    }

    refundAmount = Math.max(0, refundAmount);

    return {
      originalAmount: Math.round(originalAmount * 100) / 100,
      serviceFeeRefunded,
      processingFeeRefunded,
      refundAmount: Math.round(refundAmount * 100) / 100,
    };
  }

  static isSpecialBank(bankName: string): boolean {
    const specialBanks = ['Banco do Brasil', 'Bradesco', 'Itaú', 'Santander'];
    return specialBanks.includes(bankName);
  }

  static validateAnticipationRequest(
    totalSales: number,
    daysBeforeEvent: number,
    isPrivate: boolean,
    isPublished: boolean,
    hasBankAccount: boolean,
    isPlayContent: boolean
  ): {
    valid: boolean;
    error?: string;
  } {
    if (isPlayContent) {
      return {
        valid: false,
        error: 'Payment anticipation is not available for Simprão Play content',
      };
    }

    if (isPrivate) {
      return {
        valid: false,
        error: 'Payment anticipation is not available for private events',
      };
    }

    if (!isPublished) {
      return {
        valid: false,
        error: 'Event must be published to request anticipation',
      };
    }

    if (!hasBankAccount) {
      return {
        valid: false,
        error: 'Bank account must be registered',
      };
    }

    if (totalSales < 300) {
      return {
        valid: false,
        error: 'Minimum of R$300 in confirmed sales required',
      };
    }

    if (daysBeforeEvent < 4) {
      return {
        valid: false,
        error: 'Request must be made at least 4 days before event start',
      };
    }

    return { valid: true };
  }
}
