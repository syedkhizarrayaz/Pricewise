#!/usr/bin/env python3
"""
Startup script for the Product Matcher Service.

This script provides easy ways to start the service in different modes:
- Development mode with auto-reload
- Production mode with proper logging
- Docker mode
"""

import os
import sys
import subprocess
import argparse
import logging
from pathlib import Path

def setup_logging(level=logging.INFO):
    """Setup logging configuration."""
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('product_matcher.log')
        ]
    )

def check_dependencies():
    """Check if all required dependencies are installed."""
    required_packages = [
        'fastapi', 'uvicorn', 'pydantic', 'rapidfuzz', 
        'scikit-learn', 'sentence-transformers', 'numpy'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Install them with: pip install -r requirements.txt")
        return False
    
    print("✅ All required packages are installed")
    return True

def start_development():
    """Start the service in development mode with auto-reload."""
    print("🚀 Starting Product Matcher Service in development mode...")
    subprocess.run([
        "uvicorn", "product_matcher_service:app", 
        "--host", "0.0.0.0", 
        "--port", "8000",
        "--reload",
        "--log-level", "info"
    ])

def start_production():
    """Start the service in production mode."""
    print("🚀 Starting Product Matcher Service in production mode...")
    subprocess.run([
        "uvicorn", "product_matcher_service:app", 
        "--host", "0.0.0.0", 
        "--port", "8000",
        "--workers", "4",
        "--log-level", "warning"
    ])

def start_docker():
    """Build and run the service using Docker."""
    print("🐳 Building and starting Product Matcher Service with Docker...")
    
    # Build the Docker image
    build_cmd = ["docker", "build", "-t", "product-matcher-service", "."]
    print(f"Building image: {' '.join(build_cmd)}")
    subprocess.run(build_cmd, check=True)
    
    # Run the container
    run_cmd = [
        "docker", "run", "-d",
        "--name", "product-matcher-service",
        "-p", "8000:8000",
        "product-matcher-service"
    ]
    print(f"Running container: {' '.join(run_cmd)}")
    subprocess.run(run_cmd, check=True)
    
    print("✅ Service is running at http://localhost:8000")
    print("📊 Health check: http://localhost:8000/health")
    print("📚 API docs: http://localhost:8000/docs")

def test_service():
    """Test the service with example data."""
    import requests
    import json
    
    # Example test data
    test_data = {
        "query": "whole milk 1 gallon",
        "hasdata_results": [
            {
                "position": 1,
                "title": "H-E-B Whole Milk",
                "extractedPrice": 2.82,
                "source": "H-E-B",
            },
            {
                "position": 2,
                "title": "Great Value Whole Milk with Vitamin D 1 gal",
                "extractedPrice": 2.57,
                "source": "Walmart",
            },
            {
                "position": 3,
                "title": "Good & Gather Whole Milk 1 gal",
                "extractedPrice": 2.69,
                "source": "Target",
            }
        ]
    }
    
    try:
        response = requests.post(
            "http://localhost:8000/match-products",
            json=test_data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Service test successful!")
            print(f"Selected product: {result['selected_product']['title']}")
            print(f"Score: {result['score']:.3f}")
            print(f"Confidence OK: {result['confidence_ok']}")
        else:
            print(f"❌ Service test failed: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to service. Make sure it's running on port 8000.")
    except Exception as e:
        print(f"❌ Test failed: {e}")

def main():
    parser = argparse.ArgumentParser(description="Product Matcher Service Startup Script")
    parser.add_argument(
        "mode", 
        choices=["dev", "prod", "docker", "test"], 
        help="Startup mode: dev (development), prod (production), docker (Docker), test (test service)"
    )
    parser.add_argument("--check-deps", action="store_true", help="Check dependencies before starting")
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging()
    
    # Check dependencies if requested
    if args.check_deps and not check_dependencies():
        sys.exit(1)
    
    # Start based on mode
    if args.mode == "dev":
        start_development()
    elif args.mode == "prod":
        start_production()
    elif args.mode == "docker":
        start_docker()
    elif args.mode == "test":
        test_service()

if __name__ == "__main__":
    main()
