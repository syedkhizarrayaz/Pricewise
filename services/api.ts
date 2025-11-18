import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
// API configuration moved to config/api.ts
const OPENAI_API_URL = 'https://api.openai.com/v1';
const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api';

// API Keys (in production, these should be stored securely)
const OPENAI_API_KEY = 'your-openai-api-key'; // Replace with actual key
const GOOGLE_PLACES_API_KEY = 'your-google-places-api-key'; // Replace with actual key

// Create axios instances
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const openaiClient = axios.create({
  baseURL: OPENAI_API_URL,
  timeout: 15000,
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Store API - Removed old API calls, using Unwrangle and GPT services instead

// Location API - Removed old API calls, using Expo Location instead

// AI Integration API
export const aiAPI = {
  // Get price predictions using OpenAI
  getPricePredictions: async (items: string[], location: string) => {
    try {
      const response = await openaiClient.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a grocery price prediction expert. Analyze the current market trends and provide price predictions for grocery items in ${location}. Return only valid JSON with item names and predicted prices.`
          },
          {
            role: 'user',
            content: `Predict current prices for these items in ${location}: ${items.join(', ')}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error getting AI price predictions:', error);
      return null;
    }
  },

  // Analyze shopping list and suggest optimizations
  analyzeShoppingList: async (items: string[], budget: number, location: string) => {
    try {
      const response = await openaiClient.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a smart shopping assistant. Analyze the shopping list and provide optimization suggestions to stay within budget while getting the best value. Return JSON with suggestions, substitutions, and estimated savings.`
          },
          {
            role: 'user',
            content: `Analyze this shopping list for ${location} with a budget of $${budget}: ${items.join(', ')}`
          }
        ],
        temperature: 0.4,
        max_tokens: 1500
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error analyzing shopping list:', error);
      return null;
    }
  },

  // Extract items from image/text using AI
  extractItemsFromImage: async (imageBase64: string) => {
    try {
      const response = await openaiClient.post('/chat/completions', {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract grocery items from this image. Return only a JSON array of item names.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error extracting items from image:', error);
      return [];
    }
  }
};

// Product Search API
// Product API - Removed old API calls, using Unwrangle service instead

// User API - Removed old API calls, using local storage instead

// Mock data functions removed - using Unwrangle and GPT services instead

export default apiClient;
