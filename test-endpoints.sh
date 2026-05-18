#!/bin/bash

# Pricewise API Endpoint Test Script (Bash version)
# 
# Tests all backend and Python service endpoints
# 
# Usage:
#   ./test-endpoints.sh [backend-url] [python-url]
# 
# Examples:
#   ./test-endpoints.sh                                    # Uses defaults (localhost)
#   ./test-endpoints.sh http://localhost:3001             # Custom backend URL
#   ./test-endpoints.sh http://104.248.75.168:3001        # External backend
#   ./test-endpoints.sh http://localhost:3001 http://localhost:8000  # Both URLs
#   ./test-endpoints.sh http://104.248.75.168:3001 http://104.248.75.168:8000  # Both external

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse arguments
BACKEND_URL=${1:-"http://localhost:3001"}
PYTHON_URL=${2:-"http://localhost:8000"}

# Test counters
PASSED=0
FAILED=0

# Print header
echo -e "${BOLD}${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         Pricewise API Endpoint Test Suite                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "\n${BOLD}Configuration:${NC}"
echo -e "  Backend URL: ${BLUE}${BACKEND_URL}${NC}"
echo -e "  Python URL:  ${BLUE}${PYTHON_URL}${NC}"

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-"GET"}
    local data=${4:-""}
    
    echo -e "\n${CYAN}Testing:${NC} ${name}"
    echo -e "${BLUE}URL:${NC} ${url}"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            --max-time 30)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            --max-time 30)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: ${http_code})"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Status: ${http_code})"
        echo -e "${RED}Response:${NC} $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Backend Tests
echo -e "\n${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${MAGENTA}  BACKEND API TESTS${NC}"
echo -e "${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${NC}"

test_endpoint "Root Endpoint" "${BACKEND_URL}/"
test_endpoint "Health Check" "${BACKEND_URL}/api/health"
test_endpoint "Grocery Service Health" "${BACKEND_URL}/api/grocery/health"
test_endpoint "Analytics" "${BACKEND_URL}/api/analytics"
test_endpoint "Analytics Queries" "${BACKEND_URL}/api/analytics/queries?limit=10"
test_endpoint "Analytics Clean Cache" "${BACKEND_URL}/api/analytics/clean-cache" "POST"

# Grocery Search
SEARCH_PAYLOAD='{"items":["whole milk","bread"],"address":"123 Main St, Plano, TX 75074","zipCode":"75074","latitude":33.0198,"longitude":-96.6989,"nearbyStores":["Walmart","Kroger","Target"]}'
test_endpoint "Grocery Search" "${BACKEND_URL}/api/grocery/search" "POST" "$SEARCH_PAYLOAD"

SINGLE_ITEM_PAYLOAD='{"items":["milk"],"address":"Plano, TX 75074","zipCode":"75074"}'
test_endpoint "Grocery Search (Single Item)" "${BACKEND_URL}/api/grocery/search" "POST" "$SINGLE_ITEM_PAYLOAD"

# Python Service Tests
echo -e "\n${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${MAGENTA}  PYTHON SERVICE TESTS${NC}"
echo -e "${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${NC}"

test_endpoint "Python Service Health" "${PYTHON_URL}/health"

MATCH_PAYLOAD='{"query":"whole milk 1 gallon","hasdata_results":[{"position":1,"title":"Great Value Whole Milk 1 gal","extractedPrice":2.57,"source":"Walmart"},{"position":2,"title":"H-E-B Whole Milk 1 gallon","extractedPrice":2.82,"source":"H-E-B"}],"weights":{"token_set":0.50,"embed":0.30,"partial":0.15,"brand":0.05},"conf_threshold":0.30,"tie_delta":0.10}'
test_endpoint "Match Products" "${PYTHON_URL}/match-products" "POST" "$MATCH_PAYLOAD"

MATCH_STORES_PAYLOAD='{"query":"whole milk 1 gallon","hasdata_results":[{"position":1,"title":"Great Value Whole Milk 1 gal","extractedPrice":2.57,"source":"Walmart"},{"position":2,"title":"H-E-B Whole Milk 1 gallon","extractedPrice":2.82,"source":"H-E-B"}],"nearby_stores":["Walmart","Kroger","H-E-B"]}'
test_endpoint "Match Products for Stores" "${PYTHON_URL}/match-products-for-stores" "POST" "$MATCH_STORES_PAYLOAD"

# Summary
echo -e "\n${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${MAGENTA}  TEST SUMMARY${NC}"
echo -e "${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${NC}"

echo -e "\n${GREEN}Passed:${NC} ${PASSED}"
echo -e "${RED}Failed:${NC} ${FAILED}"
echo -e "Total: $((PASSED + FAILED))"

echo -e "\n${BOLD}Backend URL:${NC} ${BACKEND_URL}"
echo -e "${BOLD}Python URL:${NC} ${PYTHON_URL}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed.${NC}"
    exit 1
fi
