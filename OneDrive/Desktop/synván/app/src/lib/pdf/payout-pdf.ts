import { jsPDF } from 'jspdf'

export interface PayoutDetail {
  id: string
  totalSales: number
  totalFees: number
  netAmount: number
  anticipationAmount?: number
  anticipationFee?: number
  bankTransferFee?: number
  finalPayout: number
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'
  scheduledFor?: string
  processedAt?: string
  createdAt: string
  bankAccount?: {
    bankName: string
    agency: string
    account: string
    accountType: string
    accountHolder: string
    cpf: string
    isDefault: boolean
    isVerified: boolean
  }
  event?: {
    id: string
    title: string
  }
  user: {
    name: string
    email: string
  }
}

const statusConfig = {
  PENDING: { label: 'Pendente', description: 'Aguardando aprovação' },
  APPROVED: { label: 'Aprovado', description: 'Aprovado para pagamento' },
  PAID: { label: 'Pago', description: 'Pagamento realizado' },
  CANCELLED: { label: 'Cancelado', description: 'Repasse cancelado' },
}

/**
 * Generate a professional PDF payout statement for download
 * @param payout - Payout data including all details
 * @returns jsPDF instance ready to save
 */
export async function generatePayoutPDF(payout: PayoutDetail): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin

  // Colors (matching design system)
  const primaryColor = { r: 37, g: 99, b: 235 } // blue-600
  const neutralColor = { r: 23, g: 23, b: 23 } // neutral-950
  const grayColor = { r: 107, g: 114, b: 128 } // neutral-500
  const successColor = { r: 34, g: 197, b: 94 } // green-500
  const warningColor = { r: 251, g: 191, b: 36 } // amber-400
  const errorColor = { r: 239, g: 68, b: 68 } // red-500
  const bgColor = { r: 249, g: 250, b: 251 } // neutral-50

  // Set background
  pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')

  let yPos = margin

  // Header with brand color
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b)
  pdf.rect(0, 0, pageWidth, 15, 'F')

  // "BILETO" brand text
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text('BILETO', pageWidth / 2, 9, { align: 'center' })

  // Document title
  yPos = 25
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.text('Comprovante de Repasse', pageWidth / 2, yPos, { align: 'center' })

  yPos += 8

  // Status badge
  const status = statusConfig[payout.status]
  let statusColor = grayColor
  if (payout.status === 'PENDING' || payout.status === 'APPROVED') {
    statusColor = warningColor
  } else if (payout.status === 'PAID') {
    statusColor = successColor
  } else if (payout.status === 'CANCELLED') {
    statusColor = errorColor
  }

  pdf.setFillColor(statusColor.r, statusColor.g, statusColor.b)
  const badgeWidth = 30
  const badgeX = (pageWidth - badgeWidth) / 2
  pdf.roundedRect(badgeX, yPos - 3, badgeWidth, 6, 1, 1, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text(status.label, pageWidth / 2, yPos, { align: 'center' })

  yPos += 10

  // Divider line
  pdf.setDrawColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.setLineWidth(0.3)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // Payout ID and Date
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)

  pdf.text(`ID do Repasse:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`#${payout.id.slice(-8).toUpperCase()}`, margin + 28, yPos)
  yPos += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Data da Solicitação:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(formatDate(payout.createdAt), margin + 33, yPos)
  yPos += 5

  if (payout.scheduledFor && payout.status !== 'PAID') {
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    pdf.text(`Previsto Para:`, margin, yPos)
    pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
    pdf.setFont('helvetica', 'bold')
    pdf.text(formatDate(payout.scheduledFor), margin + 24, yPos)
    yPos += 5
  }

  if (payout.processedAt) {
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    pdf.text(`Processado Em:`, margin, yPos)
    pdf.setTextColor(successColor.r, successColor.g, successColor.b)
    pdf.setFont('helvetica', 'bold')
    pdf.text(formatDate(payout.processedAt), margin + 26, yPos)
    yPos += 5
  }

  yPos += 4

  // Event (if applicable)
  if (payout.event) {
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    pdf.text(`Evento:`, margin, yPos)
    pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
    pdf.setFont('helvetica', 'bold')
    let eventTitle = payout.event.title
    if (pdf.getTextWidth(eventTitle) > contentWidth - 15) {
      while (pdf.getTextWidth(eventTitle + '...') > contentWidth - 15 && eventTitle.length > 0) {
        eventTitle = eventTitle.slice(0, -1)
      }
      eventTitle += '...'
    }
    pdf.text(eventTitle, margin + 10, yPos)
    yPos += 6
  }

  // Organizer info
  yPos += 2
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Organizador:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(payout.user.name, margin + 21, yPos)
  yPos += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Email:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(payout.user.email, margin + 9, yPos)

  yPos += 8

  // Divider line
  pdf.setDrawColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.setLineWidth(0.3)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // Main amount card
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b)
  pdf.roundedRect(margin, yPos - 2, contentWidth, 18, 2, 2, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Valor Líquido a Receber', pageWidth / 2, yPos + 5, { align: 'center' })

  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(formatCurrency(payout.finalPayout), pageWidth / 2, yPos + 13, { align: 'center' })

  yPos += 24

  // Financial breakdown section
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.text('Composição do Valor', margin, yPos)
  yPos += 6

  // Helper function for row
  const drawRow = (label: string, value: string, isTotal = false, isNegative = false, isHighlight = false) => {
    if (isHighlight) {
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b)
      pdf.roundedRect(margin, yPos - 1, contentWidth, 7, 1, 1, 'F')
      pdf.setTextColor(255, 255, 255)
    } else {
      pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
    }

    pdf.setFontSize(9)
    pdf.setFont('helvetica', isTotal || isHighlight ? 'bold' : 'normal')
    pdf.text(label, margin + 2, yPos + 3)

    const valueColor = isNegative ? errorColor : isHighlight ? { r: 255, g: 255, b: 255 } : neutralColor
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b)
    pdf.text(value, pageWidth - margin - 2, yPos + 3, { align: 'right' })

    yPos += 8
  }

  drawRow('Vendas Brutas', formatCurrency(payout.totalSales))
  drawRow('(-) Taxas de Serviço', `-${formatCurrency(payout.totalFees)}`, false, true)
  drawRow('Subtotal (Vendas - Taxas)', formatCurrency(payout.netAmount), true)

  if (payout.anticipationAmount) {
    drawRow('(+) Antecipação Solicitada', formatCurrency(payout.anticipationAmount), false, false)
    if (payout.anticipationFee) {
      drawRow('(-) Taxa de Antecipação', `-${formatCurrency(payout.anticipationFee)}`, false, true)
    }
  }

  if (payout.bankTransferFee) {
    drawRow('(-) Taxa de Transferência Bancária', `-${formatCurrency(payout.bankTransferFee)}`, false, true)
  }

  yPos += 2
  drawRow('Valor Líquido a Receber', formatCurrency(payout.finalPayout), true, false, true)

  yPos += 6

  // Divider line
  pdf.setDrawColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.setLineWidth(0.3)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // Bank account info
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.text('Dados Bancários para Depósito', margin, yPos)
  yPos += 6

  if (payout.bankAccount) {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)

    const bankData = [
      ['Banco:', payout.bankAccount.bankName],
      ['Agência:', payout.bankAccount.agency],
      ['Conta:', `${payout.bankAccount.account} (${payout.bankAccount.accountType})`],
      ['Titular:', payout.bankAccount.accountHolder],
      ['CPF:', payout.bankAccount.cpf],
    ]

    for (const [label, value] of bankData) {
      pdf.text(label, margin, yPos)
      pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
      pdf.setFont('helvetica', 'bold')
      pdf.text(value, margin + 15, yPos)
      yPos += 5
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    }

    yPos += 3
    pdf.setFontSize(8)
    pdf.text(`Conta Padrão: ${payout.bankAccount.isDefault ? 'Sim' : 'Não'}  |  Verificada: ${payout.bankAccount.isVerified ? 'Sim' : 'Não'}`, margin, yPos)
  } else {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    pdf.text('Conta padrão do organizador. Entre em contato com o suporte para atualizar.', margin, yPos)
  }

  yPos = pageHeight - margin - 10

  // Footer
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} • Este documento serve como comprovante de repasse`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  )

  return pdf
}

/**
 * Download payout statement as PDF file
 * @param payout - Payout data
 */
export async function downloadPayoutPDF(payout: PayoutDetail): Promise<void> {
  try {
    const pdf = await generatePayoutPDF(payout)
    const eventSlug = payout.event?.id || 'todos'
    const filename = `repasse-${eventSlug}-${payout.id.slice(-8)}.pdf`
    pdf.save(filename)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Erro ao gerar PDF do repasse')
  }
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
