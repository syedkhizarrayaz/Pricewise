#!/usr/bin/env node

/**
 * Pricewise API Endpoint Test Script
 * 
 * Tests all backend and Python service endpoints
 * 
 * Usage:
 *   node test-endpoints.js [backend-url] [python-url]
 * 
 * Examples:
 *   node test-endpoints.js                                    # Uses defaults (localhost)
 *   node test-endpoints.js http://localhost:3001             # Custom backend URL
 *   node test-endpoints.js http://104.248.75.168:3001       # External backend
 *   node test-endpoints.js http://localhost:3001 http://localhost:8000  # Both URLs
 *   node test-endpoints.js http://104.248.75.168:3001 http://104.248.75.168:8000  # Both external
 */

const https = require('https');
const http = require('http');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Parse command line arguments
const args = process.argv.slice(2);
const backendUrl = args[0] || 'http://localhost:3001';
const pythonUrl = args[1] || 'http://localhost:8000';

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || 30000
    };

    const req = httpModule.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            raw: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test function
async function runTest(name, url, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`\n${colors.cyan}Testing:${colors.reset} ${name}`);
    console.log(`${colors.blue}URL:${colors.reset} ${url}`);
    
    const response = await makeRequest(url, options);
    const duration = Date.now() - startTime;
    
    const success = response.status >= 200 && response.status < 300;
    
    if (success) {
      console.log(`${colors.green}✓ PASSED${colors.reset} (${duration}ms)`);
      console.log(`${colors.blue}Status:${colors.reset} ${response.status}`);
      if (options.verbose || response.status !== 200) {
        console.log(`${colors.blue}Response:${colors.reset}`, JSON.stringify(response.data, null, 2).substring(0, 500));
      }
      results.passed++;
      results.tests.push({ name, status: 'passed', duration, url });
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} (${duration}ms)`);
      console.log(`${colors.red}Status:${colors.reset} ${response.status}`);
      console.log(`${colors.red}Response:${colors.reset}`, JSON.stringify(response.data, null, 2).substring(0, 500));
      results.failed++;
      results.tests.push({ name, status: 'failed', duration, url, error: `Status ${response.status}` });
    }
    
    return { success, response, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`${colors.red}✗ FAILED${colors.reset} (${duration}ms)`);
    console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'failed', duration, url, error: error.message });
    return { success: false, error: error.message, duration };
  }
}

// Backend Tests
async function testBackend() {
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  BACKEND API TESTS (${backendUrl})${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);

  // Root endpoint
  await runTest('Root Endpoint', `${backendUrl}/`);

  // Health check
  await runTest('Health Check', `${backendUrl}/api/health`);

  // Grocery service health
  await runTest('Grocery Service Health', `${backendUrl}/api/grocery/health`);

  // Analytics
  await runTest('Analytics', `${backendUrl}/api/analytics`);
  await runTest('Analytics Queries', `${backendUrl}/api/analytics/queries?limit=10`);
  await runTest('Analytics Clean Cache', `${backendUrl}/api/analytics/clean-cache`, {
    method: 'POST'
  });

  // Main grocery search endpoint
  const searchPayload = {
    items: ['whole milk', 'bread'],
    address: '123 Main St, Plano, TX 75074',
    zipCode: '75074',
    latitude: 33.0198,
    longitude: -96.6989,
    nearbyStores: ['Walmart', 'Kroger', 'Target']
  };

  await runTest('Grocery Search', `${backendUrl}/api/grocery/search`, {
    method: 'POST',
    body: searchPayload,
    verbose: true
  });

  // Test with single item
  await runTest('Grocery Search (Single Item)', `${backendUrl}/api/grocery/search`, {
    method: 'POST',
    body: {
      items: ['milk'],
      address: 'Plano, TX 75074',
      zipCode: '75074'
    }
  });

  // Test validation errors
  await runTest('Grocery Search (No Items - Validation)', `${backendUrl}/api/grocery/search`, {
    method: 'POST',
    body: {
      items: [],
      address: 'Plano, TX 75074',
      zipCode: '75074'
    }
  });

  await runTest('Grocery Search (No Address - Validation)', `${backendUrl}/api/grocery/search`, {
    method: 'POST',
    body: {
      items: ['milk'],
      address: '',
      zipCode: '75074'
    }
  });
}

// Python Service Tests
async function testPythonService() {
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  PYTHON SERVICE TESTS (${pythonUrl})${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);

  // Health check
  await runTest('Python Service Health', `${pythonUrl}/health`);

  // Match products
  const matchProductsPayload = {
    query: 'whole milk 1 gallon',
    hasdata_results: [
      {
        position: 1,
        title: 'Great Value Whole Milk 1 gal',
        extractedPrice: 2.57,
        source: 'Walmart'
      },
      {
        position: 2,
        title: 'H-E-B Whole Milk 1 gallon',
        extractedPrice: 2.82,
        source: 'H-E-B'
      }
    ],
    weights: {
      token_set: 0.50,
      embed: 0.30,
      partial: 0.15,
      brand: 0.05
    },
    conf_threshold: 0.30,
    tie_delta: 0.10
  };

  await runTest('Match Products', `${pythonUrl}/match-products`, {
    method: 'POST',
    body: matchProductsPayload,
    verbose: true
  });

  // Match products for stores
  const matchStoresPayload = {
    query: 'whole milk 1 gallon',
    hasdata_results: [
      {
        position: 1,
        title: 'Great Value Whole Milk 1 gal',
        extractedPrice: 2.57,
        source: 'Walmart'
      },
      {
        position: 2,
        title: 'H-E-B Whole Milk 1 gallon',
        extractedPrice: 2.82,
        source: 'H-E-B'
      },
      {
        position: 3,
        title: 'Kroger Whole Milk 1 gallon',
        extractedPrice: 2.69,
        source: 'Kroger'
      }
    ],
    nearby_stores: ['Walmart', 'Kroger', 'H-E-B', 'Target']
  };

  await runTest('Match Products for Stores', `${pythonUrl}/match-products-for-stores`, {
    method: 'POST',
    body: matchStoresPayload,
    verbose: true
  });

  // Match multiple products
  const matchMultiplePayload = [
    {
      query: 'whole milk',
      hasdata_results: [
        {
          position: 1,
          title: 'Great Value Whole Milk 1 gal',
          extractedPrice: 2.57,
          source: 'Walmart'
        }
      ]
    },
    {
      query: 'bread',
      hasdata_results: [
        {
          position: 1,
          title: 'Wonder Bread Classic White',
          extractedPrice: 2.99,
          source: 'Walmart'
        }
      ]
    }
  ];

  await runTest('Match Multiple Products', `${pythonUrl}/match-multiple-products`, {
    method: 'POST',
    body: matchMultiplePayload,
    verbose: true
  });
}

// Integration Test (Backend -> Python)
async function testIntegration() {
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  INTEGRATION TEST (Backend → Python)${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);

  // Test that backend can communicate with Python service
  const searchPayload = {
    items: ['milk'],
    address: 'Plano, TX 75074',
    zipCode: '75074',
    latitude: 33.0198,
    longitude: -96.6989
  };

  const result = await runTest('Full Integration Test', `${backendUrl}/api/grocery/search`, {
    method: 'POST',
    body: searchPayload,
    verbose: true
  });

  if (result.success && result.response) {
    const data = result.response.data;
    if (data.pythonMatches) {
      console.log(`${colors.green}✓ Python service integration working${colors.reset}`);
      console.log(`  - Stores matched: ${Object.keys(data.pythonMatches.store_matches || {}).length}`);
      console.log(`  - Stores needing AI: ${data.pythonMatches.stores_needing_ai?.length || 0}`);
    } else {
      console.log(`${colors.yellow}⚠ Python service not used in response${colors.reset}`);
    }
  }
}

// Print summary
function printSummary() {
  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════${colors.reset}`);
  
  console.log(`\n${colors.green}Passed:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
  console.log(`${colors.yellow}Skipped:${colors.reset} ${results.skipped}`);
  console.log(`Total: ${results.passed + results.failed + results.skipped}`);

  if (results.failed > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    URL: ${t.url}`);
        if (t.error) {
          console.log(`    Error: ${t.error}`);
        }
      });
  }

  console.log(`\n${colors.bright}Backend URL:${colors.reset} ${backendUrl}`);
  console.log(`${colors.bright}Python URL:${colors.reset} ${pythonUrl}`);
}

// Main execution
async function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         Pricewise API Endpoint Test Suite                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  console.log(`\n${colors.bright}Configuration:${colors.reset}`);
  console.log(`  Backend URL: ${colors.blue}${backendUrl}${colors.reset}`);
  console.log(`  Python URL:  ${colors.blue}${pythonUrl}${colors.reset}`);

  try {
    // Test backend
    await testBackend();

    // Test Python service
    await testPythonService();

    // Test integration
    await testIntegration();

    // Print summary
    printSummary();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${colors.red}Fatal Error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runTest, testBackend, testPythonService, testIntegration };
