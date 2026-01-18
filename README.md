# 🤖 AI Database Query Tool

A beautiful, AI-powered database query interface that lets you interact with your PostgreSQL database using natural language. Built with React, Vite, and Google Gemini AI.

![AI Database Query Tool](https://img.shields.io/badge/React-18.2.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.0.0-purple) ![Gemini AI](https://img.shields.io/badge/Gemini-AI-orange)

## ✨ Features

- 🔐 **Authentication** - Secure email/password authentication
- 🗄️ **Database Connection Management** - Store and manage multiple database connections
- 💬 **Natural Language Queries** - Ask questions in plain English
- 🤖 **AI-Powered SQL Generation** - Gemini AI converts your questions to SQL
- 📊 **Beautiful Results Display** - Clean table views for query results
- 📝 **Query History** - Automatically saves your query conversations
- 🔒 **Read-Only Mode** - Safe SELECT-only queries by default
- 🎨 **Modern UI** - Professional design with glassmorphism effects
- 📱 **Responsive** - Works on desktop, tablet, and mobile

## Image References
LOGIN PAGE
<img width="1915" height="950" alt="image" src="https://github.com/user-attachments/assets/44d26568-b3ba-40cc-898d-455a6a04def9" />

SETUP DB CONNECTION 
<img width="1633" height="793" alt="image" src="https://github.com/user-attachments/assets/afa3928e-af56-435a-8555-79c79d01bc20" />

SOME CHATBOT CONVERSATION
<img width="1919" height="954" alt="image" src="https://github.com/user-attachments/assets/0c2462a3-5ab3-4de8-91e4-8fa4fe7255e8" />

<img width="1919" height="462" alt="image" src="https://github.com/user-attachments/assets/aeb1f0d9-d862-456b-a29e-575a40eadd9f" />

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd ai-database-query
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Open the `.env` file and add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   
   Navigate to `http://localhost:5173`

## 🎯 Usage

### 1. Sign Up / Sign In

- Create a new account or sign in with existing credentials
- Demo mode: Create any account to get started!

### 2. Add a Database Connection

- Click the **+** button in the sidebar
- Enter a connection name (e.g., "My Production DB")
- Add your PostgreSQL connection string:
  ```
  postgresql://username:password@host:port/database
  ```
- Click "Test Connection" to verify
- Click "Add Connection" to save

### 3. Start Querying

Select your database and start asking questions in natural language:

- "Show me all tables in the database"
- "What are the latest 10 orders?"
- "Count total users"
- "Find all products in the Electronics category"
- "Show me users who joined this month"

The AI will:
1. Generate the SQL query
2. Execute it against your database
3. Display the results in a clean table

### 4. Additional Features

- **Explain Query**: Click "Explain" on any SQL query to get a natural language explanation
- **Query History**: All queries are automatically saved
- **Multiple Connections**: Switch between different databases easily

## 🏗️ Architecture

### Frontend Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Lucide React** - Beautiful icons
- **Google Generative AI** - Gemini AI integration

### Project Structure

```
ai-database-query/
├── src/
│   ├── components/
│   │   ├── ChatInterface.jsx    # Main chat UI
│   │   └── DatabaseSidebar.jsx  # Connection management
│   ├── contexts/
│   │   ├── AuthContext.jsx      # Authentication state
│   │   └── DatabaseContext.jsx  # Database state
│   ├── pages/
│   │   ├── AuthPage.jsx         # Login/signup page
│   │   └── Dashboard.jsx        # Main dashboard
│   ├── services/
│   │   ├── aiService.js         # Gemini AI integration
│   │   └── databaseService.js   # Database operations
│   ├── App.jsx                  # Main app component
│   ├── main.jsx                 # Entry point
│   └── index.css                # Design system
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GEMINI_API_KEY` | Your Google Gemini API key | Yes |
| `VITE_DB_PROXY_URL` | Backend API URL (if using proxy) | No |

### Database Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Example:
```
postgresql://myuser:mypassword@localhost:5432/mydb
```

## 🎨 Design System

The app uses a comprehensive design system with:

- **Color Palette**: Cyan/Teal primary theme
- **Typography**: Inter font family
- **Components**: Reusable button, input, card, and table components
- **Animations**: Smooth transitions and micro-interactions
- **Responsive**: Mobile-first design approach

## 🔒 Security Notes

### Current Implementation (Demo)

- **Authentication**: Uses localStorage (for demo purposes only)
- **Database Queries**: Executed in mock mode with sample data
- **Connection Strings**: Stored in localStorage (not secure)

### Production Recommendations

1. **Backend API**: Create a Node.js/Express backend
2. **Database Proxy**: Never connect directly from frontend
3. **Authentication**: Use proper JWT tokens or session management
4. **Encryption**: Encrypt connection strings at rest
5. **Rate Limiting**: Implement API rate limiting
6. **Query Validation**: Validate and sanitize all queries server-side
7. **HTTPS**: Always use HTTPS in production

## 🚧 Extending the App

### Add Write Operations

Currently, only SELECT queries are allowed. To enable write operations:

1. Update `aiService.js` to allow INSERT, UPDATE, DELETE
2. Add confirmation dialogs for destructive operations
3. Implement transaction support
4. Add query preview before execution

### Add More Database Types

To support MySQL, MongoDB, etc.:

1. Update `databaseService.js` with new connection logic
2. Modify SQL generation in `aiService.js` for different syntaxes
3. Add database type selector in connection form

### Backend Integration

Create a backend API:

```javascript
// Example Express endpoint
app.post('/api/query', async (req, res) => {
  const { connectionString, sqlQuery } = req.body;
  
  // Validate query
  // Execute against database
  // Return results
});
```

## 📝 Example Queries

Try these natural language queries:

- "Show me all users"
- "Count orders by status"
- "Find products with price greater than 100"
- "Show me the top 5 customers by order count"
- "What's the average order amount?"
- "List all tables and their column names"
- "Show me orders from the last 7 days"

## 🐛 Troubleshooting

### "Gemini API key not configured"

- Make sure you've added your API key to `.env`
- Restart the dev server after updating `.env`

### Connection test fails

- Verify your connection string format
- Check database host and port
- Ensure database is running and accessible

### Queries not working

- Check browser console for errors
- Verify Gemini API key is valid
- Try simpler queries first

## 📦 Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for learning or commercial purposes.

## 🙏 Acknowledgments

- Google Gemini AI for natural language processing
- React team for the amazing framework
- Lucide for beautiful icons
- Inter font family

---

**Note**: This is a demo application. For production use, implement proper backend security, authentication, and database connection handling.

## 🔗 Useful Links

- [Google Gemini API](https://ai.google.dev/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

Made with ❤️ using React + Vite + Gemini AI
