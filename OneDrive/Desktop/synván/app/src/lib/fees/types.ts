export type ProductType = 'STANDARD' | 'BILETO' | 'STREAMING' | 'LIVE' | 'PLAY';

export type FeeAllocation = 'ORGANIZER' | 'BUYER';

export type InstallmentCalculation = {
  installmentNumber: number;
  installmentValue: number;
  totalInterest: number;
  totalWithInterest: number;
};

export type FeeBreakdown = {
  ticketPrice: number;
  serviceFee: number;
  processingFee: number;
  minimumFeeApplied: boolean;
  totalFee: number;
  feeAllocation: FeeAllocation;
  organizerReceives: number;
  buyerPays: number;
};

export type InstallmentFeeResult = {
  installmentAmount: number;
  totalInterest: number;
  totalAmount: number;
  installments: InstallmentCalculation[];
};

export type PayoutCalculation = {
  totalSales: number;
  totalFees: number;
  netAmount: number;
  anticipationFee?: number;
  anticipationNetAmount?: number;
  bankTransferFee?: number;
  finalPayout: number;
};

export type RefundCalculation = {
  originalAmount: number;
  serviceFeeRefunded: boolean;
  processingFeeRefunded: boolean;
  refundAmount: number;
};
