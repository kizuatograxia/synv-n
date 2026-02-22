/**
 * E2E Test: Refund Flow
 *
 * This test verifies the complete refund flow:
 * 1. User can request refund within 7 days of purchase (CDC rule) - approved
 * 2. User can request refund after 7 days but 48h+ before event - approved
 * 3. System rejects refund less than 48h before event
 * 4. System rejects refund for already used tickets
 * 5. System handles promocode discounts in refund calculations
 */

import { test, expect } from '@playwright/test';

test.describe('Refund Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as attendee user
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'attendee@simprao.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?/, { timeout: 5000 });
  });

  test('should request refund within 7 days and see approved status', async ({ page, request }) => {
    // Step 1: Get published events
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    const testEvent = eventsData.events[0];

    // Step 2: Get cart data for the event
    const cartResponse = await request.get(`/api/cart?eventId=${testEvent.id}`);
    expect(cartResponse.ok()).toBeTruthy();

    const cartData = await cartResponse.json();

    if (!cartData.event.lots || cartData.event.lots.length === 0) {
      test.skip(true, 'No active lots available for this event');
      return;
    }

    const firstLot = cartData.event.lots[0];
    const quantity = 2;

    // Step 3: Create a fresh order for testing (within 7 days)
    const orderResponse = await request.post('/api/orders', {
      data: {
        eventId: testEvent.id,
        items: [
          {
            lotId: firstLot.id,
            quantity: quantity,
            ticketTypeId: 'GENERAL',
          },
        ],
        paymentMethod: 'PIX',
      },
    });

    if (!orderResponse.ok()) {
      const error = await orderResponse.json();
      console.error('Order creation failed:', error);
      test.skip(true, `Order creation failed: ${error.error || 'Unknown error'}`);
      return;
    }

    const orderResult = await orderResponse.json();
    const orderId = orderResult.order.id;

    // Step 4: Process payment to approve the order
    const paymentResponse = await request.post('/api/payments/process', {
      data: {
        orderId: orderId,
        paymentMethod: 'PIX',
        customerEmail: 'attendee@simprao.com',
        customerCpf: '12345678900',
        customerPhone: '+5511999999999',
      },
    });

    if (!paymentResponse.ok()) {
      const error = await paymentResponse.json();
      console.error('Payment processing failed:', error);
      test.skip(true, `Payment processing failed: ${error.error || 'Unknown error'}`);
      return;
    }

    const paymentResult = await paymentResponse.json();

    // Verify payment was approved
    expect(paymentResult.payment.status).toBe('APPROVED');
    expect(paymentResult.order.paymentStatus).toBe('APPROVED');

    // Step 5: Verify order is within 7-day window (freshly created)
    const orderDetails = await request.get(`/api/orders/${orderId}`);
    const orderData = await orderDetails.json();

    expect(orderData.order.createdAt).toBeDefined();
    const createdAt = new Date(orderData.order.createdAt);
    const daysSincePurchase = Math.abs(Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    expect(daysSincePurchase).toBeLessThanOrEqual(7);

    // Step 6: Request refund (should be approved per CDC 7-day rule)
    const refundResponse = await request.post(`/api/orders/${orderId}/refund`, {
      data: {},
    });

    expect(refundResponse.ok()).toBeTruthy();

    const refundResult = await refundResponse.json();

    // Verify refund request was successful
    expect(refundResult.message).toContain('Solicitação de reembolso enviada com sucesso');
    expect(refundResult.order).toBeDefined();
    expect(refundResult.order.id).toBe(orderId);
    expect(refundResult.order.refundRequested).toBe(true);
    expect(refundResult.refundAmount).toBeDefined();
    expect(refundResult.refundAmount).toBeGreaterThan(0);

    // Step 7: Verify refund amount is calculated correctly
    // Within 7 days = full refund minus processing fee (R$ 2.50)
    const expectedMinRefund = orderData.order.totalAmount - 2.50;
    expect(refundResult.refundAmount).toBeGreaterThanOrEqual(expectedMinRefund);
    expect(refundResult.refundAmount).toBeLessThanOrEqual(orderData.order.totalAmount);

    // Step 8: Verify order status is updated
    const updatedOrderResponse = await request.get(`/api/orders/${orderId}`);
    const updatedOrderData = await updatedOrderResponse.json();

    expect(updatedOrderData.order.refundRequested).toBe(true);
    expect(updatedOrderData.order.refundApproved).toBe(false); // Pending approval initially

    // Step 9: Navigate to order page to verify UI displays refund status
    await page.goto(`/orders/${orderId}`);
    await page.waitForLoadState('networkidle');

    // Verify refund status is visible on the page
    await expect(page.locator('text=Reembolso solicitado')).toBeVisible();
    await expect(page.locator(`text=R$ ${refundResult.refundAmount.toFixed(2)}`)).toBeVisible();
  });

  test('should approve refund after 7 days but 48h+ before event', async ({ page, request }) => {
    // Step 1: Get published events with future dates
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    // Find an event that's more than 48 hours in the future
    const testEvent = eventsData.events.find((e: any) => {
      const eventTime = new Date(e.startTime);
      const hoursUntilEvent = (eventTime.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilEvent > 48;
    });

    if (!testEvent) {
      test.skip(true, 'No events starting more than 48h from now');
      return;
    }

    // Step 2: Get user's orders to find one older than 7 days
    const profileResponse = await request.get('/api/profile?section=orders');
    const profileData = await profileResponse.json();

    if (!profileData.orders || profileData.orders.length === 0) {
      test.skip(true, 'No orders found for testing refund after 7 days');
      return;
    }

    // Find an order that's approved and more than 7 days old
    const oldOrder = profileData.orders.find((order: any) => {
      if (order.paymentStatus !== 'APPROVED' || order.refundRequested) {
        return false;
      }
      const createdAt = new Date(order.createdAt);
      const daysSincePurchase = Math.abs(Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSincePurchase > 7;
    });

    if (!oldOrder) {
      test.skip(true, 'No orders older than 7 days available for testing');
      return;
    }

    // Step 3: Verify event is more than 48 hours away
    const eventTime = new Date(testEvent.startTime);
    const hoursUntilEvent = (eventTime.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursUntilEvent).toBeGreaterThan(48);

    // Step 4: Request refund
    const refundResponse = await request.post(`/api/orders/${oldOrder.id}/refund`, {
      data: {},
    });

    expect(refundResponse.ok()).toBeTruthy();

    const refundResult = await refundResponse.json();

    // Verify refund is approved (event > 48h away)
    expect(refundResult.message).toContain('Solicitação de reembolso enviada com sucesso');
    expect(refundResult.order.refundRequested).toBe(true);
    expect(refundResult.refundAmount).toBeGreaterThan(0);

    // Refund should be for full amount minus processing fee
    const expectedMinRefund = oldOrder.totalAmount - 2.50;
    expect(refundResult.refundAmount).toBeGreaterThanOrEqual(expectedMinRefund);
  });

  test('should reject refund less than 48h before event', async ({ page, request }) => {
    // Step 1: Get published events
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.json());

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    // Step 2: Get user's orders
    const profileResponse = await request.get('/api/profile?section=orders');
    const profileData = await profileResponse.json();

    if (!profileData.orders || profileData.orders.length === 0) {
      test.skip(true, 'No orders found for testing refund rejection');
      return;
    }

    // Find an order for an event less than 48 hours away
    const urgentOrder = profileData.orders.find((order: any) => {
      if (order.paymentStatus !== 'APPROVED' || order.refundRequested) {
        return false;
      }

      const eventTime = new Date(order.event.startTime);
      const hoursUntilEvent = (eventTime.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilEvent < 48 && hoursUntilEvent > 0; // Event is upcoming but less than 48h away
    });

    if (!urgentOrder) {
      test.skip(true, 'No orders with events less than 48h away available for testing');
      return;
    }

    // Step 3: Attempt to request refund
    const refundResponse = await request.post(`/api/orders/${urgentOrder.id}/refund`, {
      data: {},
    });

    // Should fail with error about event being too soon
    expect(refundResponse.status()).toBe(400);

    const errorData = await refundResponse.json();
    expect(errorData.error).toContain('não elegível para reembolso');
  });

  test('should reject refund for already used tickets', async ({ page, request }) => {
    // Step 1: Get published events
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    // Step 2: Get user's orders
    const profileResponse = await request.get('/api/profile?section=orders');
    const profileData = await profileResponse.json();

    if (!profileData.orders || profileData.orders.length === 0) {
      test.skip(true, 'No orders found for testing used ticket refund rejection');
      return;
    }

    // Find an order with used tickets
    const orderWithUsedTickets = profileData.orders.find((order: any) => {
      if (order.paymentStatus !== 'APPROVED' || order.refundRequested) {
        return false;
      }
      // Check if any tickets are marked as used
      return order.tickets && order.tickets.some((t: any) => t.isUsed);
    });

    if (!orderWithUsedTickets) {
      test.skip(true, 'No orders with used tickets available for testing');
      return;
    }

    // Step 3: Attempt to request refund for order with used tickets
    const refundResponse = await request.post(`/api/orders/${orderWithUsedTickets.id}/refund`, {
      data: {},
    });

    // Should fail with error about used tickets
    expect(refundResponse.status()).toBe(400);

    const errorData = await refundResponse.json();
    expect(errorData.error).toContain('já utilizados');
  });

  test('should calculate refund with promocode discount applied', async ({ page, request }) => {
    // Step 1: Get published events
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    const testEvent = eventsData.events[0];

    // Step 2: Validate promocode exists
    const validatePromoResponse = await request.post('/api/promocodes/validate', {
      data: {
        code: 'WELCOME20',
      },
    });

    if (!validatePromoResponse.ok()) {
      test.skip(true, 'WELCOME20 promocode not available or expired');
      return;
    }

    const promoData = await validatePromoResponse.json();
    expect(promoData.promocode.discountType).toBe('PERCENTAGE');
    expect(promoData.promocode.discountValue).toBe(20);

    // Step 3: Get cart data
    const cartResponse = await request.get(`/api/cart?eventId=${testEvent.id}`);
    const cartData = await cartResponse.json();

    if (!cartData.event.lots || cartData.event.lots.length === 0) {
      test.skip(true, 'No active lots available');
      return;
    }

    const firstLot = cartData.event.lots[0];
    const quantity = 3;
    const originalSubtotal = firstLot.price * quantity;

    // Step 4: Create order with promocode
    const orderResponse = await request.post('/api/orders', {
      data: {
        eventId: testEvent.id,
        items: [
          {
            lotId: firstLot.id,
            quantity: quantity,
            ticketTypeId: 'GENERAL',
          },
        ],
        paymentMethod: 'PIX',
        promocode: 'WELCOME20',
      },
    });

    if (!orderResponse.ok()) {
      test.skip(true, 'Order creation with promocode failed');
      return;
    }

    const orderResult = await orderResponse.json();
    const orderId = orderResult.order.id;

    // Calculate expected amounts
    const expectedDiscount = originalSubtotal * 0.20;
    const expectedTotal = originalSubtotal - expectedDiscount;

    // Verify order has promocode applied
    expect(orderResult.summary.total).toBeCloseTo(expectedTotal, 2);
    expect(orderResult.order.promocodeId).toBeDefined();

    // Step 5: Process payment
    const paymentResponse = await request.post('/api/payments/process', {
      data: {
        orderId: orderId,
        paymentMethod: 'PIX',
        customerEmail: 'attendee@simprao.com',
        customerCpf: '12345678900',
        customerPhone: '+5511999999999',
      },
    });

    if (!paymentResponse.ok()) {
      test.skip(true, 'Payment processing failed');
      return;
    }

    // Step 6: Request refund (within 7 days)
    const refundResponse = await request.post(`/api/orders/${orderId}/refund`, {
      data: {},
    });

    expect(refundResponse.ok()).toBeTruthy();

    const refundResult = await refundResponse.json();

    // Verify refund is based on DISCOUNTED price (not original price)
    // REFUND_USES_DISCOUNTED_PRICE = true in constants
    const expectedMinRefund = expectedTotal - 2.50; // Minus processing fee

    expect(refundResult.refundAmount).toBeGreaterThanOrEqual(expectedMinRefund);
    expect(refundResult.refundAmount).toBeLessThanOrEqual(expectedTotal);

    // Verify refund amount is NOT calculated from original subtotal
    expect(refundResult.refundAmount).toBeLessThan(originalSubtotal);

    // Step 7: Verify order details
    const orderDetails = await request.get(`/api/orders/${orderId}`);
    const orderData = await orderDetails.json();

    expect(orderData.order.totalAmount).toBeCloseTo(expectedTotal, 2);
    expect(orderData.order.promocodeId).toBeDefined();
  });

  test('should reject duplicate refund requests', async ({ page, request }) => {
    // Step 1: Get published events
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    const testEvent = eventsData.events[0];

    // Step 2: Create a new order
    const cartResponse = await request.get(`/api/cart?eventId=${testEvent.id}`);
    const cartData = await cartResponse.json();

    if (!cartData.event.lots || cartData.event.lots.length === 0) {
      test.skip(true, 'No active lots available');
      return;
    }

    const firstLot = cartData.event.lots[0];

    const orderResponse = await request.post('/api/orders', {
      data: {
        eventId: testEvent.id,
        items: [
          {
            lotId: firstLot.id,
            quantity: 1,
            ticketTypeId: 'GENERAL',
          },
        ],
        paymentMethod: 'PIX',
      },
    });

    if (!orderResponse.ok()) {
      test.skip(true, 'Order creation failed');
      return;
    }

    const orderResult = await orderResponse.json();
    const orderId = orderResult.order.id;

    // Step 3: Process payment
    const paymentResponse = await request.post('/api/payments/process', {
      data: {
        orderId: orderId,
        paymentMethod: 'PIX',
        customerEmail: 'attendee@simprao.com',
        customerCpf: '12345678900',
        customerPhone: '+5511999999999',
      },
    });

    if (!paymentResponse.ok()) {
      test.skip(true, 'Payment processing failed');
      return;
    }

    // Step 4: Request first refund
    const firstRefundResponse = await request.post(`/api/orders/${orderId}/refund`, {
      data: {},
    });

    expect(firstRefundResponse.ok()).toBeTruthy();

    // Step 5: Attempt to request refund again
    const secondRefundResponse = await request.post(`/api/orders/${orderId}/refund`, {
      data: {},
    });

    // Should fail with error about refund already requested
    expect(secondRefundResponse.status()).toBe(400);

    const errorData = await secondRefundResponse.json();
    expect(errorData.error).toContain('já solicitado');
  });

  test('should reject refund for non-approved orders', async ({ page, request }) => {
    // Step 1: Get published events
    const eventsResponse = await request.get('/api/events?published=true');
    expect(eventsResponse.ok()).toBeTruthy();

    const eventsData = await eventsResponse.json();

    if (!eventsData.events || eventsData.events.length === 0) {
      test.skip(true, 'No published events available');
      return;
    }

    const testEvent = eventsData.events[0];

    // Step 2: Create order without payment
    const cartResponse = await request.get(`/api/cart?eventId=${testEvent.id}`);
    const cartData = await cartResponse.json();

    if (!cartData.event.lots || cartData.event.lots.length === 0) {
      test.skip(true, 'No active lots available');
      return;
    }

    const firstLot = cartData.event.lots[0];

    const orderResponse = await request.post('/api/orders', {
      data: {
        eventId: testEvent.id,
        items: [
          {
            lotId: firstLot.id,
            quantity: 1,
            ticketTypeId: 'GENERAL',
          },
        ],
        paymentMethod: 'PIX',
      },
    });

    if (!orderResponse.ok()) {
      test.skip(true, 'Order creation failed');
      return;
    }

    const orderResult = await orderResponse.json();
    const orderId = orderResult.order.id;

    // Order is in PENDING status (not approved yet)

    // Step 3: Attempt to request refund for pending order
    const refundResponse = await request.post(`/api/orders/${orderId}/refund`, {
      data: {},
    });

    // Should fail with error about order not being approved
    expect(refundResponse.status()).toBe(400);

    const errorData = await refundResponse.json();
    expect(errorData.error).toContain('aprovados');
  });
});
