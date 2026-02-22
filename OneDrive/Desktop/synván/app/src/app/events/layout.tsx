import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Eventos - Simprão',
  description: 'Descubra e compre ingressos para os melhores eventos: shows, palestras, workshops, cursos, teatro, comédia e muito mais.',
  openGraph: {
    title: 'Eventos - Simprão',
    description: 'Descubra e compre ingressos para os melhores eventos: shows, palestras, workshops, cursos e muito mais.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://simprao.com.br/events',
    siteName: 'Simprão',
  },
  alternates: {
    canonical: 'https://simprao.com.br/events',
  },
}

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
