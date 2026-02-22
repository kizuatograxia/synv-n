import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { generateCSRFToken } from '@/lib/middleware/csrf'
import { auditService } from '@/lib/services/audit-service'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '')

        if (!credentials?.email || !credentials?.password) {
          // Log failed login attempt - missing credentials
          await auditService.logUserLogin('anonymous', {
            success: false,
            method: 'credentials'
          }).catch(() => {})
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email }
        })

        if (!user) {
          // Log failed login attempt - user not found
          await auditService.logUserLogin('anonymous', {
            success: false,
            method: 'credentials'
          }).catch(() => {})
          return null
        }

        const isValidPassword = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash
        )

        if (!isValidPassword) {
          // Log failed login attempt - invalid password
          await auditService.logUserLogin(user.id, {
            success: false,
            method: 'credentials'
          }).catch(() => {})
          return null
        }

        // Log successful login
        await auditService.logUserLogin(user.id, {
          success: true,
          method: 'credentials'
        }).catch(() => {})

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/login'
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
        // Generate new CSRF token on login/registration
        token.csrfToken = await generateCSRFToken()
      }
      return token
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        // Include CSRF token in session for client access
        session.csrfToken = token.csrfToken
      }
      return session
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (max session duration) - CDC compliant for purchases
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours (JWT token expiration)
    // Note: Refresh token rotation requires a database adapter (PrismaAdapter)
    // Current setup uses stateless JWT only; users must re-authenticate after 24h
  },
  secret: process.env.NEXTAUTH_SECRET
})
