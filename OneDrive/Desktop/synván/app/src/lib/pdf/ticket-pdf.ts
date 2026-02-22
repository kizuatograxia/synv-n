import { jsPDF } from 'jspdf'

export interface TicketData {
  ticketCode: string
  ticketType: string
  lotName: string
  price: number
  qrCodeDataUrl: string
  isUsed: boolean
}

export interface EventData {
  title: string
  startTime: string
  endTime?: string
  location?: string
  address?: string
  city?: string
  state?: string
  imageUrl?: string
}

export interface OrderData {
  id: string
  createdAt: string
}

/**
 * Generate a professional PDF ticket for download
 * @param ticket - Ticket data including QR code
 * @param event - Event details
 * @param order - Order information
 * @returns jsPDF instance ready to save
 */
export async function generateTicketPDF(
  ticket: TicketData,
  event: EventData,
  order: OrderData
): Promise<jsPDF> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [88, 140], // Standard ticket size (like a boarding pass)
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 6
  const contentWidth = pageWidth - 2 * margin

  // Colors (matching design system)
  const primaryColor = { r: 37, g: 99, b: 235 } // blue-600
  const neutralColor = { r: 23, g: 23, b: 23 } // neutral-950
  const grayColor = { r: 107, g: 114, b: 128 } // neutral-500
  const successColor = { r: 34, g: 197, b: 94 } // green-500
  const errorColor = { r: 239, g: 68, b: 68 } // red-500
  const bgColor = { r: 249, g: 250, b: 251 } // neutral-50

  // Set background
  pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')

  let yPos = margin

  // Header with brand color accent
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b)
  pdf.rect(0, 0, pageWidth, 8, 'F')

  // "BILETO" brand text
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text('BILETO', pageWidth / 2, 5, { align: 'center' })

  yPos = 14

  // Event title (truncated if too long)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)

  const maxTitleWidth = contentWidth
  let eventTitle = event.title
  if (pdf.getTextWidth(eventTitle) > maxTitleWidth) {
    // Simple truncation
    while (pdf.getTextWidth(eventTitle + '...') > maxTitleWidth && eventTitle.length > 0) {
      eventTitle = eventTitle.slice(0, -1)
    }
    eventTitle += '...'
  }
  pdf.text(eventTitle, pageWidth / 2, yPos, { align: 'center' })

  yPos += 6

  // Date and time
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
    return date.toLocaleDateString('pt-BR', options)
  }

  const dateStr = formatEventDate(event.startTime)
  pdf.text(dateStr, pageWidth / 2, yPos, { align: 'center' })

  yPos += 5

  // Location (if available)
  if (event.location || event.address) {
    const locationParts = [event.location, event.address, event.city, event.state].filter(Boolean)
    if (locationParts.length > 0) {
      const location = locationParts.join(', ')
      let locationText = location
      const maxLocationWidth = contentWidth

      if (pdf.getTextWidth(locationText) > maxLocationWidth) {
        while (pdf.getTextWidth(locationText + '...') > maxLocationWidth && locationText.length > 0) {
          locationText = locationText.slice(0, -1)
        }
        locationText += '...'
      }

      pdf.text(locationText, pageWidth / 2, yPos, { align: 'center' })
      yPos += 5
    }
  }

  // Divider line
  yPos += 2
  pdf.setDrawColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.setLineWidth(0.2)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // Ticket details section
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')

  // Order ID
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Pedido:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`#${order.id.slice(-8).toUpperCase()}`, margin + 12, yPos)
  yPos += 4

  // Ticket code
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Código:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(ticket.ticketCode, margin + 11, yPos)
  yPos += 4

  // Ticket type
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Tipo:`, margin, yPos)
  pdf.setTextColor(neutralColor.r, neutralColor.g, neutralColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${ticket.ticketType} - ${ticket.lotName}`, margin + 8, yPos)
  yPos += 4

  // Price
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(`Valor:`, margin, yPos)
  pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b)
  pdf.setFont('helvetica', 'bold')
  pdf.text(formatCurrency(ticket.price), margin + 9, yPos)

  // Status badge (right side)
  const statusText = ticket.isUsed ? 'UTILIZADO' : 'VÁLIDO'
  const statusColor = ticket.isUsed ? errorColor : successColor

  pdf.setFontSize(6)
  pdf.setFillColor(statusColor.r, statusColor.g, statusColor.b)
  pdf.roundedRect(pageWidth - margin - 16, yPos - 2, 16, 4, 1, 1, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.text(statusText, pageWidth - margin - 8, yPos + 0.5, { align: 'center' })

  yPos += 7

  // Divider line before QR code
  pdf.setDrawColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.setLineWidth(0.2)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // QR Code section
  const qrSize = 35
  const qrX = (pageWidth - qrSize) / 2

  // QR Code border/background
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(qrX - 2, yPos - 2, qrSize + 4, qrSize + 4, 2, 2, 'F')
  pdf.setDrawColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(qrX - 2, yPos - 2, qrSize + 4, qrSize + 4, 2, 2, 'S')

  // Add QR Code image
  try {
    pdf.addImage(ticket.qrCodeDataUrl, 'PNG', qrX, yPos, qrSize, qrSize)
  } catch (error) {
    // Fallback if QR code image fails
    pdf.setFontSize(6)
    pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
    pdf.text('QR Code', pageWidth / 2, yPos + qrSize / 2, { align: 'center' })
  }

  yPos += qrSize + 5

  // Instructions
  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text('Apresente este QR Code no local do evento', pageWidth / 2, yPos, { align: 'center' })

  // Footer
  yPos = pageHeight - margin - 2
  pdf.setFontSize(5)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(grayColor.r, grayColor.g, grayColor.b)
  pdf.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  )

  return pdf
}

/**
 * Download ticket as PDF file
 * @param ticket - Ticket data
 * @param event - Event details
 * @param order - Order information
 */
export async function downloadTicketPDF(
  ticket: TicketData,
  event: EventData,
  order: OrderData
): Promise<void> {
  try {
    const pdf = await generateTicketPDF(ticket, event, order)
    const filename = `ingresso-${ticket.ticketCode}-${order.id.slice(-8)}.pdf`
    pdf.save(filename)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Erro ao gerar PDF do ingresso')
  }
}
