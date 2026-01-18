# 🔌 Backend Server Setup

To enable real database connections, we use a simple Node.js proxy server.

## 🚀 How to Run

1. **Open a new terminal**
2. Navigate to the server directory:
   ```bash
   cd server
   ```
3. Install dependencies (first time only):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node index.js
   ```

The server will run on `http://localhost:3001`.

## 🔗 Connecting to Database

1. Go to the frontend app (http://localhost:5174)
2. Add a new connection
3. Enter your **Real PostgreSQL Connection String**:
   ```
   postgresql://user:password@host:port/database
   ```
   (Example: `postgresql://postgres:mypassword@localhost:5432/postgres`)

## ⚠️ Important Notes

- The server must be running for queries to work
- Only `SELECT` queries are allowed by default for safety
- The server supports SSL connections (required for most cloud DBs like Supabase, Neon, etc.)
