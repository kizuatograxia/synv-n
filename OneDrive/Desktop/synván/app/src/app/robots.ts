import { MetadataRoute } from 'next'

/**
 * Generate robots.txt
 *
 * Allows all crawlers and specifies the sitemap location.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sympla-experiment.local'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Disallow crawling of authenticated and administrative pages
        disallow: ['/api/', '/checkout/', '/orders/', '/profile/', '/organizer/', '/admin/', '/team/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
