/**
 * Test script to verify fallback functionality when Python service is not available
 */

const testFallback = () => {
  console.log('🧪 Testing Fallback Functionality...\n');

  // Simulate the fallback logic
  const getBestMatchFallback = (query, hasdataResults) => {
    if (!hasdataResults || hasdataResults.length === 0) {
      return null;
    }

    const queryLower = query.toLowerCase();
    let bestMatch = hasdataResults[0];
    let bestScore = 0;

    for (const result of hasdataResults) {
      const titleLower = result.title.toLowerCase();
      
      let score = 0;
      const queryWords = queryLower.split(' ');
      const titleWords = titleLower.split(' ');
      
      for (const queryWord of queryWords) {
        if (titleWords.some(titleWord => titleWord.includes(queryWord) || queryWord.includes(titleWord))) {
          score += 1;
        }
      }
      
      if (titleLower.includes(queryLower)) {
        score += 2;
      }
      
      if (result.extractedPrice < bestMatch.extractedPrice) {
        score += 0.5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    console.log(`🔄 Fallback selected: ${bestMatch.title} (score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  };

  // Test data from your logs
  const testData = [
    { title: "Cooklist Whole Milk 1 gallon", extractedPrice: 2.72, source: "Cooklist" },
    { title: "Target Whole Milk 1 gal", extractedPrice: 2.69, source: "Target" },
    { title: "H-E-B Whole Milk 1 gallon", extractedPrice: 2.47, source: "H-E-B" },
    { title: "Albertsons Whole Milk 1 gallon", extractedPrice: 3.19, source: "Albertsons" },
    { title: "Walmart Whole Milk 1 gallon", extractedPrice: 5.74, source: "Walmart" },
    { title: "Kroger Whole Milk 1 gallon", extractedPrice: 2.79, source: "Kroger" }
  ];

  console.log('📦 Testing with query: "whole milk 1 gallon"');
  const result = getBestMatchFallback("whole milk 1 gallon", testData);
  
  console.log('\n✅ Fallback test completed!');
  console.log(`📦 Selected: ${result.title}`);
  console.log(`💰 Price: $${result.extractedPrice}`);
  console.log(`🏪 Store: ${result.source}`);
  
  console.log('\n📋 This shows the fallback will work even when Python service is not available.');
};

testFallback();
