import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting database seed...')

  const hashedPassword = await bcrypt.hash('password123', 10)

  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@simprao.com' },
    update: {},
    create: {
      email: 'organizer@simprao.com',
      name: 'João Silva',
      passwordHash: hashedPassword,
      role: 'ORGANIZER',
      cpf: '12345678900',
      phone: '+5511999999999',
    },
  })

  const attendee = await prisma.user.upsert({
    where: { email: 'attendee@simprao.com' },
    update: {},
    create: {
      email: 'attendee@simprao.com',
      name: 'Maria Santos',
      passwordHash: hashedPassword,
      role: 'ATTENDEE',
      cpf: '09876543200',
      phone: '+5511988888888',
    },
  })

  const admin = await prisma.user.upsert({
    where: { email: 'admin@simprao.com' },
    update: {},
    create: {
      email: 'admin@simprao.com',
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      cpf: '00000000000',
      phone: '+5511777777777',
    },
  })

  const event = await prisma.event.upsert({
    where: { slug: 'rock-festival-2024' },
    update: {},
    create: {
      title: 'Rock Festival 2024',
      description: 'The biggest rock festival in Brazil with 3 days of music',
      slug: 'rock-festival-2024',
      startTime: new Date('2024-03-15T18:00:00'),
      endTime: new Date('2024-03-17T23:00:00'),
      location: 'Estádio do Morumbi',
      address: 'Av. Francisco Morato, 5645',
      city: 'São Paulo',
      state: 'SP',
      imageUrl: 'https://picsum.photos/seed/rock-festival/800/400',
      isPublished: true,
      organizerId: organizer.id,
    },
  })

  const lot1 = await prisma.lot.create({
    data: {
      name: 'Primeiro Lote',
      price: 150.0,
      totalQuantity: 10000,
      availableQuantity: 5000,
      startDate: new Date('2024-01-01T00:00:00'),
      endDate: new Date('2024-02-28T23:59:59'),
      isActive: true,
      eventId: event.id,
    },
  })

  const lot2 = await prisma.lot.create({
    data: {
      name: 'Segundo Lote',
      price: 200.0,
      totalQuantity: 5000,
      availableQuantity: 5000,
      startDate: new Date('2024-03-01T00:00:00'),
      endDate: new Date('2024-03-14T23:59:59'),
      isActive: false,
      eventId: event.id,
    },
  })

  const streamingEvent = await prisma.event.upsert({
    where: { slug: 'online-workshop-react' },
    update: {},
    create: {
      title: 'Workshop Online: React Avançado',
      description: 'Aprenda técnicas avançadas de React com experts da indústria',
      slug: 'online-workshop-react',
      startTime: new Date('2024-04-10T14:00:00'),
      endTime: new Date('2024-04-10T18:00:00'),
      location: 'Online (Zoom)',
      city: null,
      state: null,
      imageUrl: 'https://picsum.photos/seed/react-workshop/800/400',
      isPublished: true,
      organizerId: organizer.id,
    },
  })

  const streamingLot = await prisma.lot.create({
    data: {
      name: 'Acesso Online',
      price: 99.0,
      totalQuantity: 300,
      availableQuantity: 300,
      startDate: new Date('2024-03-01T00:00:00'),
      endDate: new Date('2024-04-09T23:59:59'),
      isActive: true,
      eventId: streamingEvent.id,
    },
  })

  const promocode = await prisma.promocode.create({
    data: {
      code: 'WELCOME20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxUsage: 1000,
      currentUsage: 0,
      expiresAt: new Date('2024-12-31T23:59:59'),
      isActive: true,
    },
  })

  const fixedPromocode = await prisma.promocode.create({
    data: {
      code: 'FLAT50',
      discountType: 'FIXED',
      discountValue: 50,
      maxUsage: 500,
      currentUsage: 0,
      expiresAt: new Date('2024-12-31T23:59:59'),
      isActive: true,
    },
  })

  console.log('✅ Seed completed successfully!')
  console.log('📊 Created:')
  console.log(`   - 3 users (organizer, attendee, admin)`)
  console.log(`   - 2 events (1 physical, 1 streaming)`)
  console.log(`   - 3 lots`)
  console.log(`   - 2 promocodes (WELCOME20 - 20%, FLAT50 - R$50 off)`)
  console.log('🔐 Test credentials:')
  console.log(`   - Email: organizer@simprao.com, Password: password123`)
  console.log(`   - Email: attendee@simprao.com, Password: password123`)
  console.log(`   - Email: admin@simprao.com, Password: password123`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
