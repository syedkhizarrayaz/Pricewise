import axios from 'axios';

export interface PythonMatcherResponse {
  selected_product: any;
  score: number;
  confidence_ok: boolean;
  reason: string;
  all_candidates: any[];
  processing_time_ms: number;
}

export class PythonMatcherService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    this.timeout = 30000; // 30 seconds
  }

  async matchProducts(query: string, hasdataResults: any[]): Promise<PythonMatcherResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/match-products`,
        {
          query,
          hasdata_results: hasdataResults,
          conf_threshold: 0.30,
          tie_delta: 0.10
        },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ [PythonMatcher] Error:', error.message);
      throw new Error(`Python matcher service error: ${error.message}`);
    }
  }

  async matchProductsForStores(
    query: string,
    hasdataResults: any[],
    nearbyStores: string[]
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/match-products-for-stores`,
        {
          query,
          hasdata_results: hasdataResults,
          nearby_stores: nearbyStores
        },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ [PythonMatcher] Error:', error.message);
      throw new Error(`Python matcher service error: ${error.message}`);
    }
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const pythonMatcherService = new PythonMatcherService();

