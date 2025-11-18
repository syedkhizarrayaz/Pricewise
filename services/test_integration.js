/**
 * Test script to verify Python service integration
 * Run this to test the complete flow
 */

const testIntegration = async () => {
  console.log('🧪 Testing Python Service Integration...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health check...');
  try {
    const healthResponse = await fetch('http://localhost:8000/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData.status);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: Product matching
  console.log('\n2️⃣ Testing product matching...');
  const testData = {
    query: "whole milk 1 gallon",
    hasdata_results: [
      {
        position: 1,
        title: "H-E-B Whole Milk",
        extractedPrice: 2.82,
        source: "H-E-B"
      },
      {
        position: 2,
        title: "Great Value Whole Milk with Vitamin D 1 gal",
        extractedPrice: 2.57,
        source: "Walmart"
      },
      {
        position: 3,
        title: "Good & Gather Whole Milk 1 gal",
        extractedPrice: 2.69,
        source: "Target"
      },
      {
        position: 4,
        title: "Lucerne Whole Milk 1 gallon",
        extractedPrice: 3.19,
        source: "Albertsons"
      }
    ]
  };

  try {
    const matchResponse = await fetch('http://localhost:8000/match-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const matchData = await matchResponse.json();
    console.log('✅ Product matching successful!');
    console.log('📦 Selected product:', matchData.selected_product?.title);
    console.log('💰 Price: $' + matchData.selected_product?.extractedPrice);
    console.log('🏪 Store:', matchData.selected_product?.source);
    console.log('📊 Score:', matchData.score.toFixed(3));
    console.log('✅ Confidence OK:', matchData.confidence_ok);
    console.log('⏱️ Processing time:', matchData.processing_time_ms + 'ms');
  } catch (error) {
    console.error('❌ Product matching failed:', error.message);
    return;
  }

  // Test 3: Different query
  console.log('\n3️⃣ Testing different query...');
  const testData2 = {
    query: "organic milk 1 gallon",
    hasdata_results: [
      {
        title: "Organic Valley Organic Whole Milk 1 gal",
        extractedPrice: 4.99,
        source: "Whole Foods"
      },
      {
        title: "Great Value Organic Whole Milk 1 gallon",
        extractedPrice: 3.99,
        source: "Walmart"
      }
    ]
  };

  try {
    const matchResponse2 = await fetch('http://localhost:8000/match-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData2)
    });

    const matchData2 = await matchResponse2.json();
    console.log('✅ Second test successful!');
    console.log('📦 Selected product:', matchData2.selected_product?.title);
    console.log('💰 Price: $' + matchData2.selected_product?.extractedPrice);
    console.log('📊 Score:', matchData2.score.toFixed(3));
  } catch (error) {
    console.error('❌ Second test failed:', error.message);
  }

  console.log('\n🎉 Integration test completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Start your React Native app');
  console.log('2. Search for grocery items');
  console.log('3. Check the logs to see Python service integration');
  console.log('4. Verify that HasData results are processed by Python service');
  console.log('5. Confirm remaining stores are sent to AI as usual');
};

// Run the test
testIntegration().catch(console.error);
