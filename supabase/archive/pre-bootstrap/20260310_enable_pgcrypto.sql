-- Enable uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encryption key to system (use environment variable in production)
-- For Supabase, you'd use Supabase Vault or set a database setting

-- Example: Encrypt existing API keys (run this after enabling extension)
-- UPDATE user_api_keys 
-- SET encrypted_key = pgp_sym_encrypt(encrypted_key, current_setting('app.encryption_key'), 'cipher-algo=aes256');

-- Note: In production, use Supabase Vault to store the encryption key:
-- https://supabase.com/docs/guides/database/vault
