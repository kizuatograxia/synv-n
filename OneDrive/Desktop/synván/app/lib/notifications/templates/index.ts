/**
 * Email Templates
 *
 * This module contains template renderers for all transactional emails.
 * Templates return both HTML and plain text versions for compatibility.
 */

import {
  TicketConfirmationData,
  EventReminderData,
  PasswordResetData,
  OrderStatusUpdateData,
  RefundConfirmationData,
  TemplateRenderer,
} from '../types';

/**
 * Format currency amount in Brazilian Real
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Format date in Brazilian Portuguese
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Base email layout wrapper
 */
function wrapEmail(html: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simprão</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #5568d3; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .ticket-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #667eea; }
    .price { font-weight: bold; color: #667eea; }
  </style>
</head>
<body>
  <div class="container">
    ${html}
    <div class="footer">
      <p>Enviado por Simprão - Ingressos para eventos</p>
      <p>Se você não solicitou este email, pode ignorá-lo.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Ticket Confirmation Template
 */
export const ticketConfirmationTemplate: TemplateRenderer<TicketConfirmationData> = (data) => {
  const ticketsHtml = data.tickets
    .map(
      (ticket) => `
    <div class="ticket-info">
      <strong>${ticket.ticketName}</strong><br>
      Quantidade: ${ticket.quantity}<br>
      Preço unitário: <span class="price">${formatCurrency(ticket.unitPrice)}</span>
      ${ticket.qrCodeUrl ? `<br><img src="${ticket.qrCodeUrl}" alt="QR Code - ${ticket.ticketName}" style="max-width: 150px; margin-top: 10px; border: 2px solid #667eea; border-radius: 8px;">` : ''}
    </div>
  `
    )
    .join('');

  const html = wrapEmail(`
    <div class="header">
      <h1>🎉 Compra Confirmada!</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${data.recipientName}</strong>!</p>
      <p>Seus ingressos para <strong>${data.eventName}</strong> foram confirmados.</p>

      <h3>Detalhes do Evento</h3>
      <p><strong>📅 Data:</strong> ${formatDate(data.eventDate)}</p>
      <p><strong>📍 Local:</strong> ${data.eventLocation}</p>

      <h3>Ingressos e QR Codes</h3>
      <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
        Apresente o QR Code de cada ingresso no local do evento para check-in.
      </p>
      ${ticketsHtml}

      <p><strong>Total pago:</strong> <span class="price">${formatCurrency(data.totalAmount)}</span></p>
      <p><strong>Pagamento:</strong> ${data.paymentMethod}</p>
      <p><strong>Pedido:</strong> ${data.orderId}</p>

      <div style="text-align: center;">
        <a href="${data.orderUrl}" class="button">Ver Meus Ingressos</a>
      </div>

      <p style="font-size: 12px; color: #666;">
        Você receberá este email como confirmação da sua compra.
        Guarde-o para referência futura.
      </p>
    </div>
  `);

  const text = `
Compra Confirmada!

Olá, ${data.recipientName}!

Seus ingressos para ${data.eventName} foram confirmados.

Detalhes do Evento
Data: ${formatDate(data.eventDate)}
Local: ${data.eventLocation}

Ingressos:
${data.tickets.map((t) => `- ${t.ticketName} x${t.quantity}: ${formatCurrency(t.unitPrice)}`).join('\n')}

Total pago: ${formatCurrency(data.totalAmount)}
Pagamento: ${data.paymentMethod}
Pedido: ${data.orderId}

Acesse seus ingressos: ${data.orderUrl}
  `.trim();

  return { html, text };
};

/**
 * Event Reminder Template
 */
export const eventReminderTemplate: TemplateRenderer<EventReminderData> = (data) => {
  const html = wrapEmail(`
    <div class="header">
      <h1>📅 Lembrete de Evento</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${data.recipientName}</strong>!</p>
      <p>O evento <strong>${data.eventName}</strong> acontecerá em breve!</p>

      <h3>Detalhes do Evento</h3>
      <div class="ticket-info">
        <p><strong>📅 Data:</strong> ${formatDate(data.eventDate)}</p>
        <p><strong>📍 Local:</strong> ${data.eventLocation}</p>
        <p><strong>🎟️ Ingressos:</strong> ${data.ticketCount}</p>
      </div>

      <div style="text-align: center;">
        <a href="${data.eventUrl}" class="button">Ver Detalhes do Evento</a>
      </div>

      ${
        data.calendarInviteUrl
          ? `
        <div style="text-align: center;">
          <a href="${data.calendarInviteUrl}" class="button" style="background: #48bb78;">Adicionar ao Calendário</a>
        </div>
      `
          : ''
      }

      <p style="font-size: 12px; color: #666;">
        Não se esqueça de levar seus ingressos!
        Apresente o QR Code no local do evento para check-in.
      </p>
    </div>
  `);

  const text = `
Lembrete de Evento

Olá, ${data.recipientName}!

O evento ${data.eventName} acontecerá em breve!

Detalhes do Evento
Data: ${formatDate(data.eventDate)}
Local: ${data.eventLocation}
Ingressos: ${data.ticketCount}

Acesse: ${data.eventUrl}
${data.calendarInviteUrl ? `Adicionar ao calendário: ${data.calendarInviteUrl}` : ''}
  `.trim();

  return { html, text };
};

/**
 * Password Reset Template
 */
export const passwordResetTemplate: TemplateRenderer<PasswordResetData> = (data) => {
  const html = wrapEmail(`
    <div class="header">
      <h1>🔐 Redefinição de Senha</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${data.recipientName}</strong>!</p>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>

      <p style="color: #e53e3e; font-weight: bold;">
        Se você não solicitou esta redefinição, ignore este email.
      </p>

      <p>Para redefinir sua senha, clique no botão abaixo:</p>

      <div style="text-align: center;">
        <a href="${data.resetLink}" class="button">Redefinir Senha</a>
      </div>

      <p style="font-size: 12px; color: #666;">
        Este link expirará em ${data.expiryHours} horas.
      </p>

      <p style="font-size: 12px; color: #666;">
        Ou copie e cole este link no seu navegador:<br>
        <span style="word-break: break-all; color: #667eea;">${data.resetLink}</span>
      </p>
    </div>
  `);

  const text = `
Redefinição de Senha

Olá, ${data.recipientName}!

Recebemos uma solicitação para redefinir sua senha.

Se você não solicitou esta redefinição, ignore este email.

Para redefinir sua senha, acesse:
${data.resetLink}

Este link expirará em ${data.expiryHours} horas.
  `.trim();

  return { html, text };
};

/**
 * Order Status Update Template
 */
export const orderStatusUpdateTemplate: TemplateRenderer<OrderStatusUpdateData> = (data) => {
  const html = wrapEmail(`
    <div class="header">
      <h1>📦 Atualização de Pedido</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${data.recipientName}</strong>!</p>
      <p>Há uma atualização no seu pedido para <strong>${data.eventName}</strong>.</p>

      <div class="ticket-info">
        <p><strong>Status anterior:</strong> ${data.oldStatus}</p>
        <p><strong>Novo status:</strong> ${data.newStatus}</p>
        <p><strong>Pedido:</strong> ${data.orderId}</p>
      </div>

      <div style="text-align: center;">
        <a href="${data.orderUrl}" class="button">Ver Detalhes do Pedido</a>
      </div>
    </div>
  `);

  const text = `
Atualização de Pedido

Olá, ${data.recipientName}!

Há uma atualização no seu pedido para ${data.eventName}.

Status anterior: ${data.oldStatus}
Novo status: ${data.newStatus}
Pedido: ${data.orderId}

Acesse: ${data.orderUrl}
  `.trim();

  return { html, text };
};

/**
 * Refund Confirmation Template
 */
export const refundConfirmationTemplate: TemplateRenderer<RefundConfirmationData> = (data) => {
  const html = wrapEmail(`
    <div class="header">
      <h1>💰 Reembolso Confirmado</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${data.recipientName}</strong>!</p>
      <p>Seu reembolso para <strong>${data.eventName}</strong> foi confirmado.</p>

      <div class="ticket-info">
        <p><strong>Valor do reembolso:</strong> <span class="price">${formatCurrency(data.refundAmount)}</span></p>
        <p><strong>Pedido:</strong> ${data.orderId}</p>
        ${
          data.refundReason
            ? `<p><strong>Motivo:</strong> ${data.refundReason}</p>`
            : ''
        }
      </div>

      <p>O valor será creditado em sua conta em até <strong>${data.estimatedDepositDays} dias úteis</strong>.</p>
      <p style="font-size: 12px; color: #666;">
        O prazo pode variar dependendo da sua instituição financeira.
      </p>
    </div>
  `);

  const text = `
Reembolso Confirmado

Olá, ${data.recipientName}!

Seu reembolso para ${data.eventName} foi confirmado.

Valor do reembolso: ${formatCurrency(data.refundAmount)}
Pedido: ${data.orderId}
${data.refundReason ? `Motivo: ${data.refundReason}` : ''}

O valor será creditado em sua conta em até ${data.estimatedDepositDays} dias úteis.
O prazo pode variar dependendo da sua instituição financeira.
  `.trim();

  return { html, text };
};

/**
 * Template registry
 */
export const templates = {
  ticketConfirmation: ticketConfirmationTemplate,
  eventReminder: eventReminderTemplate,
  passwordReset: passwordResetTemplate,
  orderStatusUpdate: orderStatusUpdateTemplate,
  refundConfirmation: refundConfirmationTemplate,
};
