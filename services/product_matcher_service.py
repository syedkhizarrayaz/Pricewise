"""
FastAPI service for intelligent product matching from HasData responses.

This service implements a comprehensive product matching algorithm that:
- Normalizes and parses product titles and user queries
- Extracts volume/unit information and converts to standard units
- Computes multiple similarity signals (fuzzy matching, embeddings, etc.)
- Uses weighted scoring to find the best product matches
- Handles tie-breaking by price-per-unit when multiple good matches exist

API Endpoints:
- POST /match-products: Match products from HasData response
- GET /health: Health check endpoint

Dependencies:
    pip install fastapi uvicorn rapidfuzz scikit-learn sentence-transformers numpy python-dotenv
    
Environment Variables:
    Create a .env file in the services/ directory or workspace root with:
    OPENAI_API_KEY=your-openai-api-key-here
"""

import re
import os
import json
import time
from urllib import request as urlrequest, error as urlerror
import math
import logging
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime

# FastAPI imports
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# try imports that may be optional
try:
    from rapidfuzz import fuzz
except ImportError:
    raise ImportError("rapidfuzz is required. Install with: pip install rapidfuzz")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    raise ImportError("scikit-learn is required. Install with: pip install scikit-learn")

# Optional embeddings for better semantic matching
USE_EMBEDDINGS = True
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
except ImportError:
    USE_EMBEDDINGS = False
    _EMBED_MODEL = None
    logging.warning("sentence-transformers not available, using TF-IDF fallback")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to load .env file if python-dotenv is available (after logger is set up)
try:
    from dotenv import load_dotenv
    # Load .env from current directory (services/) and parent directory (workspace root)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    # Try loading from services/.env first, then from workspace root/.env
    env_loaded = False
    services_env = os.path.join(current_dir, '.env')
    root_env = os.path.join(parent_dir, '.env')
    
    if os.path.exists(services_env):
        load_dotenv(services_env)
        logger.info(f"✅ Loaded .env from services directory: {services_env}")
        env_loaded = True
    if os.path.exists(root_env):
        load_dotenv(root_env, override=False)  # Don't override if already loaded
        logger.info(f"✅ Loaded .env from workspace root: {root_env}")
        env_loaded = True
    
    if env_loaded:
        # Verify OPENAI_API_KEY is loaded
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            logger.info(f"✅ OPENAI_API_KEY found in environment (length: {len(api_key)} chars)")
        else:
            logger.warning("⚠️ OPENAI_API_KEY not found in .env file(s)")
    else:
        logger.info("ℹ️ No .env file found (checked services/ and workspace root/)")
except ImportError:
    # python-dotenv not installed, skip .env loading
    logger.warning("💡 Install python-dotenv to load .env files: pip install python-dotenv")
except Exception as e:
    logger.warning(f"⚠️ Could not load .env file: {e}")

# Initialize FastAPI app
app = FastAPI(
    title="Product Matcher Service",
    description="Intelligent product matching from HasData responses",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------ Pydantic Models ------------------------

class ProductMatchRequest(BaseModel):
    query: str = Field(..., description="User search query (e.g., 'whole milk 1 gallon')")
    hasdata_results: List[Dict[str, Any]] = Field(..., description="HasData API response results")
    weights: Optional[Dict[str, float]] = Field(None, description="Custom scoring weights")
    conf_threshold: float = Field(0.55, description="Confidence threshold for matches")
    tie_delta: float = Field(0.05, description="Tie-breaking threshold")

class ProductMatchResponse(BaseModel):
    selected_product: Optional[Dict[str, Any]] = Field(None, description="Best matching product")
    score: float = Field(0.0, description="Match confidence score")
    confidence_ok: bool = Field(False, description="Whether match meets confidence threshold")
    reason: str = Field("", description="Reason for selection")
    all_candidates: List[Dict[str, Any]] = Field([], description="All candidates with scores")
    processing_time_ms: float = Field(0.0, description="Processing time in milliseconds")

class HealthResponse(BaseModel):
    status: str = Field("healthy", description="Service status")
    timestamp: datetime = Field(default_factory=datetime.now)
    embeddings_available: bool = Field(False, description="Whether embeddings are available")

# ------------------------ Core Matching Functions ------------------------

def normalize_text(s: str) -> str:
    """Lowercase, remove excessive punctuation, unify whitespace.
    Keep ampersand (&) and dash and digits (useful for quantities).
    """
    if not s:
        return ""
    s = s.lower()
    # replace common unicode punctuation with ascii
    s = s.replace('\u2013', '-').replace('\u2014', '-').replace('\u2019', "'")
    # keep letters, numbers, spaces, ampersand, %, ., and -
    s = re.sub(r"[^a-z0-9 &%().,-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def parse_volume_to_liters(title: str) -> Optional[float]:
    """Try to extract volume/size from a product title and convert to liters.
    Returns liters (float) if found, otherwise None.

    Handles:
      - gallons, gal
      - fl oz, oz
      - liters/litre, l, ml
      - quart (qt)
      - pint
    """
    t = title.lower()

    # gallons: 1 gal, 0.5 gal, 1 gallon
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:gal|gallon|gallons)\b", t)
    if m:
        return float(m.group(1)) * 3.78541

    # fluid ounces: 128 fl oz, 16 fl oz, just "128 oz" often used
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:fl\s*oz|fluid\s*oz|oz)\b", t)
    if m:
        return float(m.group(1)) * 0.0295735

    # liters or milliliters
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:l|litre|liter|liters)\b", t)
    if m:
        return float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:ml|milliliter|millilitre|milliliters)\b", t)
    if m:
        return float(m.group(1)) / 1000.0

    # quarts
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:qt|quart|quarts)\b", t)
    if m:
        return float(m.group(1)) * 0.946353

    # pints
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:pt|pint|pints)\b", t)
    if m:
        return float(m.group(1)) * 0.473176

    # fallback: match patterns like '1 gallon' written as '1gal' (no space)
    m = re.search(r"(\d+(?:\.\d+)?)(gal|gallon|gallons)\b", t)
    if m:
        return float(m.group(1)) * 3.78541

    return None

def parse_volume_to_liters_from_quantity_string(quantity_text: Optional[str]) -> Optional[float]:
    """Parse a quantity string like '40 fl oz' to liters using the same rules."""
    if not quantity_text:
        return None
    try:
        return parse_volume_to_liters(str(quantity_text))
    except Exception:
        return None

def markdown_to_json(text: str) -> str:
    """Strip markdown code fences from a string that should contain JSON."""
    if not text:
        return text
    # Remove triple backticks blocks
    text = re.sub(r"^\s*```[a-zA-Z]*\s*", "", text.strip())
    text = re.sub(r"\s*```\s*$", "", text.strip())
    return text.strip()

def call_openai_extract_components(query: str, timeout_seconds: int = 12) -> Optional[Dict[str, Optional[str]]]:
    """
    Call OpenAI to identify brand, item and quantity in the user's query.
    Returns dict: {"brand": str|None, "item": str|None, "quantity": str|None}

    Requires OPENAI_API_KEY in environment.
    Gracefully returns None on any error.
    """
    # Use the exact prompt format as specified by the user
    prompt = f"identify brand, item and quantity in this: {query}"

    body = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You extract structured fields from product queries. Return JSON with keys: Brand, Item, Quantity. Use null if unknown."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},  # Request structured JSON output
        "temperature": 0,
    }

    # Always log the request details for debugging
    logger.info(f"📤 OpenAI API Request:")
    logger.info(f"   URL: https://api.openai.com/v1/chat/completions")
    logger.info(f"   Model: {body['model']}")
    logger.info(f"   Prompt: {prompt}")
    logger.info(f"   System Message: {body['messages'][0]['content']}")
    logger.info(f"   Request Body: {json.dumps(body, indent=2)}")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("🔒 OPENAI_API_KEY not set; skipping LLM extraction")
        logger.info("💡 To enable LLM extraction, set the OPENAI_API_KEY environment variable")
        return None

    req = urlrequest.Request(
        url="https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        logger.info(f"🚀 Making OpenAI API call...")
        with urlrequest.urlopen(req, timeout=timeout_seconds) as resp:
            response_data = resp.read().decode("utf-8")
            payload = json.loads(response_data)
            
            # Log the full response for debugging
            logger.info(f"📥 OpenAI API Response Status: {resp.status}")
            logger.info(f"📥 OpenAI API Response: {json.dumps(payload, indent=2)}")
            
            content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
            logger.info(f"📝 Raw LLM Content: {content}")
            
            content = markdown_to_json(content)
            logger.info(f"📝 Cleaned LLM Content: {content}")
            
            try:
                parsed = json.loads(content)
                logger.info(f"✅ Successfully parsed JSON: {parsed}")
            except Exception as json_error:
                logger.warning(f"⚠️ Failed to parse as JSON: {json_error}")
                # Try to coerce simple bullet style the user showed into json
                # Fallback heuristic parse
                brand = None
                item = None
                quantity = None
                for line in content.splitlines():
                    m = re.match(r"\s*\*\s*Brand:\s*(.+)", line, re.I)
                    if m:
                        brand = m.group(1).strip() or None
                    m = re.match(r"\s*\*\s*Item:\s*(.+)", line, re.I)
                    if m:
                        item = m.group(1).strip() or None
                    m = re.match(r"\s*\*\s*Quantity:\s*(.+)", line, re.I)
                    if m:
                        quantity = m.group(1).strip() or None
                parsed = {"brand": brand, "item": item, "quantity": quantity}
                logger.info(f"📋 Fallback parsed: {parsed}")

            # Handle both lowercase and capitalized keys (Brand, Item, Quantity)
            if isinstance(parsed, dict):
                brand = parsed.get("brand") or parsed.get("Brand")
                item = parsed.get("item") or parsed.get("Item")
                quantity = parsed.get("quantity") or parsed.get("Quantity")
            else:
                brand = None
                item = None
                quantity = None

            # Normalize blanks
            def nz(x):
                if x is None:
                    return None
                xs = str(x).strip()
                return xs if xs else None

            result = {"brand": nz(brand), "item": nz(item), "quantity": nz(quantity)}
            logger.info(f"🤖 LLM extracted components: {result}")
            return result
    except urlerror.HTTPError as e:
        try:
            error_body = e.read().decode("utf-8")
            error_json = json.loads(error_body) if error_body else {}
        except Exception:
            error_body = str(e)
            error_json = {}
        logger.error(f"❌ OpenAI HTTP Error {e.code}: {e.reason}")
        logger.error(f"❌ Error Response: {json.dumps(error_json, indent=2) if error_json else error_body}")
        return None
    except urlerror.URLError as e:
        logger.error(f"❌ OpenAI URL Error: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ OpenAI extraction error: {e}", exc_info=True)
        return None

def title_contains_token(title_lower: str, token: Optional[str]) -> bool:
    if not token:
        return False
    return token.lower() in title_lower

def title_matches_quantity_liters(title: str, desired_liters: Optional[float], tolerance: float = 0.15) -> bool:
    if desired_liters is None:
        return False
    liters_in_title = parse_volume_to_liters(title)
    if liters_in_title is None:
        return False
    # within tolerance (e.g., 15%)
    diff = abs(liters_in_title - desired_liters)
    return diff <= (tolerance * desired_liters)

def pick_lowest_price(products: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    priced = [p for p in products if isinstance(p.get("extractedPrice"), (int, float))]
    if not priced:
        return None
    return min(priced, key=lambda x: float(x.get("extractedPrice", 9e9)))

def select_by_priority_conditions(store_products: List[Dict[str, Any]], item: Optional[str], brand: Optional[str], quantity_liters: Optional[float]) -> Optional[Dict[str, Any]]:
    """
    Implements the four cases and their priority matching conditions.
    Returns the selected product or None if no match.
    """
    titles = [(p, p.get("title", ""), p.get("title", "").lower()) for p in store_products]

    def filt(cond_fn):
        return [p for (p, t, tl) in titles if cond_fn(p, t, tl)]

    has_item = bool(item)
    has_brand = bool(brand)
    has_qty = quantity_liters is not None

    # Highest priority case: brand AND item AND quantity
    if has_item and has_brand and has_qty:
        # 1) item AND brand AND quantity
        r = filt(lambda p, t, tl: title_contains_token(tl, item) and title_contains_token(tl, brand) and title_matches_quantity_liters(t, quantity_liters))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 2) (item OR brand) AND quantity
        r = filt(lambda p, t, tl: (title_contains_token(tl, item) or title_contains_token(tl, brand)) and title_matches_quantity_liters(t, quantity_liters))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 3) item AND (brand OR quantity)
        r = filt(lambda p, t, tl: title_contains_token(tl, item) and (title_contains_token(tl, brand) or title_matches_quantity_liters(t, quantity_liters)))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 4) item OR brand OR quantity
        r = filt(lambda p, t, tl: title_contains_token(tl, item) or title_contains_token(tl, brand) or title_matches_quantity_liters(t, quantity_liters))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 5) fallback: cheapest overall
        return pick_lowest_price(store_products)

    # Second case: item AND brand
    if has_item and has_brand and not has_qty:
        # 1) item AND brand
        r = filt(lambda p, t, tl: title_contains_token(tl, item) and title_contains_token(tl, brand))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 2) item OR brand
        r = filt(lambda p, t, tl: title_contains_token(tl, item) or title_contains_token(tl, brand))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 3) fallback: cheapest
        return pick_lowest_price(store_products)

    # Third case: item AND quantity
    if has_item and has_qty and not has_brand:
        # 1) item AND quantity
        r = filt(lambda p, t, tl: title_contains_token(tl, item) and title_matches_quantity_liters(t, quantity_liters))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 2) item OR quantity
        r = filt(lambda p, t, tl: title_contains_token(tl, item) or title_matches_quantity_liters(t, quantity_liters))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        # 3) fallback: cheapest
        return pick_lowest_price(store_products)

    # Fourth case: only one of item/brand/quantity present
    if has_item or has_brand or has_qty:
        r = filt(lambda p, t, tl: (
            (has_item and title_contains_token(tl, item)) or
            (has_brand and title_contains_token(tl, brand)) or
            (has_qty and title_matches_quantity_liters(t, quantity_liters))
        ))
        pick = pick_lowest_price(r)
        if pick:
            return pick
        return pick_lowest_price(store_products)

    # Nothing present; do not select here
    return None

def compute_price_per_liter(price: float, liters: Optional[float]) -> Optional[float]:
    """Compute price per liter for unit-based comparison."""
    if liters is None or liters == 0:
        return None
    return price / liters

def token_set_score(q: str, title: str) -> float:
    """RapidFuzz token_set_ratio normalized to 0..1"""
    return fuzz.token_set_ratio(q, title) / 100.0

def partial_score(q: str, title: str) -> float:
    """Partial ratio normalized"""
    return fuzz.partial_ratio(q, title) / 100.0

def embedding_score(q: str, title: str) -> float:
    """Return cosine similarity via SBERT if available; else return 0.0
    Normalized to 0..1 where 0 = orthogonal and 1 = identical.
    """
    if not USE_EMBEDDINGS or _EMBED_MODEL is None:
        return 0.0
    try:
        q_vec = _EMBED_MODEL.encode([q])[0]
        t_vec = _EMBED_MODEL.encode([title])[0]
        # cosine similarity
        dot = float((q_vec * t_vec).sum())
        qn = float((q_vec * q_vec).sum()) ** 0.5
        tn = float((t_vec * t_vec).sum()) ** 0.5
        if qn == 0 or tn == 0:
            return 0.0
        cos = dot / (qn * tn)
        # clip
        cos = max(-1.0, min(1.0, cos))
        # map from [-1,1] to [0,1]
        return (cos + 1.0) / 2.0
    except Exception as e:
        logger.warning(f"Embedding computation failed: {e}")
        return 0.0

def tfidf_scores(query: str, titles: List[str]) -> List[float]:
    """TF-IDF fallback for embedding when embeddings not available"""
    if not titles:
        return []
    try:
        vec = TfidfVectorizer().fit(titles + [query])
        tmat = vec.transform(titles)
        qvec = vec.transform([query])
        sims = cosine_similarity(qvec, tmat)[0]
        return [float(s) for s in sims]
    except Exception as e:
        logger.warning(f"TF-IDF computation failed: {e}")
        return [0.0] * len(titles)

def compute_features_for_candidate(query: str, candidate: Dict[str, Any]) -> Dict[str, Any]:
    """Compute all features for a single candidate product."""
    title = normalize_text(candidate.get("title", ""))
    q = normalize_text(query)

    tok_set = token_set_score(q, title)
    part = partial_score(q, title)
    emb = embedding_score(q, title) if USE_EMBEDDINGS else 0.0

    # price & unit
    price = candidate.get("extractedPrice")
    liters = parse_volume_to_liters(candidate.get("title", ""))
    p_per_l = compute_price_per_liter(price, liters) if price is not None else None

    # attribute matches (brand naive): check if brand token exists in title
    brand = candidate.get("source")
    brand_match = 1.0 if brand and brand.lower() in title else 0.0

    return {
        "candidate": candidate,
        "title_norm": title,
        "token_set": tok_set,
        "partial": part,
        "embed": emb,
        "price": price,
        "liters": liters,
        "price_per_liter": p_per_l,
        "brand_match": brand_match,
    }

def normalize_component(x: Optional[float], default: float = 0.0) -> float:
    """Normalize component to 0-1 range."""
    if x is None:
        return default
    if math.isnan(x):
        return default
    return float(max(0.0, min(1.0, x)))

def compute_final_score(feat: Dict[str, Any], weights: Dict[str, float]) -> float:
    """Compute final weighted score from features."""
    # ensure normalized pieces
    token = normalize_component(feat.get("token_set", 0.0))
    part = normalize_component(feat.get("partial", 0.0))
    emb = normalize_component(feat.get("embed", 0.0))
    brand = normalize_component(feat.get("brand_match", 0.0))

    # Heavily weight query matching - this is the most important factor
    score = (
        weights.get("token_set", 0.50) * token  # Increased from 0.35 to 0.50
        + weights.get("embed", 0.30) * emb     # Increased from 0.25 to 0.30
        + weights.get("partial", 0.15) * part  # Keep same
        + weights.get("brand", 0.05) * brand   # Reduced from 0.10 to 0.05
    )
    return float(score)

def is_general_query(query: str) -> bool:
    """
    Advanced query classification using NLP techniques to detect general vs specific queries.
    Uses pattern recognition, semantic analysis, and heuristics for production-level accuracy.
    """
    import re
    from collections import Counter
    
    query_lower = query.lower().strip()
    query_words = query_lower.split()
    
    # Skip empty or very short queries
    if len(query_words) < 1:
        return True
    
    # Advanced pattern detection for specific indicators
    specific_patterns = {
        # Brand indicators (using regex for better matching)
        'brand_indicators': [
            r'\b(organic|premium|luxury|premium|name\s+brand|store\s+brand|generic)\b',
            r'\b(ariel|tide|gain|downy|persil|arm\s*&?\s*hammer|all|cheer)\b',  # Common detergent brands
            r'\b(great\s+value|kirkland|members\s+mark|store\s+brand)\b',  # Store brands
        ],
        
        # Quantity/size indicators
        'quantity_indicators': [
            r'\b\d+\s*(gallon|gal|liter|l|oz|ounce|pound|lb|kg|gram|g|ml|fl\s*oz)\b',
            r'\b(half|quarter|double|triple|single|family\s+size|bulk|jumbo|mini)\b',
            r'\b\d+\s*(pack|count|ct|piece|pc)\b',
        ],
        
        # Quality/type indicators
        'quality_indicators': [
            r'\b(whole|2%|1%|skim|low\s+fat|non\s+fat|fat\s+free|lactose\s+free)\b',
            r'\b(organic|natural|premium|ultra|concentrated|heavy\s+duty)\b',
            r'\b(original|classic|traditional|new|improved|advanced)\b',
        ],
        
        # Specific product variants
        'variant_indicators': [
            r'\b(powder|liquid|gel|pods|capsules|tablets|bars)\b',
            r'\b(unscented|fragrance\s+free|scented|fresh|clean)\b',
            r'\b(color\s+safe|stain\s+removal|whitening|brightening)\b',
        ]
    }
    
    # Check for specific patterns
    for category, patterns in specific_patterns.items():
        for pattern in patterns:
            if re.search(pattern, query_lower):
                logger.info(f"🔍 Specific query detected: '{query}' matches {category} pattern: {pattern}")
                return False
    
    # Advanced heuristics for general query detection
    
    # 1. Query length analysis
    if len(query_words) == 1:
        # Single word queries are likely general (milk, bread, detergent)
        logger.info(f"🎯 Single word query detected: '{query}' - likely general")
        return True
    
    # 2. Semantic density analysis
    # Count meaningful words vs filler words
    meaningful_words = [word for word in query_words if len(word) > 2 and word not in ['the', 'and', 'or', 'for', 'with', 'in', 'on', 'at']]
    if len(meaningful_words) <= 2:
        logger.info(f"🎯 Low semantic density: '{query}' - likely general")
        return True
    
    # 3. Product category detection
    # Check if query contains only basic product categories
    basic_categories = {
        'dairy': ['milk', 'cheese', 'butter', 'yogurt', 'cream'],
        'grains': ['bread', 'cereal', 'rice', 'pasta', 'flour'],
        'proteins': ['chicken', 'beef', 'fish', 'eggs', 'meat'],
        'beverages': ['water', 'juice', 'soda', 'coffee', 'tea'],
        'cleaning': ['detergent', 'soap', 'shampoo', 'toothpaste'],
        'snacks': ['chips', 'cookies', 'crackers', 'nuts'],
        'fruits': ['apples', 'bananas', 'oranges', 'fruits'],
        'vegetables': ['carrots', 'lettuce', 'tomatoes', 'vegetables']
    }
    
    query_category = None
    for category, terms in basic_categories.items():
        if any(term in query_lower for term in terms):
            query_category = category
            break
    
    if query_category and len(query_words) <= 3:
        logger.info(f"🎯 Basic category query: '{query}' in {query_category} - likely general")
        return True
    
    # 4. Numerical content analysis
    # Queries with numbers are often specific (1 gallon, 2% milk, etc.)
    if re.search(r'\d+', query_lower):
        logger.info(f"🔍 Numerical content detected: '{query}' - likely specific")
        return False
    
    # 5. Adjective/adverb density
    # Queries with many descriptive words are likely specific
    descriptive_words = ['organic', 'premium', 'fresh', 'natural', 'original', 'ultra', 'concentrated', 'heavy', 'light', 'free', 'safe']
    descriptive_count = sum(1 for word in query_words if word in descriptive_words)
    
    if descriptive_count > 0:
        logger.info(f"🔍 Descriptive words detected: '{query}' ({descriptive_count} words) - likely specific")
        return False
    
    # 6. Default to general for simple queries
    if len(query_words) <= 3:
        logger.info(f"🎯 Simple query: '{query}' - defaulting to general")
        return True
    
    # 7. Complex queries are likely specific
    logger.info(f"🔍 Complex query: '{query}' - likely specific")
    return False

def find_cheapest_relevant_product(query: str, products: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Advanced product filtering and selection for general queries.
    Uses semantic matching and intelligent filtering to find the most relevant cheapest product.
    """
    import re
    from difflib import SequenceMatcher
    
    query_lower = query.lower().strip()
    query_words = set(query_lower.split())
    
    # Advanced product filtering with multiple strategies
    relevant_products = []
    
    for product in products:
        title = product.get("title", "").lower()
        score = 0
        
        # Strategy 1: Exact word matching (balanced priority)
        title_words = set(title.split())
        exact_matches = query_words.intersection(title_words)
        if exact_matches:
            score += len(exact_matches) * 5  # Reduced from 10 to 5
        
        # Strategy 2: Partial word matching (medium priority)
        for query_word in query_words:
            if len(query_word) > 2:  # Skip short words
                for title_word in title.split():
                    if query_word in title_word or title_word in query_word:
                        score += 5
        
        # Strategy 3: Semantic similarity for product categories
        category_synonyms = {
            'detergent': ['laundry', 'washing', 'cleaning', 'soap'],
            'milk': ['dairy', 'cream', 'lactose'],
            'bread': ['loaf', 'baked', 'grain'],
            'chicken': ['poultry', 'meat', 'protein'],
            'cheese': ['dairy', 'dairy product'],
            'eggs': ['poultry', 'protein', 'shell'],
            'cooking oil': ['oil', 'vegetable oil', 'canola', 'olive', 'sunflower', 'avocado', 'grapeseed'],
            'oil': ['cooking', 'vegetable', 'canola', 'olive', 'sunflower', 'avocado', 'grapeseed', 'algae'],
        }
        
        for query_word in query_words:
            if query_word in category_synonyms:
                for synonym in category_synonyms[query_word]:
                    if synonym in title:
                        score += 3
        
        # Strategy 4: Brand name filtering (avoid if query doesn't mention brand)
        brand_indicators = ['ariel', 'tide', 'gain', 'downy', 'persil', 'arm & hammer', 'all', 'cheer']
        has_brand_in_title = any(brand in title for brand in brand_indicators)
        has_brand_in_query = any(brand in query_lower for brand in brand_indicators)
        
        # If query doesn't mention brand but product has brand, reduce score
        if has_brand_in_title and not has_brand_in_query:
            score -= 2
        
        # Strategy 5: Size/quantity filtering
        # If query doesn't specify size, prefer standard sizes
        size_indicators = ['gallon', 'gal', 'liter', 'oz', 'pound', 'lb', 'kg', 'gram']
        has_size_in_query = any(size in query_lower for size in size_indicators)
        has_size_in_title = any(size in title for size in size_indicators)
        
        # If query doesn't specify size, prefer products without specific sizes
        if not has_size_in_query and not has_size_in_title:
            score += 1
        
        # Only include products with positive relevance score
        if score > 0:
            product['relevance_score'] = score
            relevant_products.append(product)
    
    if not relevant_products:
        logger.info(f"❌ No relevant products found for query: '{query}'")
        return None
    
    # For general queries, prioritize price over relevance score
    # Sort by price first, then by relevance score
    relevant_products.sort(key=lambda x: (float(x.get("extractedPrice", 999)), -x.get('relevance_score', 0)))
    
    # Log the selection process with all relevant products
    logger.info(f"🔍 Relevant products for '{query}' (sorted by price):")
    for i, product in enumerate(relevant_products[:5]):  # Show top 5
        logger.info(f"  {i+1}. {product.get('title', 'Unknown')} - ${product.get('extractedPrice', 0)} (relevance: {product.get('relevance_score', 0)})")
    
    top_product = relevant_products[0]
    logger.info(f"💰 Selected cheapest relevant product: {top_product.get('title', 'Unknown')} - ${top_product.get('extractedPrice', 0)} (relevance: {top_product.get('relevance_score', 0)})")
    
    return top_product

def select_best_product(query: str, hasdata_results: List[Dict[str, Any]],
                        weights: Optional[Dict[str, float]] = None,
                        conf_threshold: float = 0.30,  # Lowered default threshold
                        tie_delta: float = 0.10) -> Dict[str, Any]:  # Increased tie delta
    """Main product selection algorithm."""
    if weights is None:
        weights = {"token_set": 0.50, "embed": 0.30, "partial": 0.15, "brand": 0.05}

    # Check if this is a general query - if so, prioritize cheapest products
    is_general = is_general_query(query)
    
    if is_general:
        logger.info(f"🎯 General query detected: '{query}' - prioritizing cheapest products")
        # For general queries, sort by price and return cheapest relevant product
        cheapest_match = find_cheapest_relevant_product(query, hasdata_results)
        if cheapest_match:
            return {
                "selected": cheapest_match,
                "score": 0.95,  # High score for cheapest in general query
                "confidence_ok": True,
                "reason": "general_query_cheapest",
                "all_candidates": [{"candidate": cheapest_match, "score": 0.95, "price": cheapest_match.get("extractedPrice", 0)}],
            }
        else:
            return {"selected": None, "reason": "no_relevant_products_for_general_query"}

    feats = [compute_features_for_candidate(query, c) for c in hasdata_results]

    # If embeddings disabled, compute TF-IDF embedding substitutes
    if not USE_EMBEDDINGS:
        titles = [f["title_norm"] for f in feats]
        tfidf_sims = tfidf_scores(normalize_text(query), titles)
        for f, s in zip(feats, tfidf_sims):
            f["embed"] = s

    # compute scores
    for f in feats:
        f["score"] = compute_final_score(f, weights)

    # sort by score desc
    feats.sort(key=lambda x: x["score"], reverse=True)

    if not feats:
        return {"selected": None, "reason": "no_candidates"}

    top_score = feats[0]["score"]
    # collect near-top candidates
    near_top = [f for f in feats if (top_score - f["score"]) <= tie_delta]

    # if multiple near_top, prefer the one with explicit price_per_liter (lowest) else absolute price
    if len(near_top) > 1:
        # prefer candidates with price_per_liter defined
        with_ppl = [f for f in near_top if f.get("price_per_liter") is not None]
        if with_ppl:
            # choose min price_per_liter
            chosen = min(with_ppl, key=lambda x: x["price_per_liter"])
            reason = "tie_broken_by_price_per_liter"
        else:
            # fallback to absolute price
            candidates_with_price = [f for f in near_top if f.get("price") is not None]
            if candidates_with_price:
                chosen = min(candidates_with_price, key=lambda x: x["price"])
                reason = "tie_broken_by_abs_price"
            else:
                chosen = near_top[0]
                reason = "tie_kept_top"
    else:
        chosen = near_top[0]
        reason = "top_single"

    confidence = chosen["score"]
    low_confidence = confidence < conf_threshold

    return {
        "selected": chosen.get("candidate"),
        "score": chosen.get("score"),
        "confidence_ok": not low_confidence,
        "reason": reason,
        "all_candidates": feats,
    }

# ------------------------ API Endpoints ------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        embeddings_available=USE_EMBEDDINGS
    )

@app.post("/match-products", response_model=ProductMatchResponse)
async def match_products(request: ProductMatchRequest):
    """
    Match products from HasData response to user query.
    
    This endpoint implements intelligent product matching using:
    - Fuzzy string matching (RapidFuzz)
    - Semantic embeddings (Sentence-BERT)
    - Unit parsing and price-per-unit calculations
    - Weighted scoring with tie-breaking
    """
    start_time = datetime.now()
    
    try:
        logger.info(f"Processing query: {request.query}")
        logger.info(f"Number of candidates: {len(request.hasdata_results)}")
        
        # Validate input
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        if not request.hasdata_results:
            raise HTTPException(status_code=400, detail="HasData results cannot be empty")
        
        # Process the matching
        result = select_best_product(
            query=request.query,
            hasdata_results=request.hasdata_results,
            weights=request.weights,
            conf_threshold=request.conf_threshold,
            tie_delta=request.tie_delta
        )
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        logger.info(f"Selected product: {result['selected']['title'] if result['selected'] else 'None'}")
        logger.info(f"Score: {result['score']:.3f}, Confidence OK: {result['confidence_ok']}")
        
        return ProductMatchResponse(
            selected_product=result["selected"],
            score=result["score"],
            confidence_ok=result["confidence_ok"],
            reason=result["reason"],
            all_candidates=result["all_candidates"],
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/match-products-for-stores")
async def match_products_for_stores(request: Dict[str, Any]):
    """
    Match products for multiple stores and return best matches for each store.
    
    Request format:
    {
        "query": "whole milk 1 gallon",
        "hasdata_results": [...],
        "nearby_stores": ["Kroger", "Walmart", "Target", ...]
    }
    """
    start_time = datetime.now()
    
    try:
        query = request.get("query", "")
        hasdata_results = request.get("hasdata_results", [])
        nearby_stores = request.get("nearby_stores", [])
        
        logger.info(f"Processing query: {query}")
        logger.info(f"HasData results: {len(hasdata_results)}")
        logger.info(f"Nearby stores: {len(nearby_stores)}")
        
        if not query or not hasdata_results:
            raise HTTPException(status_code=400, detail="Query and hasdata_results are required")
        
        # Group HasData results by store
        store_results = {}
        for result in hasdata_results:
            store_name = result.get("source", "Unknown")
            if store_name not in store_results:
                store_results[store_name] = []
            store_results[store_name].append(result)
        
        # Log available HasData sources
        logger.info(f"📦 HasData sources available: {list(store_results.keys())}")
        for store_name, results in store_results.items():
            logger.info(f"  {store_name}: {len(results)} products")
            for result in results:  # Show ALL products per store
                logger.info(f"    - {result.get('title', 'Unknown')} - ${result.get('extractedPrice', 0)}")
        
        # Extract brand/item/quantity from LLM using the specified prompt
        llm_components = call_openai_extract_components(query)
        item_comp = llm_components.get("item") if llm_components else None
        brand_comp = llm_components.get("brand") if llm_components else None
        quantity_comp = llm_components.get("quantity") if llm_components else None
        quantity_liters = parse_volume_to_liters_from_quantity_string(quantity_comp)
        
        # Log extracted components
        if llm_components:
            logger.info(f"🤖 LLM extracted components: brand={brand_comp}, item={item_comp}, quantity={quantity_comp} (liters={quantity_liters})")

        # Major stores list for fuzzy matching (one-word matching only for these)
        MAJOR_STORES = [
            'walmart', 'wal-mart', 'wal mart',
            'kroger', 'kroger marketplace',
            'h-e-b', 'heb', 'h.e.b',
            'tom thumb',
            'target',
            'aldi',
            'costco',
            'albertsons',
            'publix',
            'whole foods', 'whole foods market',
            'trader joe', 'trader joes',
            'safeway',
            'wegmans',
            'meijer',
            'hy-vee',
            'shoprite',
            'stop & shop',
            'giant',
            'harris teeter',
            'food lion',
            'ralphs',
            'fred meyer',
            'king soopers',
            'smiths',
            'frys',
            'qfc',
            'marianos',
            'jewel-osco',
            'acme',
            'shaws',
            'star market',
            'vons',
            'pavilions',
            'randalls',
            'market street',
            'central market',
            'sprouts',
            'fresh market',
            'earth fare'
        ]
        
        # Function to match store names with partial/fuzzy matching (only for major stores)
        def match_store_names(hasdata_store: str, nearby_store: str) -> bool:
            """
            Match store names:
            - For major stores: allow one-word matching (e.g., "Walmart" matches "Walmart Neighborhood Market")
            - For other stores: exact match only (case-insensitive)
            """
            hasdata_lower = hasdata_store.lower().strip()
            nearby_lower = nearby_store.lower().strip()
            
            # Exact match (case-insensitive) - works for all stores
            if hasdata_lower == nearby_lower:
                return True
            
            # Check if either store is a major store (using fuzzy matching)
            is_major_store = False
            for major in MAJOR_STORES:
                if major in hasdata_lower or major in nearby_lower:
                    is_major_store = True
                    break
            
            # Only allow fuzzy matching for major stores
            if is_major_store:
                # Split into words
                hasdata_words = set(word for word in hasdata_lower.split() if len(word) > 1)  # Skip single letters
                nearby_words = set(word for word in nearby_lower.split() if len(word) > 1)
                
                # Check if any word from HasData store appears in nearby store
                for word in hasdata_words:
                    if word in nearby_words:
                        logger.info(f"✅ Store match (major store fuzzy): '{hasdata_store}' matches '{nearby_store}' (word: '{word}')")
                        return True
                
                # Check if any word from nearby store appears in HasData store
                for word in nearby_words:
                    if word in hasdata_words:
                        logger.info(f"✅ Store match (major store fuzzy): '{nearby_store}' matches '{hasdata_store}' (word: '{word}')")
                        return True
            
            # For non-major stores or if fuzzy matching didn't find a match, return False
            return False
        
        # Map HasData stores to nearby stores using fuzzy matching
        store_mapping = {}  # {nearby_store: hasdata_store}
        hasdata_store_names = list(store_results.keys())
        
        logger.info(f"🔗 Mapping HasData stores to nearby stores...")
        logger.info(f"   HasData stores: {hasdata_store_names}")
        logger.info(f"   Nearby stores: {nearby_stores}")
        
        for nearby_store in nearby_stores:
            # Find the best matching HasData store
            best_match = None
            for hasdata_store in hasdata_store_names:
                if match_store_names(hasdata_store, nearby_store):
                    best_match = hasdata_store
                    break  # Use first match
            
            if best_match:
                store_mapping[nearby_store] = best_match
                logger.info(f"   ✅ Mapped '{nearby_store}' → '{best_match}'")
        
        logger.info(f"📊 Store mapping: {len(store_mapping)} nearby stores mapped to HasData stores")
        
        # Find best match for nearby stores using mapped HasData stores
        store_matches = {}
        
        # Process nearby stores that have matching HasData stores
        for nearby_store in nearby_stores:
            # Find the corresponding HasData store
            hasdata_store = store_mapping.get(nearby_store)
            
            if not hasdata_store:
                logger.info(f"⚠️ No HasData match for '{nearby_store}' - will need AI")
                continue
            
            # Use the HasData store name for processing, but return results with nearby_store name
            store = hasdata_store
            try:
                logger.info(f"🔍 Matching products for {nearby_store} (using HasData store: {store})...")
                
                # Get all products for the HasData store
                store_products = store_results[store]
                logger.info(f"📦 {nearby_store} (HasData: {store}) has {len(store_products)} products available")
                
                # ALWAYS try LLM-guided priority conditions first if LLM returned anything
                # This is the primary matching method as per requirements
                picked_via_llm = None
                if item_comp or brand_comp or quantity_liters is not None:
                    logger.info(f"🎯 Using priority-based matching for {nearby_store} with LLM components")
                    picked_via_llm = select_by_priority_conditions(store_products, item_comp, brand_comp, quantity_liters)

                if picked_via_llm is not None:
                    # Determine which case was matched
                    if item_comp and brand_comp and quantity_liters is not None:
                        case = "highest_priority"  # All three present
                        exact_match = True  # All components matched
                    elif item_comp and brand_comp:
                        case = "second_case"  # Item and brand
                        exact_match = False  # Missing quantity
                    elif item_comp and quantity_liters is not None:
                        case = "third_case"  # Item and quantity
                        exact_match = False  # Missing brand
                    else:
                        case = "fourth_case"  # Only one present
                        exact_match = False  # Missing components
                    
                    # Use nearby_store name in the result, not HasData store name
                    store_matches[nearby_store] = {
                        "product": picked_via_llm,
                        "score": 0.99 if (item_comp and brand_comp and quantity_liters is not None) else 0.9,
                        "confidence_ok": True,
                        "reason": f"llm_priority_selection_{case}",
                        "exact_match": exact_match
                    }
                    logger.info(f"✅ LLM-priority match for {nearby_store} (case: {case}, exact_match: {exact_match}): {picked_via_llm['title']} - ${picked_via_llm.get('extractedPrice')}")
                    continue
                
                # Fallback to classic algorithm only if LLM priority matching didn't find a match
                logger.info(f"⚠️ LLM priority matching didn't find a match for {nearby_store}, falling back to classic algorithm")

                # Use very low confidence threshold to catch more matches via classic algorithm
                match_result = select_best_product(query, store_products,
                                                 weights={"token_set": 0.50, "embed": 0.30, "partial": 0.15, "brand": 0.05},
                                                 conf_threshold=0.15,
                                                 tie_delta=0.20)
                
                if match_result["selected"]:
                    # Use nearby_store name in the result, not HasData store name
                    store_matches[nearby_store] = {
                        "product": match_result["selected"],
                        "score": match_result["score"],
                        "confidence_ok": match_result["confidence_ok"],
                        "reason": match_result["reason"],
                        "exact_match": False  # Classic algorithm means not exact match
                    }
                    logger.info(f"✅ Found match for {nearby_store}: {match_result['selected']['title']} - ${match_result['selected']['extractedPrice']} (score: {match_result['score']:.3f})")
                else:
                    # Try with even lower threshold and different weights
                    match_result_low = select_best_product(query, store_products, 
                                                         weights={"token_set": 0.40, "embed": 0.20, "partial": 0.30, "brand": 0.10},
                                                         conf_threshold=0.10,  # Very low
                                                         tie_delta=0.25)
                    if match_result_low["selected"]:
                        # Use nearby_store name in the result, not HasData store name
                        store_matches[nearby_store] = {
                            "product": match_result_low["selected"],
                            "score": match_result_low["score"],
                            "confidence_ok": False,  # Mark as low confidence
                            "reason": f"low_confidence_{match_result_low['reason']}",
                            "exact_match": False  # Low confidence means not exact match
                        }
                        logger.info(f"⚠️ Low confidence match for {nearby_store}: {match_result_low['selected']['title']} - ${match_result_low['selected']['extractedPrice']} (score: {match_result_low['score']:.3f})")
                    else:
                        # Last resort: select cheapest product that contains key terms
                        cheapest_match = find_cheapest_relevant_product(query, store_products)
                        if cheapest_match:
                            # Use nearby_store name in the result, not HasData store name
                            store_matches[nearby_store] = {
                                "product": cheapest_match,
                                "score": 0.05,  # Very low score
                                "confidence_ok": False,
                                "reason": "cheapest_fallback",
                                "exact_match": False  # Fallback means not exact match
                            }
                            logger.info(f"💰 Fallback cheapest for {nearby_store}: {cheapest_match['title']} - ${cheapest_match['extractedPrice']}")
                        else:
                            logger.info(f"❌ No match found for {nearby_store}")
            except Exception as e:
                logger.error(f"Error matching for {nearby_store}: {e}")
        
        # Log stores that don't have HasData results
        for store in nearby_stores:
            if store not in store_results:
                logger.info(f"⚠️ No HasData results for {store}")
        
        # Find stores that need AI processing
        stores_needing_ai = [store for store in nearby_stores if store not in store_matches]
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        logger.info(f"Store matches: {len(store_matches)}")
        logger.info(f"Stores needing AI: {len(stores_needing_ai)}")
        
        return {
            "store_matches": store_matches,
            "stores_needing_ai": stores_needing_ai,
            "processing_time_ms": processing_time,
            "total_stores": len(nearby_stores),
            "matched_stores": len(store_matches),
            "ai_stores": len(stores_needing_ai)
        }
        
    except Exception as e:
        logger.error(f"Error processing store matches: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/match-multiple-products")
async def match_multiple_products(requests: List[ProductMatchRequest]):
    """
    Batch process multiple product matching requests.
    """
    results = []
    for request in requests:
        try:
            result = await match_products(request)
            results.append(result)
        except Exception as e:
            logger.error(f"Error processing batch request: {str(e)}")
            results.append({
                "error": str(e),
                "query": request.query
            })
    
    return {"results": results}

# ------------------------ Example Usage ------------------------

if __name__ == "__main__":
    import uvicorn
    
    # Example usage
    example_results = [
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
        },
        {
            "position": 4,
            "title": "Lucerne Whole Milk 1 gallon",
            "extractedPrice": 3.19,
            "source": "Albertsons",
        },
    ]
    
    # Test the matching function
    query = "whole milk 1 gallon"
    result = select_best_product(query, example_results)
    
    print("Selected product:")
    print(result["selected"])
    print(f"Score: {result['score']:.3f}")
    print(f"Confidence OK: {result['confidence_ok']}")
    print(f"Reason: {result['reason']}")
    
    # Run the FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)
