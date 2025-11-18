#!/usr/bin/env python3
"""
Start Python service with proper network binding for React Native
"""

import uvicorn
import sys
import os

def start_service():
    print("🚀 Starting Python Product Matcher Service...")
    print("📡 Binding to all interfaces (0.0.0.0:8000)")
    print("🔗 React Native can connect via: http://192.168.1.10:8000")
    print("📱 Make sure your phone/emulator is on the same WiFi network")
    print("⏹️  Press Ctrl+C to stop the service")
    print("-" * 50)
    
    try:
        uvicorn.run(
            "product_matcher_service:app",
            host="0.0.0.0",  # Bind to all interfaces
            port=8000,
            reload=False,  # Disable reload for production
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"❌ Error starting service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_service()
