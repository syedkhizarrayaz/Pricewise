/**
 * Test improved matching with better query prioritization
 */

const testImprovedMatching = async () => {
  console.log('🧪 Testing Improved Query Matching...\n');

  // Test with products that have different sizes to see if it picks the right one
  const testData = {
    query: "whole milk 1 gallon",
    hasdata_results: [
      { title: "Tom Thumb Whole Milk 1 gallon", extractedPrice: 4.99, source: "Tom Thumb" },
      { title: "Tom Thumb Lucerne Whole Milk Carton (1/2 gal)", extractedPrice: 2.49, source: "Tom Thumb" },
      { title: "Tom Thumb Organic Whole Milk 1 gallon", extractedPrice: 5.99, source: "Tom Thumb" },
      { title: "Kroger Whole Milk 1 gallon", extractedPrice: 1.29, source: "Kroger" },
      { title: "Kroger Organic Whole Milk 1 gallon", extractedPrice: 3.99, source: "Kroger" },
      { title: "Walmart Whole Milk 1 gallon", extractedPrice: 2.57, source: "Walmart" }
    ],
    nearby_stores: ["Tom Thumb", "Kroger", "Walmart"]
  };

  try {
    console.log('📦 Testing query:', testData.query);
    console.log('🏪 HasData results:');
    testData.hasdata_results.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.source}: ${result.title} - $${result.extractedPrice}`);
    });
    console.log('');

    const response = await fetch('http://192.168.1.10:8000/match-products-for-stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Improved matching test results:');
    console.log(`📊 Total stores: ${result.total_stores}`);
    console.log(`✅ Matched stores: ${result.matched_stores}`);
    console.log(`🤖 Stores needing AI: ${result.ai_stores}`);
    console.log(`⏱️ Processing time: ${result.processing_time_ms}ms`);
    
    console.log('\n🏪 Store matches (should prefer 1 gallon over 1/2 gallon):');
    for (const [storeName, match] of Object.entries(result.store_matches)) {
      const product = match.product;
      console.log(`  ${storeName}: ${product.title} - $${product.extractedPrice} (score: ${match.score.toFixed(3)})`);
      
      // Check if it selected the right size
      const isCorrectSize = product.title.toLowerCase().includes('1 gallon') || 
                           product.title.toLowerCase().includes('1 gal');
      console.log(`    ✅ Correct size: ${isCorrectSize ? 'YES' : 'NO'}`);
    }
    
    console.log('\n🤖 Stores needing AI:');
    result.stores_needing_ai.forEach(store => {
      console.log(`  ${store}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testImprovedMatching();
