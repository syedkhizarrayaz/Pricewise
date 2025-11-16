/**
 * Test script for the new Google Places API implementation
 * This script tests the searchText endpoint directly
 */

const axios = require('axios');

// Configuration
const API_KEY = 'AIzaSyD8dkXiyOx4XoVIF4hosNG91h47zgPnsQY'; // Replace with your actual API key
const API_URL = 'https://places.googleapis.com/v1/places:searchText';

async function testSearchGroceryStores() {
  try {
    console.log('🧪 Testing Google Places API (New) - searchText endpoint');
    
    const testAddress = '6401 Independence Pkwy, Plano, TX 75023';
    const textQuery = `grocery stores near ${testAddress} in 5 miles`;
    
    const requestBody = {
      textQuery: textQuery
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel'
    };

    console.log('📤 Request:', {
      url: API_URL,
      textQuery: textQuery,
      headers: {
        'Content-Type': headers['Content-Type'],
        'X-Goog-Api-Key': API_KEY.substring(0, 10) + '...',
        'X-Goog-FieldMask': headers['X-Goog-FieldMask']
      }
    });

    const response = await axios.post(API_URL, requestBody, { headers });
    
    console.log('✅ Success! Response received');
    console.log('📊 Results:', {
      totalPlaces: response.data.places?.length || 0,
      places: response.data.places?.map(place => ({
        name: place.displayName?.text,
        address: place.formattedAddress,
        priceLevel: place.priceLevel
      })) || []
    });
    
    return response.data.places || [];
    
  } catch (error) {
    console.error('❌ Error testing Google Places API:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error;
  }
}

async function testMajorStoresInState() {
  try {
    console.log('\n🧪 Testing major stores in state search');
    
    const state = 'Texas';
    const chain = 'Walmart';
    const textQuery = `${chain} grocery store ${state} US`;
    
    const requestBody = {
      textQuery: textQuery
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress'
    };

    console.log('📤 Request:', {
      textQuery: textQuery,
      chain: chain,
      state: state
    });

    const response = await axios.post(API_URL, requestBody, { headers });
    
    console.log('✅ Success! Response received');
    console.log('📊 Results:', {
      totalPlaces: response.data.places?.length || 0,
      places: response.data.places?.map(place => ({
        name: place.displayName?.text,
        address: place.formattedAddress
      })) || []
    });
    
    return response.data.places || [];
    
  } catch (error) {
    console.error('❌ Error testing major stores search:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Google Places API (New) Tests\n');
  
  try {
    // Test 1: Search for grocery stores near address
    await testSearchGroceryStores();
    
    // Test 2: Search for major stores in state
    await testMajorStoresInState();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('🎉 The new Google Places API implementation is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
