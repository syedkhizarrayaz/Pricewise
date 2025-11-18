"""
Simplified Product Matcher Service for local development.

This service implements intelligent product matching from HasData responses
without heavy dependencies like sentence-transformers.

Features:
- Text normalization and fuzzy matching
- Unit parsing and price-per-unit calculations
- Weighted scoring with tie-breaking
- FastAPI integration
"""

import re
import math
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime

# FastAPI imports
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Core dependencies
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Simple Product Matcher Service",
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
    """Lowercase, remove excessive punctuation, unify whitespace."""
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
    """Try to extract volume/size from a product title and convert to liters."""
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

def tfidf_scores(query: str, titles: List[str]) -> List[float]:
    """TF-IDF similarity scores."""
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
    brand = normalize_component(feat.get("brand_match", 0.0))

    score = (
        weights.get("token_set", 0.50) * token
        + weights.get("partial", 0.25) * part
        + weights.get("brand", 0.15) * brand
    )
    return float(score)

def select_best_product(query: str, hasdata_results: List[Dict[str, Any]],
                        weights: Optional[Dict[str, float]] = None,
                        conf_threshold: float = 0.55,
                        tie_delta: float = 0.05) -> Dict[str, Any]:
    """Main product selection algorithm."""
    if weights is None:
        weights = {"token_set": 0.50, "partial": 0.25, "brand": 0.15}

    feats = [compute_features_for_candidate(query, c) for c in hasdata_results]

    # Compute TF-IDF scores for all candidates
    titles = [f["title_norm"] for f in feats]
    tfidf_sims = tfidf_scores(normalize_text(query), titles)
    for f, s in zip(feats, tfidf_sims):
        f["tfidf"] = s

    # Add TF-IDF to scoring
    for f in feats:
        tfidf_score = normalize_component(f.get("tfidf", 0.0))
        f["score"] = compute_final_score(f, weights) + 0.10 * tfidf_score

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
        embeddings_available=False
    )

@app.post("/match-products", response_model=ProductMatchResponse)
async def match_products(request: ProductMatchRequest):
    """
    Match products from HasData response to user query.
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
