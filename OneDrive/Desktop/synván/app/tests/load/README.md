# Load Testing

This directory contains K6 load testing scripts for the Simprão platform.

## Prerequisites

Install K6:
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Or download from https://k6.io/
```

## Test Scenarios

The `checkout.js` script includes three concurrent scenarios:

### 1. Browsing Events (100 concurrent users)
- Simulates users browsing the events listing
- Views event details
- **Goal**: Test read performance and caching
- **Expected**: < 500ms response time (p95)

### 2. Adding to Cart (50 concurrent users)
- Simulates users adding tickets to cart
- Tests cart creation endpoint
- **Goal**: Test moderate write load
- **Expected**: < 500ms response time (p95)

### 3. Checkout Flow (20 concurrent users)
- Simulates users completing purchases
- Tests order creation and payment initiation
- **Goal**: Test critical purchase path
- **Expected**: < 1000ms response time (p95)

## Running Tests

### Basic Run
```bash
cd app
k6 run tests/load/checkout.js
```

### Custom Load Levels
```bash
# Light load: 10 browsing, 5 cart, 2 checkout
k6 run --stage '1m:10,2m:10,1m:0' tests/load/checkout.js

# Medium load: 50 browsing, 25 cart, 10 checkout
k6 run --stage '2m:50,5m:50,2m:0' tests/load/checkout.js

# Heavy load: 200 browsing, 100 cart, 40 checkout
k6 run --stage '2m:200,10m:200,2m:0' tests/load/checkout.js

# Stress test: Ramp up to 500 users
k6 run --stage '5m:500,10m:500,5m:0' tests/load/checkout.js
```

### Target Different Environment
```bash
# Staging
BASE_URL=https://staging.simprao.com k6 run tests/load/checkout.js

# Production (USE WITH CAUTION)
BASE_URL=https://simprao.com k6 run tests/load/checkout.js
```

## Interpreting Results

### Key Metrics

1. **http_req_duration**: Request latency
   - `p(95)`: 95th percentile (should be < 500ms)
   - `p(99)`: 99th percentile (should be < 1000ms)

2. **http_req_failed**: Error rate
   - Should be < 5%

3. **Virtual Users (VUs)**: Concurrent users
   - Browsing: 100 VUs
   - Cart: 50 VUs
   - Checkout: 20 VUs

4. **RPS (Requests Per Second)**: Throughput
   - Expected: 100-500 RPS depending on scenario

### Output Example

```
✓ browse status is 200
✓ browse has events array
✓ cart status is 200 or 201
✓ order status is 200 or 201

checks.........................: 99.2% ✓ 12345  ✗ 98
data_received..................: 45 MB  250 kB/s
data_sent......................: 12 MB  66 kB/s
http_req_blocked...............: avg=1.2ms   min=0s    med=1ms    max=50ms
http_req_connecting............: avg=800µs   min=0s    med=0s     max=20ms
http_req_duration..............: avg=245.6ms min=10ms  med=180ms  max=950ms
  { expected_response:true }...: avg=245.6ms min=10ms  med=180ms  max=950ms
http_req_failed................: 0.8%  ✓ 98    ✗ 12345
http_req_receiving.............: avg=15ms    min=10µs  med=10ms   max=100ms
http_req_sending...............: avg=200µs   min=10µs  med=100µs  max=5ms
http_req_tls_handshaking.......: avg=0s      min=0s    med=0s     max=0s
http_req_waiting...............: avg=230ms   min=10ms  med=170ms  max=900ms
http_reqs......................: 12443  69.1/s
iteration_duration.............: avg=4.5s    min=100ms med=3s     max=15s
iterations.....................: 3108   1.7/s
vus............................: 100    min=0    max=100
vus_max........................: 100    min=100  max=100
```

## Troubleshooting

### High Error Rates
- Check database connection pool size
- Verify Redis is running and accessible
- Check rate limiting rules
- Review application logs

### Slow Response Times
- Enable Redis caching for event listings
- Add database indexes on frequently queried fields
- Check for N+1 queries
- Consider read replicas for database

### Connection Errors
- Verify API is running: `npm run dev`
- Check firewall rules
- Verify BASE_URL is correct
- Check DNS resolution

## Best Practices

1. **Run load tests in staging first** - Never run heavy load tests against production
2. **Start small** - Begin with light loads and gradually increase
3. **Monitor resources** - Watch CPU, memory, database connections during tests
4. **Use realistic data** - Tests should mimic real user behavior
5. **Test during off-peak hours** - If testing shared infrastructure
6. **Document baselines** - Record results to track performance over time

## CI/CD Integration

Add to GitHub Actions (`.github/workflows/load-test.yml`):

```yaml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install K6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Start App
        run: |
          cd app
          npm install
          npm run dev &
          sleep 30
      - name: Run Load Test
        run: cd app && k6 run tests/load/checkout.js
```

## Next Steps

- Add load tests for authentication flow
- Add load tests for check-in scanning
- Add load tests for admin dashboard
- Create performance regression tests in CI pipeline
- Set up automated performance monitoring
