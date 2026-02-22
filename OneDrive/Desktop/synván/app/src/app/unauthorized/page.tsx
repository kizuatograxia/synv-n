import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ErrorWrapper } from '@/components/error-wrapper'
import { ShieldX } from 'lucide-react'
import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <ErrorWrapper>
      <div className="min-h-screen flex flex-col bg-neutral-50">
        <Header />

        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200/60 shadow-elevated p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-error-50 flex items-center justify-center mb-6">
              <ShieldX className="h-8 w-8 text-error-500" />
            </div>
            <h2 className="text-2xl font-display font-bold text-neutral-900 mb-2">
              Acesso Não Autorizado
            </h2>
            <p className="text-neutral-600 mb-8">
              Você não tem permissão para acessar esta página.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-2.5 gradient-primary text-white rounded-xl font-semibold hover:shadow-glow transition-all duration-200 active:scale-[0.98]"
            >
              Voltar para a Home
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </ErrorWrapper>
  )
}
