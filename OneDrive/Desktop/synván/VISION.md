# VISION.md

## Project: Sympla 360 - Event Ticketing Platform

### Overview

Build a modern event ticketing platform inspired by ticket360.com.br, deployable on Railway with Next.js 14+ App Router, PostgreSQL database, and Redis for caching.

> **Status**: O frontend já existe. O foco atual é ajustar o design para seguir rigorosamente o ticket360.com.br.

### Visual Design Inspiration (from ticket360.com.br)

O frontend deve seguir rigorosamente o design do ticket360.com.br:

#### Paleta de Cores
- **Cor Primária/Accent**: `#6C63FF` (roxo/violeta)
- **Background Claro**: `#FFFFFF`
- **Background Escuro**: `#1A1A2E`
- **Cor de Texto Principal**: `#1A1A2E` (modo claro) / `#FFFFFF` (modo escuro)
- **Cor de Texto Secundário**: `#666666` (modo claro) / `#AAAAAA` (modo escuro)
- **Bordas e Divisores**: `#E0E0E0` (modo claro) / `#333333` (modo escuro)
- **Hover de Links/Ações**: `#5A52D9` (versão mais escura do accent)
- **Sucesso**: `#4CAF50`
- **Erro**: `#F44336`
- **Alerta**: `#FF9800`

#### Tipografia (Google Fonts)
- **Headings (Títulos)**: Poppins
  - Pesos: 300, 400, 500, 600, 700
  - Uso: Títulos de eventos, headlines, botões, navegação
- **Corpo de Texto**: Roboto
  - Pesos: 300, 400, 500, 600, 700
  - Uso: Descrições, informações de locais, textos longos

#### Estrutura do Layout

**Header (Cabeçalho)**
- Logo à esquerda
- Menu de navegação principal: Casas/Clubes, Música, Artistas, Eventos, Estados, Turnês
- Campo de busca: 450px de largura em desktop, 335px em mobile
- Ícone de carrinho de compras
- Ícone de notificações
- Menu dropdown do usuário (Login, Meus Ingressos, Minha Carteira)
- Menu hambúrguer para mobile

**Menu de Categorias**
- Estrutura hierárquica com subcategorias em dropdown
- Categorias principais: Casas/Clubes, Música, Artistas, Eventos, Estados, Turnês

**Seção de Destaques (Hero Carousel)**
- Grid de eventos em destaque
- Imagens grandes em formato de banner
- Navegação por dots ou arrows

**Lista de Eventos (Grid)**
- Cards em formato de lista vertical
- Layout: Imagem à esquerda, informações à direita

**Cards de Eventos**
- Badge de data (dia/mês separados)
- Imagem do evento/venue
- Título do evento
- Nome do local/venue
- Cidade e Estado
- Horário de abertura dos portões
- Preço a partir de (quando aplicável)

**Footer (Rodapé)**
- Links institucionais
- Redes sociais
- Formas de pagamento
- Informações de contato

#### Componentes de Interface

**Botões**
- Primário: Background `#6C63FF`, texto branco, bordas arredondadas
- Secundário: Borda `#6C63FF`, texto na cor accent, fundo transparente
- Estados: hover (escurecer 10%), active (escurecer 20%), disabled (opacidade 50%)

**Inputs e Campos de Busca**
- Borda: 1px solid `#E0E0E0`
- Border radius: 8px
- Padding: 12px 16px
- Focus: Borda `#6C63FF` com shadow `0 0 0 3px rgba(108, 99, 255, 0.2)`

**Cards**
- Border radius: 12px
- Sombra: `0 2px 8px rgba(0, 0, 0, 0.1)`
- Hover: Sombra aumentada `0 4px 16px rgba(0, 0, 0, 0.15)`, slight scale (1.02)

**Sistema de Zoom**
- Controles para aumentar/diminuir zoom (100% a 150%)
- Botões flutuantes

**Modo de Alto Contraste**
- Toggle para acessibilidade
- Alterna para cores de alto contraste

#### Espaçamento e Tamanhos
- Container max-width: 1200px
- Grid gap: 24px
- Card padding: 16px
- Section padding: 48px vertical
- Border radius padrão: 8px (buttons, inputs), 12px (cards)

#### Animações e Transições
- Transições suaves: 0.2s ease para hover states
- Efeito de zoom suave nas imagens dos cards

#### Responsividade
- Mobile: < 768px (menu hambúrguer, grid 1 coluna)
- Tablet: 768px - 1024px (grid 2 colunas)
- Desktop: > 1024px (grid 3-4 colunas)

### Tech Stack

- **Framework**: Next.js 14+ com App Router (React 18+)
- **Frontend**: TypeScript, Tailwind CSS
- **Database**: PostgreSQL (via Prisma ORM)
- **Caching**: Redis (for session management and API caching)
- **Deployment**: Railway (with Docker support)
- **Authentication**: NextAuth.js com credentials provider
- **Payment**: Integration-ready for payment gateways (mock for MVP)

> **Nota Importante**: O projeto usará **Next.js 14+ com App Router** para melhor SEO através de Server Side Rendering (SSR) e Static Site Generation (SSG), além de geração de мета tags automáticas e prefetching de links.

### Core Features

1. **Event Discovery**
   - Homepage with featured events carousel
   - Category-based event browsing (Music, Theater, Sports, etc.)
   - Search functionality with filters (date, location, category, price)
   - Event detail pages with full information

2. **Event Management (Admin)**
   - Create/edit/delete events
   - Upload event images
   - Set ticket types and pricing tiers
   - Manage venue and schedule

3. **Ticket Purchasing**
   - Browse available events
   - Select ticket quantities and types
   - Shopping cart functionality
   - Checkout flow (mock payment for MVP)
   - Order confirmation and tickets

4. **User Accounts**
   - User registration and login
   - Order history
   - Saved/favorite events
   - Profile management

5. **API & Integrations**
   - RESTful API endpoints
   - Webhook support for payment callbacks
   - Event data export

### Railway Deployment Requirements

The project must be fully deployable on Railway:

1. **Railway Configuration**:
   - `railway.json` configuration file
   - Proper environment variable handling
   - PostgreSQL and Redis services via Railway's add-ons
   - Dockerfile optimized for Railway deployment (Next.js standalone output)
   - Next.js build with output: 'standalone' for minimal container size

2. **Environment Variables**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `NEXTAUTH_SECRET` - NextAuth.js secret
   - `NEXTAUTH_URL` - Application URL
   - Optional: Payment gateway keys

3. **Health Checks**:
   - API health endpoint at `/api/health`
   - Proper connection pooling for database
   - Graceful shutdown handling

4. **SEO Optimization**:
   - Static generation (SSG) for event pages
   - Incremental Static Regeneration (ISR) for event listings
   - Metadata API for dynamic Open Graph tags
   - Sitemap generation

### Project Structure

```
/
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # Auth routes (login, register)
│   │   ├── (main)/         # Main app routes
│   │   │   ├── events/     # Event pages
│   │   │   ├── cart/       # Shopping cart
│   │   │   ├── checkout/   # Checkout flow
│   │   │   └── profile/    # User profile
│   │   ├── admin/          # Admin pages
│   │   ├── api/            # API routes (Next.js)
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Homepage
│   ├── components/         # React components
│   │   ├── ui/             # UI components (Button, Input, Card)
│   │   ├── layout/         # Header, Footer, Navigation
│   │   ├── events/         # Event-specific components
│   │   └── checkout/       # Checkout components
│   ├── lib/                # Utilities and helpers
│   │   ├── prisma.ts       # Prisma client
│   │   ├── auth.ts         # NextAuth configuration
│   │   └── utils.ts        # Utility functions
│   ├── types/              # TypeScript types
│   └── styles/             # Global styles
├── prisma/                 # Database schema
│   └── schema.prisma
├── public/                 # Static assets
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── Dockerfile              # Production container
├── railway.json            # Railway configuration
└── .env.example            # Environment template
```

### Database Schema (Prisma)

- **User**: id, email, name, password, role, createdAt
- **Event**: id, title, description, date, venue, category, imageUrl, status
- **TicketType**: id, eventId, name, price, quantity, available
- **Order**: id, userId, status, total, createdAt
- **OrderItem**: id, orderId, ticketTypeId, quantity, price

### Done When

1. Railway deployment succeeds without errors
2. Homepage loads with featured events section
3. User can browse events by category
4. User can search for events
5. Event detail page shows full information with ticket options
6. User can register and login
7. User can add tickets to cart and checkout
8. Order confirmation displays after purchase
9. User can view order history
10. Admin can create and manage events
11. API health check returns 200 OK
12. Lighthouse performance score > 80

### Acceptance Criteria

- [ ] Project deploys to Railway without manual intervention
- [ ] All environment variables properly configured
- [ ] Database migrations run on startup
- [ ] Frontend matches ticket360.com.br visual style
- [ ] Dark/light theme toggle works
- [ ] Event cards display date, venue, location correctly
- [ ] Search returns relevant results
- [ ] Checkout flow completes with mock payment
- [ ] User orders appear in order history
- [ ] No critical console errors in production build
