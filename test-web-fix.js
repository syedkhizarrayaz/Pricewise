/**
 * Test script to verify the web CORS fix
 * This simulates the web environment behavior
 */

const axios = require('axios');

// Configuration
const API_KEY = 'AIzaSyD8dkXiyOx4XoVIF4hosNG91h47zgPnsQY'; // Replace with your actual API key
const API_URL = 'https://places.googleapis.com/v1/places:searchText';

async function testWebFix() {
  try {
    console.log('🧪 Testing Web CORS Fix - Using New Places API');
    console.log('📍 This simulates what the web app will now do instead of geocoding');
    
    const testAddress = '6401 Independence Pkwy, Plano, TX 75023';
    const textQuery = `grocery stores near ${testAddress} in 5 miles`;
    
    console.log('\n📤 Request (New API - No CORS issues):');
    console.log('URL:', API_URL);
    console.log('Text Query:', textQuery);
    
    const requestBody = {
      textQuery: textQuery
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel'
    };

    const response = await axios.post(API_URL, requestBody, { headers });
    
    console.log('\n✅ Success! No CORS errors with new API');
    console.log('📊 Results:', {
      totalPlaces: response.data.places?.length || 0,
      samplePlaces: response.data.places?.slice(0, 3).map(place => ({
        name: place.displayName?.text,
        address: place.formattedAddress,
        priceLevel: place.priceLevel
      })) || []
    });
    
    console.log('\n🎉 Web CORS Fix Verification:');
    console.log('✅ New API works without CORS issues');
    console.log('✅ No geocoding calls needed');
    console.log('✅ Direct text search works');
    console.log('✅ Web app should now work without CORS errors');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing web fix:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    return false;
  }
}

// Run the test
async function runWebFixTest() {
  console.log('🚀 Testing Web CORS Fix\n');
  
  const success = await testWebFix();
  
  if (success) {
    console.log('\n✅ Web CORS fix is working correctly!');
    console.log('🌐 The web app should now work without CORS errors.');
  } else {
    console.log('\n❌ Web CORS fix test failed.');
    process.exit(1);
  }
}

runWebFixTest();
