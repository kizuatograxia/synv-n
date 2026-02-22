import { NextRequest, NextResponse } from 'next/server';
import { FeeEngine } from '@/lib/fees/fee-engine';

/**
 * POST /api/fees/preview
 *
 * Calculate fees for preview at checkout without creating an order.
 * This endpoint ensures client-side fee display matches server-side calculation.
 *
 * Note: This endpoint does not require authentication to allow fee preview before login.
 *
 * Request body:
 * {
 *   eventId: string
 *   ticketPrice: number
 *   quantity: number
 *   feeAllocation: 'BUYER' | 'ORGANIZER'
 *   discount?: number
 * }
 *
 * Response:
 * {
 *   subtotal: number
 *   serviceFee: number
 *   processingFee: number
 *   totalFee: number
 *   discount: number
 *   total: number
 *   buyerPays: number
 *   organizerReceives: number
 *   breakdown: {
 *     ticketPrice: number
 *     serviceFee: number
 *     processingFee: number
 *     minimumFeeApplied: boolean
 *     totalFee: number
 *     feeAllocation: string
 *     buyerPays: number
 *     organizerReceives: number
 *   }
 * */
export async function POST(request: NextRequest) {
  try {
    // No authentication required - this is just for fee preview
    // Authentication happens at order creation time

    const body = await request.json();
    const {
      eventId,
      ticketPrice,
      quantity = 1,
      feeAllocation = 'BUYER',
      discount = 0,
    } = body;

    // Validate required fields
    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }

    if (typeof ticketPrice !== 'number' || ticketPrice < 0) {
      return NextResponse.json(
        { error: 'Invalid ticketPrice' },
        { status: 400 }
      );
    }

    if (typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    if (!['BUYER', 'ORGANIZER'].includes(feeAllocation)) {
      return NextResponse.json(
        { error: 'Invalid feeAllocation' },
        { status: 400 }
      );
    }

    // Fetch event data to get productType, eventRevenue, and organizer state
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const eventResponse = await fetch(`${baseUrl}/api/events/${eventId}`, {
      cache: 'no-store',
    });

    if (!eventResponse.ok) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const eventData = await eventResponse.json();
    const event = eventData.event;

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get event properties needed for fee calculation
    const productType = event.productType || 'STANDARD';
    const eventRevenue = event.revenue || 0;
    const organizerState = event.organizer?.state || event.organizerState;

    // Calculate subtotal
    const subtotal = ticketPrice * quantity;

    // Calculate fees using FeeEngine
    const feeBreakdown = FeeEngine.calculateFeesWithAllocation(
      ticketPrice,
      productType,
      feeAllocation,
      eventRevenue,
      organizerState
    );

    // Calculate discount
    const discountedSubtotal = Math.max(0, subtotal - discount);

    // Recalculate fees on discounted amount
    const discountedFeeBreakdown = FeeEngine.calculateFeesWithAllocation(
      ticketPrice,
      productType,
      feeAllocation,
      eventRevenue,
      organizerState
    );

    // Apply discount to fees proportionally
    const discountRatio = discountedSubtotal / subtotal;
    const serviceFeeAfterDiscount = Math.round(
      (discountedFeeBreakdown.serviceFee * discountRatio + Number.EPSILON) * 100
    ) / 100;
    const processingFeeAfterDiscount = Math.round(
      (discountedFeeBreakdown.processingFee * discountRatio + Number.EPSILON) * 100
    ) / 100;
    const totalFeeAfterDiscount = Math.round(
      (serviceFeeAfterDiscount + processingFeeAfterDiscount + Number.EPSILON) * 100
    ) / 100;

    // Calculate total based on fee allocation
    let total: number;
    let buyerPays: number;
    let organizerReceives: number;

    if (feeAllocation === 'BUYER') {
      // Buyer pays subtotal + all fees - discount
      total = Math.round((discountedSubtotal + totalFeeAfterDiscount + Number.EPSILON) * 100) / 100;
      buyerPays = total;
      organizerReceives = Math.round((total - processingFeeAfterDiscount + Number.EPSILON) * 100) / 100;
    } else {
      // Organizer pays service fee, buyer pays processing fee
      buyerPays = Math.round((discountedSubtotal + processingFeeAfterDiscount + Number.EPSILON) * 100) / 100;
      total = buyerPays;
      organizerReceives = Math.round((discountedSubtotal - serviceFeeAfterDiscount + Number.EPSILON) * 100) / 100;
    }

    return NextResponse.json({
      subtotal,
      serviceFee: serviceFeeAfterDiscount,
      processingFee: processingFeeAfterDiscount,
      totalFee: totalFeeAfterDiscount,
      discount,
      total,
      buyerPays,
      organizerReceives,
      breakdown: {
        ticketPrice,
        serviceFee: serviceFeeAfterDiscount,
        processingFee: processingFeeAfterDiscount,
        minimumFeeApplied: ticketPrice <= 39.90,
        totalFee: totalFeeAfterDiscount,
        feeAllocation,
        buyerPays,
        organizerReceives,
      },
    });
  } catch (error) {
    console.error('Error calculating fee preview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
