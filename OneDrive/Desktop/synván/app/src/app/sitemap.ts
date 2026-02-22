import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db/prisma'

/**
 * Generate sitemap.xml with all published events
 *
 * This dynamically generates a sitemap including:
 * - Static pages (home, auth, etc.)
 * - All published events with their last modified date
 * - Organizer pages (dashboard, events, etc.)
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sympla-experiment.local'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  try {
    // Fetch all published events
    const events = await prisma.event.findMany({
      where: {
        isPublished: true,
      },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
      },
    })

    // Generate sitemap entries for each event
    const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

    // Combine static and dynamic pages
    return [...staticPages, ...eventPages]
  } catch (error) {
    // If database is unavailable, return static pages only
    console.error('Error generating sitemap:', error)
    return staticPages
  }
}
