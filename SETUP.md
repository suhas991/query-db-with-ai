# 🚀 Quick Setup Guide

## Step 1: Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

## Step 2: Configure the Application

1. Open the `.env` file in the project root
2. Replace `your_gemini_api_key_here` with your actual API key:
   ```
   VITE_GEMINI_API_KEY=AIzaSyD...your_actual_key_here
   ```
3. Save the file

## Step 3: Restart the Dev Server

If the server is already running, stop it (Ctrl+C) and restart:
```bash
npm run dev
```

## Step 4: Create an Account

1. Open http://localhost:5174 in your browser
2. Click "Don't have an account? Sign up"
3. Enter any name, email, and password (this is demo mode)
4. Click "Sign up"

## Step 5: Add a Database Connection

### Option 1: Use Mock Data (No Real Database Needed)

1. Click the **+** button in the sidebar
2. Enter a name: `Demo Database`
3. Enter any connection string: `postgresql://demo:demo@localhost:5432/demo`
4. Click "Add Connection"

The app will use mock data to demonstrate functionality!

### Option 2: Connect to Real PostgreSQL Database

1. Make sure you have a PostgreSQL database running
2. Click the **+** button in the sidebar
3. Enter a descriptive name
4. Enter your real connection string:
   ```
   postgresql://username:password@host:port/database
   ```
5. Click "Test Connection" to verify
6. Click "Add Connection"

**Note**: Currently, the app runs in mock mode. To connect to a real database, you'll need to create a backend API (see README.md for details).

## Step 6: Start Querying!

Try these example questions:

- "Show me all tables"
- "What are the latest 10 orders?"
- "Count total users"
- "Find all products in Electronics category"
- "Show me users who joined this month"

## 🎉 You're All Set!

The AI will:
1. Convert your question to SQL
2. Execute the query
3. Show you the results

Enjoy exploring your database with natural language! 🚀

## Need Help?

- Check the full README.md for detailed documentation
- Make sure your Gemini API key is valid
- Verify the dev server is running on http://localhost:5174
- Check the browser console for any errors

## What's Next?

- Try different types of queries
- Explore the "Explain" feature for SQL queries
- Add multiple database connections
- Check your query history

---

**Important Security Note**: This is a demo application. For production use:
- Create a backend API to handle database connections
- Never expose database credentials in the frontend
- Implement proper authentication and authorization
- Use HTTPS and encrypt sensitive data
