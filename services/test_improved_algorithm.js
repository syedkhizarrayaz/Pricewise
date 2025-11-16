/**
 * Test the improved matching algorithm
 */

const testImprovedAlgorithm = async () => {
  console.log('🧪 Testing Improved Matching Algorithm...\n');

  // Test with the same data from your logs
  const testData = {
    query: "whole milk 1 gallon",
    hasdata_results: [
      // Walmart products
      { title: "Great Value Whole Milk with Vitamin D", extractedPrice: 2.57, source: "Walmart" },
      { title: "Horizon Organic Whole Milk", extractedPrice: 5.96, source: "Walmart" },
      { title: "Walmart Whole Milk 1 gallon", extractedPrice: 2.57, source: "Walmart" },
      
      // H-E-B products
      { title: "H-E-B Whole Milk", extractedPrice: 2.77, source: "H-E-B" },
      { title: "Hill Country Fare Whole Milk", extractedPrice: 2.47, source: "H-E-B" },
      
      // Target products
      { title: "Good & Gather Whole Milk 1 gal", extractedPrice: 2.69, source: "Target" },
      { title: "Dean's Whole Milk Jug", extractedPrice: 5.79, source: "Target" },
      
      // Sam's Club
      { title: "Member's Mark Grade A Whole Milk 1 gal.", extractedPrice: 4.09, source: "Sam's Club" },
      
      // Albertsons
      { title: "Lucerne Whole Milk", extractedPrice: 3.19, source: "Albertsons" },
      { title: "O Organics Whole Milk", extractedPrice: 7.99, source: "Albertsons" },
      
      // Dollar General
      { title: "Clover Valley Whole Milk 1 gal", extractedPrice: 4.1, source: "Dollar General" },
      
      // Kroger
      { title: "Kroger Whole Milk Grade A 1 Gal", extractedPrice: 1.29, source: "Kroger" },
      { title: "MAPLE Hill CREAMERY Organic Whole Milk", extractedPrice: 7.69, source: "Kroger" },
      
      // Tom Thumb
      { title: "Pride of the Farm Whole Milk with Vitamin D", extractedPrice: 4.99, source: "Tom Thumb" },
      { title: "Meyenberg Goat Milk", extractedPrice: 10.99, source: "Tom Thumb" }
    ],
    nearby_stores: ["Walmart", "H-E-B", "Target", "Sam's Club", "Albertsons", "Dollar General", "Kroger", "Tom Thumb"]
  };

  try {
    console.log('📦 Testing with improved algorithm...');
    console.log(`🏪 HasData results: ${testData.hasdata_results.length}`);
    console.log(`🏪 Nearby stores: ${testData.nearby_stores.length}`);
    
    const response = await fetch('http://192.168.1.10:8000/match-products-for-stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Improved algorithm results:');
    console.log(`📊 Total stores: ${result.total_stores}`);
    console.log(`✅ Matched stores: ${result.matched_stores}`);
    console.log(`🤖 Stores needing AI: ${result.ai_stores}`);
    console.log(`⏱️ Processing time: ${result.processing_time_ms}ms`);
    
    console.log('\n🏪 Store matches (should match more stores now):');
    for (const [storeName, match] of Object.entries(result.store_matches)) {
      const product = match.product;
      const confidence = match.confidence_ok ? '✅' : '⚠️';
      console.log(`  ${confidence} ${storeName}: ${product.title} - $${product.extractedPrice} (score: ${match.score.toFixed(3)})`);
    }
    
    console.log('\n🤖 Stores needing AI:');
    result.stores_needing_ai.forEach(store => {
      console.log(`  ${store}`);
    });
    
    console.log('\n📈 Expected improvements:');
    console.log('1. ✅ More stores should be matched (not just 3 out of 8)');
    console.log('2. ✅ All products per store should be shown in logs');
    console.log('3. ✅ Lower confidence threshold should catch more matches');
    console.log('4. ✅ Better query prioritization for "1 gallon" products');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Make sure Python service is running:');
    console.log('uvicorn product_matcher_service:app --host 0.0.0.0 --port 8000');
  }
};

testImprovedAlgorithm();
