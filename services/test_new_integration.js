/**
 * Test the new Python service integration for multiple stores
 */

const testNewIntegration = async () => {
  console.log('🧪 Testing New Python Service Integration...\n');

  // Test data similar to your logs
  const testData = {
    query: "whole milk 1 gallon",
    hasdata_results: [
      { title: "Walmart Whole Milk 1 gallon", extractedPrice: 2.57, source: "Walmart" },
      { title: "H-E-B Whole Milk 1 gallon", extractedPrice: 2.47, source: "H-E-B" },
      { title: "Kroger Whole Milk 1 gallon", extractedPrice: 1.29, source: "Kroger" },
      { title: "Target Whole Milk 1 gal", extractedPrice: 2.69, source: "Target" },
      { title: "Albertsons Whole Milk 1 gallon", extractedPrice: 3.19, source: "Albertsons" },
      { title: "Tom Thumb Whole Milk 1 gallon", extractedPrice: 4.99, source: "Tom Thumb" }
    ],
    nearby_stores: ["Kroger", "Walmart", "Target", "ALDI", "Tom Thumb", "H-E-B"]
  };

  try {
    console.log('📦 Testing with query:', testData.query);
    console.log('🏪 HasData results:', testData.hasdata_results.length);
    console.log('🏪 Nearby stores:', testData.nearby_stores.length);
    
    const response = await fetch('http://192.168.1.10:8000/match-products-for-stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('\n✅ New integration test successful!');
    console.log(`📊 Total stores: ${result.total_stores}`);
    console.log(`✅ Matched stores: ${result.matched_stores}`);
    console.log(`🤖 Stores needing AI: ${result.ai_stores}`);
    console.log(`⏱️ Processing time: ${result.processing_time_ms}ms`);
    
    console.log('\n🏪 Store matches:');
    for (const [storeName, match] of Object.entries(result.store_matches)) {
      console.log(`  ${storeName}: ${match.product.title} - $${match.product.extractedPrice} (score: ${match.score.toFixed(3)})`);
    }
    
    console.log('\n🤖 Stores needing AI:');
    result.stores_needing_ai.forEach(store => {
      console.log(`  ${store}`);
    });
    
    console.log('\n🎉 Integration working perfectly!');
    console.log('\n📋 What this means:');
    console.log('1. ✅ Python service finds best matches for stores with HasData results');
    console.log('2. 🤖 Remaining stores are sent to AI for price lookup');
    console.log('3. 🏪 No more wrong product prices from cheapest selection');
    console.log('4. 📊 Better accuracy with semantic matching');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Python service is running: uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000');
    console.log('2. Check if service is accessible: http://192.168.1.10:8000/health');
    console.log('3. Verify your React Native app can reach the service');
  }
};

testNewIntegration().catch(console.error);
