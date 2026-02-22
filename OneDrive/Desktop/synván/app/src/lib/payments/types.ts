export type PaymentMethod = 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'APPLE_PAY' | 'GOOGLE_PAY'

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REFUSED' | 'REFUNDED'

export interface PaymentData {
  orderId: string
  amount: number
  paymentMethod: PaymentMethod
  installments: number
  cardNumber?: string
  cardCvv?: string
  cardExpiry?: string
  cardHolderName?: string
  pixKey?: string
  customerEmail: string
  customerCpf?: string
  customerPhone?: string
}

export interface PaymentResult {
  status: PaymentStatus
  transactionId?: string
  qrCode?: string
  boletoUrl?: string
  approvalCode?: string
  refusalReason?: string
  estimatedApprovalTime?: string
}

export interface RefundResult {
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  refundId?: string
  estimatedProcessingTime?: string
}

export interface RiskAnalysis {
  riskScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  factors: string[]
  approved: boolean
  recommendedAction?: 'APPROVE' | 'MANUAL_REVIEW' | 'DECLINE'
}
