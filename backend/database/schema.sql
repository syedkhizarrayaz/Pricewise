-- Pricewise Database Schema
-- Run this script to create all tables

-- Users/Locations table (permanent storage)
CREATE TABLE IF NOT EXISTS user_locations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    address VARCHAR(255) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    location_source ENUM('gps', 'manual') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_location (address(100), zip_code),
    INDEX idx_coordinates (latitude, longitude),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Queries table (permanent storage)
CREATE TABLE IF NOT EXISTS user_queries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    location_id BIGINT NOT NULL,
    items JSON NOT NULL,
    items_text TEXT NOT NULL,
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES user_locations(id) ON DELETE CASCADE,
    INDEX idx_location_id (location_id),
    INDEX idx_query_hash (query_hash),
    INDEX idx_created (created_at),
    FULLTEXT INDEX idx_items_text (items_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nearby stores table (permanent storage)
CREATE TABLE IF NOT EXISTS query_stores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_id BIGINT NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    store_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES user_queries(id) ON DELETE CASCADE,
    INDEX idx_query_id (query_id),
    INDEX idx_store_name (store_name(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Query results table (permanent storage)
CREATE TABLE IF NOT EXISTS query_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_id BIGINT NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    products JSON NOT NULL,
    result_type ENUM('hasdata', 'ai', 'fallback') NOT NULL,
    exact_match BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES user_queries(id) ON DELETE CASCADE,
    INDEX idx_query_id (query_id),
    INDEX idx_store_name (store_name(100)),
    INDEX idx_total_price (total_price),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cache table (24-hour TTL)
CREATE TABLE IF NOT EXISTS query_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    cached_result JSON NOT NULL,
    nearby_stores JSON NOT NULL,
    hasdata_results JSON,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_hash (query_hash),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics/Statistics view
CREATE OR REPLACE VIEW query_statistics AS
SELECT 
    DATE(q.created_at) as query_date,
    l.location_source,
    COUNT(*) as total_queries,
    COUNT(DISTINCT q.location_id) as unique_locations,
    COUNT(DISTINCT q.items) as unique_combinations,
    AVG((SELECT COUNT(*) FROM query_results WHERE query_results.query_id = q.id)) as avg_stores_per_query
FROM user_queries q
JOIN user_locations l ON q.location_id = l.id
GROUP BY DATE(q.created_at), l.location_source;

