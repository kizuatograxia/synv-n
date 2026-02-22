/**
 * K6 High-Concurrency Load Test for Event Listing Pages
 *
 * This script tests the platform's ability to handle high concurrency (1K users)
 * while meeting the VISION success criterion: "Page loads < 1s"
 *
 * Specifically targets:
 * - Event listing page p95 < 1s under 1K concurrent users
 * - Event detail page p95 < 1s
 *
 * Run with:
 *   k6 run tests/load/high-concurrency.js
 *
 * Run with custom concurrency:
 *   k6 run --vus 1000 --duration 5m tests/load/high-concurrency.js
 *
 * Environment variables:
 *   BASE_URL - API base URL (default: http://localhost:3000)
 *   TARGET_VUS - Target concurrent users (default: 1000)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for Phase 6 validation
const errorRate = new Rate('errors');
const eventListingLatency = new Trend('event_listing_latency');
const eventDetailLatency = new Trend('event_detail_latency');

// Test configuration - targets 1K concurrent users
export const options = {
  scenarios: {
    high_concurrency_browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 1000 },  // Ramp up to 1000 users
        { duration: '5m', target: 1000 },  // Stay at 1000 users (main test)
        { duration: '2m', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'highConcurrencyScenario',
    },
  },
  thresholds: {
    // VISION Phase 6: Page loads < 1s
    'event_listing_latency': ['p(95)<1000'],  // Event listing p95 < 1s
    'event_detail_latency': ['p(95)<1000'],    // Event detail p95 < 1s
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // General response time
    http_req_failed: ['rate<0.05'],            // Error rate under 5%
    errors: ['rate<0.05'],
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '1000');

// Test data cache
const eventCache = [];
const MAX_CACHE_SIZE = 100;

/**
 * High Concurrency Browsing Scenario
 * Simulates 1000 concurrent users browsing events
 * Tests VISION criterion: "Page loads < 1s"
 */
export function highConcurrencyScenario() {
  // 1. Browse event listing page (primary focus)
  const listingStart = new Date();
  const listingRes = http.get(
    `${BASE_URL}/api/events?published=true&page=1&limit=20`,
    {
      tags: { name: 'EventListingPage' },
      timeout: '10s',
    }
  );
  const listingDuration = new Date() - listingStart;

  const listingSuccess = check(listingRes, {
    'listing status is 200': (r) => r.status === 200,
    'listing has events array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.events && Array.isArray(body.events);
      } catch {
        return false;
      }
    },
    'listing response time < 1s': (r) => listingDuration < 1000,
  });

  errorRate.add(!listingSuccess);
  eventListingLatency.add(listingDuration);

  // Cache event IDs for detail page testing
  if (listingSuccess && listingRes.status === 200) {
    try {
      const body = JSON.parse(listingRes.body);
      if (body.events && body.events.length > 0) {
        // Add to cache for detail page testing
        for (const event of body.events) {
          if (eventCache.length < MAX_CACHE_SIZE) {
            eventCache.push(event.id);
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Brief sleep between listing and detail view
  sleep(Math.random() * 0.5 + 0.5);

  // 2. View event detail page (secondary focus)
  if (eventCache.length > 0) {
    // Pick a random event from cache
    const randomEventId = eventCache[Math.floor(Math.random() * eventCache.length)];

    const detailStart = new Date();
    const detailRes = http.get(
      `${BASE_URL}/api/events/${randomEventId}`,
      {
        tags: { name: 'EventDetailPage' },
        timeout: '10s',
      }
    );
    const detailDuration = new Date() - detailStart;

    const detailSuccess = check(detailRes, {
      'detail status is 200': (r) => r.status === 200,
      'detail has event data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.event && body.event.id;
        } catch {
          return false;
        }
      },
      'detail response time < 1s': (r) => detailDuration < 1000,
    });

    errorRate.add(!detailSuccess);
    eventDetailLatency.add(detailDuration);
  }

  // Simulate realistic user think time between page views
  sleep(Math.random() * 2 + 1); // 1-3 seconds between requests
}

/**
 * Setup function - pre-warm the cache with event IDs
 */
export function setup() {
  console.log(`Starting high-concurrency test for ${TARGET_VUS} concurrent users`);
  console.log(`Target: Event listing and detail pages p95 < 1s`);

  // Fetch initial batch of events to populate cache
  const res = http.get(`${BASE_URL}/api/events?published=true&limit=20`, {
    timeout: '10s',
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.events && body.events.length > 0) {
        for (const event of body.events) {
          eventCache.push(event.id);
          if (eventCache.length >= 50) break; // Start with 50 events
        }
        console.log(`Pre-warmed cache with ${eventCache.length} events`);
      }
    } catch (e) {
      console.warn('Failed to pre-warm event cache');
    }
  }

  return { eventCount: eventCache.length };
}

/**
 * Teardown function - log summary
 */
export function teardown(data) {
  console.log(`High-concurrency test completed`);
  console.log(`Initial cache size: ${data.eventCount} events`);
}
