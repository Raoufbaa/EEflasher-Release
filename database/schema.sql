-- Enable uuid-ossp extension for uuid generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    verified VARCHAR(255) DEFAULT 'false',
    verification_expires TIMESTAMP WITH TIME ZONE,
    is_admin BOOLEAN DEFAULT FALSE,
    name VARCHAR(255),
    profile_image VARCHAR(512) DEFAULT '/Assets/profile.jpg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index: idx_users_lower_email (Optimizes lowercase email lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));

-- Table: device_models
CREATE TABLE IF NOT EXISTS device_models (
    id SERIAL PRIMARY KEY,
    device_type VARCHAR(255) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) UNIQUE NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index: idx_device_models_approved (Used for admin queues filtering unapproved models)
CREATE INDEX IF NOT EXISTS idx_device_models_approved ON device_models (approved);

-- Table: firmwares
CREATE TABLE IF NOT EXISTS firmwares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_model VARCHAR(255) NOT NULL,
    device_type VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    description TEXT,
    file_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    downloads_count INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_dump BOOLEAN NOT NULL DEFAULT FALSE,
    model_id INTEGER REFERENCES device_models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for firmwares table
CREATE INDEX IF NOT EXISTS idx_firmwares_device_type ON firmwares (device_type);
CREATE INDEX IF NOT EXISTS idx_firmwares_device_model ON firmwares (device_model);
CREATE INDEX IF NOT EXISTS idx_firmwares_model_id ON firmwares (model_id);
CREATE INDEX IF NOT EXISTS idx_firmwares_uploaded_by ON firmwares (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_firmwares_created_at ON firmwares (created_at DESC);

-- Table: chips
CREATE TABLE IF NOT EXISTS chips (
    id SERIAL PRIMARY KEY,
    manufacturer VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    chip_id VARCHAR(255) NOT NULL,
    page_size INTEGER NOT NULL,
    size BIGINT NOT NULL,
    spi_command VARCHAR(255) NOT NULL,
    protocol VARCHAR(255) NOT NULL,
    vcc VARCHAR(50) NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    normalized_model VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for chips table
CREATE INDEX IF NOT EXISTS idx_chips_chip_id ON chips (chip_id);
CREATE INDEX IF NOT EXISTS idx_chips_normalized_model ON chips (normalized_model);
CREATE INDEX IF NOT EXISTS idx_chips_manufacturer_model ON chips (manufacturer, model);
CREATE INDEX IF NOT EXISTS idx_chips_approved ON chips (approved);
