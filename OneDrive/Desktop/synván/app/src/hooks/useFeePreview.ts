import useSWR from 'swr';

export interface FeePreviewRequest {
  eventId: string;
  ticketPrice: number;
  quantity: number;
  feeAllocation?: 'BUYER' | 'ORGANIZER';
  discount?: number;
}

export interface FeePreviewResponse {
  subtotal: number;
  serviceFee: number;
  processingFee: number;
  totalFee: number;
  discount: number;
  total: number;
  buyerPays: number;
  organizerReceives: number;
  breakdown: {
    ticketPrice: number;
    serviceFee: number;
    processingFee: number;
    minimumFeeApplied: boolean;
    totalFee: number;
    feeAllocation: string;
    buyerPays: number;
    organizerReceives: number;
  };
}

const fetcher = async (url: string, body: FeePreviewRequest): Promise<FeePreviewResponse> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to calculate fees');
  }

  return response.json();
};

export function useFeePreview(request: FeePreviewRequest | null) {
  const shouldFetch = request !== null && request.eventId && request.ticketPrice >= 0;

  const { data, error, isLoading, mutate } = useSWR<FeePreviewResponse>(
    shouldFetch ? ['/api/fees/preview', request] : null,
    ([url, req]) => fetcher(url as string, req as FeePreviewRequest),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    feeBreakdown: data,
    isLoading,
    isError: error,
    mutate,
  };
}
