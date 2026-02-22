'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TicketTypeDistributionChart } from '@/components/charts/ticket-type-distribution-chart'
import { PaymentMethodsChart } from '@/components/charts/payment-methods-chart'

interface DemographicsCardsProps {
  ticketTypeData: Array<{ name: string; value: number }>
  paymentMethodData: Array<{ name: string; value: number }>
  colors: string[]
}

export function DemographicsCards({ ticketTypeData, paymentMethodData, colors }: DemographicsCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ticket Types Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-display">Distribuição por Tipo de Ingresso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {ticketTypeData.length > 0 ? (
              <TicketTypeDistributionChart data={ticketTypeData} colors={colors} />
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-display">Métodos de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {paymentMethodData.length > 0 ? (
              <PaymentMethodsChart data={paymentMethodData} colors={colors} />
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
