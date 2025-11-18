/**
 * Quick test to verify the new endpoint is working
 */

const testEndpoint = async () => {
  console.log('🧪 Testing new endpoint...\n');

  const testData = {
    query: "whole milk 1 gallon",
    hasdata_results: [
      { title: "Walmart Whole Milk 1 gallon", extractedPrice: 2.57, source: "Walmart" },
      { title: "Kroger Whole Milk 1 gallon", extractedPrice: 1.29, source: "Kroger" }
    ],
    nearby_stores: ["Kroger", "Walmart", "Target"]
  };

  try {
    const response = await fetch('http://192.168.1.10:8000/match-products-for-stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Endpoint working!');
      console.log(`Store matches: ${Object.keys(result.store_matches).length}`);
      console.log(`Stores needing AI: ${result.stores_needing_ai.length}`);
    } else {
      console.log('❌ Endpoint not working');
      const text = await response.text();
      console.log('Response:', text);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testEndpoint();
