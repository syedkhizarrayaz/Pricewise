/**
 * Test network connectivity to Python service
 */

const testNetworkConnectivity = async () => {
  console.log('🧪 Testing Network Connectivity...\n');

  const testUrls = [
    'http://localhost:8000/health',
    'http://192.168.1.10:8000/health'
  ];

  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log(`✅ SUCCESS: ${url}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Embeddings: ${data.embeddings_available}`);
    } catch (error) {
      console.log(`❌ FAILED: ${url}`);
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('📋 If localhost works but 192.168.1.10 fails:');
  console.log('1. Make sure Python service is running with: python product_matcher_service.py');
  console.log('2. Check if Windows Firewall is blocking the connection');
  console.log('3. Try running Python service with: uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000');
};

testNetworkConnectivity().catch(console.error);
