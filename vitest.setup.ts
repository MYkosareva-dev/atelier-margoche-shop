// Unit tests never load .env: the local DATABASE_URI points at the production database.
// Dummy values (same as CI) satisfy the boot guards; every test mocks Payload and the network.
process.env.DATABASE_URI = 'postgresql://unit:unit@localhost:5432/unit'
process.env.PAYLOAD_SECRET = 'unit-secret-not-real-000000000000000'
process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:3000'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
delete process.env.BLOB_READ_WRITE_TOKEN
