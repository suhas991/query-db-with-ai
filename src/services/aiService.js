import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    console.warn('⚠️ Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file');
}

const genAI = API_KEY && API_KEY !== 'your_gemini_api_key_here'
    ? new GoogleGenerativeAI(API_KEY)
    : null;

/**
 * SQL Keywords that indicate different query types
 */
const QUERY_TYPES = {
    READ: ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'],
    WRITE: ['INSERT', 'UPDATE', 'DELETE'],
    DDL: ['CREATE', 'ALTER', 'DROP', 'TRUNCATE'],
    DANGEROUS: ['DROP', 'TRUNCATE', 'DELETE']
};

/**
 * Analyze query type and return metadata
 * @param {string} query - SQL query to analyze
 * @returns {object} - Query metadata
 */
export function analyzeQuery(query) {
    if (!query) return { type: 'unknown', isDangerous: false, requiresConfirmation: false };

    const normalizedQuery = query.trim().toUpperCase();

    const isDangerous = QUERY_TYPES.DANGEROUS.some(keyword =>
        normalizedQuery.startsWith(keyword) ||
        new RegExp(`\\b${keyword}\\b`).test(normalizedQuery)
    );

    const isWrite = QUERY_TYPES.WRITE.some(keyword => normalizedQuery.startsWith(keyword));
    const isDDL = QUERY_TYPES.DDL.some(keyword => normalizedQuery.startsWith(keyword));
    const isRead = QUERY_TYPES.READ.some(keyword => normalizedQuery.startsWith(keyword));

    let type = 'unknown';
    if (isRead) type = 'read';
    else if (isWrite) type = 'write';
    else if (isDDL) type = 'ddl';

    return {
        type,
        isDangerous,
        requiresConfirmation: isDangerous,
        keywords: {
            isRead,
            isWrite,
            isDDL,
            isDangerous
        }
    };
}

/**
 * Clean and sanitize AI-generated query
 * @param {string} query - Raw query from AI
 * @param {string} dbType - Database type
 * @returns {string} - Cleaned query
 */
function sanitizeQuery(query, dbType = 'postgres') {
    if (!query) return '';

    let cleaned = query.trim();

    // Remove markdown code blocks (various formats)
    cleaned = cleaned.replace(/```sql\n?/gi, '');
    cleaned = cleaned.replace(/```mysql\n?/gi, '');
    cleaned = cleaned.replace(/```postgresql\n?/gi, '');
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');

    // Remove common AI prefixes/explanations
    const prefixPatterns = [
        /^Here(?:'s| is) (?:the |a )?(?:SQL |MongoDB )?query[:\s]*/i,
        /^The (?:SQL |MongoDB )?query (?:is|would be)[:\s]*/i,
        /^Query[:\s]*/i,
        /^SQL[:\s]*/i,
        /^Result[:\s]*/i,
    ];

    for (const pattern of prefixPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Remove trailing explanations (after the query)
    const suffixPatterns = [
        /\n\nThis query.*/is,
        /\n\nNote:.*/is,
        /\n\nExplanation:.*/is,
        /\n\n\*\*.*/is,
    ];

    for (const pattern of suffixPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Clean up whitespace
    cleaned = cleaned.trim();

    // Remove trailing semicolons for MongoDB (not needed)
    if (dbType === 'mongodb') {
        cleaned = cleaned.replace(/;+$/, '');
    }

    return cleaned;
}

/**
 * Validate SQL query structure
 * @param {string} query - SQL query to validate
 * @param {string} dbType - Database type
 * @returns {object} - Validation result
 */
function validateQuery(query, dbType = 'postgres') {
    const errors = [];
    const warnings = [];

    if (!query || query.trim().length === 0) {
        errors.push('Query is empty');
        return { isValid: false, errors, warnings };
    }

    if (dbType === 'mongodb') {
        // MongoDB validation - expect JSON
        try {
            const parsed = JSON.parse(query);
            if (!parsed.collection) {
                warnings.push('No collection specified, will use "test"');
            }
            if (!parsed.operation) {
                parsed.operation = 'find';
                warnings.push('No operation specified, defaulting to "find"');
            }
        } catch (e) {
            errors.push('Invalid MongoDB query format: Expected JSON');
        }
    } else {
        // SQL validation
        const normalizedQuery = query.trim().toUpperCase();

        // Check for basic SQL structure
        const validStarts = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'];
        const hasValidStart = validStarts.some(keyword => normalizedQuery.startsWith(keyword));

        if (!hasValidStart) {
            errors.push('Query does not appear to be valid SQL');
        }

        // Check for unclosed quotes
        const singleQuotes = (query.match(/'/g) || []).length;
        const doubleQuotes = (query.match(/"/g) || []).length;

        if (singleQuotes % 2 !== 0) {
            errors.push('Unclosed single quote detected');
        }
        if (doubleQuotes % 2 !== 0) {
            errors.push('Unclosed double quote detected');
        }

        // Check for unbalanced parentheses
        const openParens = (query.match(/\(/g) || []).length;
        const closeParens = (query.match(/\)/g) || []).length;

        if (openParens !== closeParens) {
            errors.push('Unbalanced parentheses detected');
        }

        // Warn about SELECT * with no LIMIT
        if (normalizedQuery.includes('SELECT *') &&
            !normalizedQuery.includes('LIMIT') &&
            !normalizedQuery.includes('TOP')) {
            warnings.push('SELECT * without LIMIT may return large result sets');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
/**
 * Build enhanced schema context for AI
 * @param {object} schema - Database schema
 * @param {string} dbType - Database type
 * @returns {string} - Formatted schema context
 */
function buildSchemaContext(schema, dbType = 'postgres') {
    if (!schema || Object.keys(schema).length === 0) {
        return '';
    }

    let context = '\n\nDATABASE SCHEMA:\n';

    if (dbType === 'mongodb') {
        context += 'Collections and sample fields:\n';
        context += '(Note: _id field is auto-generated by MongoDB, do NOT include in insertions)\n';
        for (const [collection, fields] of Object.entries(schema)) {
            context += `- ${collection}: [${fields.map(f => `${f.name}(${f.type})`).join(', ')}]\n`;
        }
    } else {
        context += 'Tables and columns:\n';
        context += '(Columns marked with [AUTO] are auto-generated - do NOT include them in INSERT statements)\n\n';

        for (const [table, columns] of Object.entries(schema)) {
            context += `TABLE: ${table}\n`;

            // Separate auto-generated and regular columns for clarity
            const autoColumns = columns.filter(c => c.excludeFromInsert || c.isAutoGenerated);
            const regularColumns = columns.filter(c => !c.excludeFromInsert && !c.isAutoGenerated);

            for (const col of columns) {
                const autoTag = (col.excludeFromInsert || col.isAutoGenerated) ? ' [AUTO]' : '';
                const pkTag = col.isPrimaryKey ? ' [PK]' : '';
                const nullableTag = col.nullable ? '' : ' [NOT NULL]';
                context += `  - ${col.name} (${col.type})${pkTag}${autoTag}${nullableTag}\n`;
            }

            // Add a helpful note for INSERT operations
            if (regularColumns.length > 0) {
                context += `  → For INSERT, use only: ${regularColumns.map(c => c.name).join(', ')}\n`;
            }
            context += '\n';
        }
    }

    return context;
}

/**
 * Build conversation history context for AI
 * @param {Array} conversationHistory - Array of previous messages
 * @param {number} maxHistory - Maximum number of previous exchanges to include
 * @returns {string} - Formatted conversation context
 */
function buildConversationContext(conversationHistory, maxHistory = 5) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return '';
    }

    // Filter to only include relevant messages (user questions and generated queries)
    const relevantMessages = conversationHistory
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.sql))
        .slice(-maxHistory * 2); // Get last N exchanges (question + response pairs)

    if (relevantMessages.length === 0) {
        return '';
    }

    let context = '\n\nPREVIOUS CONVERSATION:\n';

    for (const msg of relevantMessages) {
        if (msg.role === 'user') {
            context += `User asked: "${msg.content}"\n`;
        } else if (msg.role === 'assistant' && msg.sql) {
            context += `Generated query: ${msg.sql}\n`;
            // Include execution result summary if available
            if (msg.result && msg.result.rowCount !== undefined) {
                context += `Result: ${msg.result.rowCount} rows returned\n`;
            }
            context += '\n';
        }
    }

    return context;
}

/**
 * Convert natural language question to database query using Gemini AI
 * @param {string} question - Natural language question
 * @param {object} schema - Database schema information (optional)
 * @param {string} dbType - Database type ('postgres', 'mysql', 'mongodb')
 * @param {object} options - Additional options including conversationHistory
 * @returns {Promise<object>} - Generated query with metadata
 */
export async function generateSQLQuery(question, schema = null, dbType = 'postgres', options = {}) {
    if (!genAI) {
        throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file');
    }

    const { maxRetries = 2, temperature = 0.1, conversationHistory = [] } = options;

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            temperature, // Very low temperature for consistent query generation
            maxOutputTokens: 1024,
            topP: 0.8,
            topK: 40,
        }
    });

    const schemaContext = buildSchemaContext(schema, dbType);
    const historyContext = buildConversationContext(conversationHistory);

    let prompt;
    if (dbType === 'mongodb') {
        prompt = `You are an expert MongoDB query generator. Convert the user's natural language question into a valid MongoDB query.

DATABASE TYPE: MongoDB${schemaContext}${historyContext}

USER QUESTION: "${question}"

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON representing the MongoDB operation
2. NO explanations, NO markdown formatting, NO code blocks
3. Use this exact JSON format:
   {"collection": "collection_name", "operation": "find|insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany", "filter": {...}, "document": {...}, "update": {...}}

4. For read operations: use "find" with "filter" (empty {} for all documents)
5. For insert: use "insertOne"/"insertMany" with "document"/"documents"
6. For update: use "updateOne"/"updateMany" with "filter" and "update" (use $set, $inc, etc.)
7. For delete: use "deleteOne"/"deleteMany" with "filter"

8. If user asks to see all data from a collection, use: {"collection": "name", "operation": "find", "filter": {}}
9. Make intelligent assumptions about collection names based on common conventions
10. Consider the conversation history when interpreting the user's question (e.g., "now filter by status" should use the same collection/table from previous query)
11. Understand pronouns and references like "those", "them", "the same table", "that column" based on context

IMPORTANT - AUTO-GENERATED FIELDS:
- The _id field is auto-generated by MongoDB - NEVER include it in insert operations
- For insertOne/insertMany, only include fields the user explicitly provides values for
- If user says "add a user named John", only include {"name": "John"}, NOT the _id field

RESPOND WITH ONLY THE JSON:`;
    } else {
        const dbName = dbType === 'mysql' ? 'MySQL' : 'PostgreSQL';
        prompt = `You are an expert ${dbName} SQL query generator. Convert the user's natural language question into a valid SQL query.

DATABASE TYPE: ${dbName}${schemaContext}${historyContext}

USER QUESTION: "${question}"

CRITICAL INSTRUCTIONS:
1. Output ONLY the SQL query - no explanations, no markdown, no code blocks
2. Use proper ${dbName} syntax and best practices
3. Include appropriate WHERE clauses, JOINs, ORDER BY, and LIMIT when relevant
4. For ambiguous requests, make reasonable assumptions about table/column names
5. Always add LIMIT 100 for SELECT queries unless a specific limit is requested
6. Use single quotes for string literals, double quotes for identifiers (PostgreSQL) or backticks (MySQL)
7. Consider the conversation history when interpreting the user's question
8. Understand follow-up questions like "now filter by...", "show me more details", "same table but...", etc.
9. Understand pronouns and references like "those", "them", "the same table", "that column" based on previous queries

IMPORTANT - AUTO-GENERATED COLUMNS:
- Columns marked with [AUTO] in the schema are auto-generated by the database (e.g., id, created_at, updated_at)
- For INSERT statements, NEVER include [AUTO] columns - the database generates these automatically
- Only include columns that the user explicitly provides values for
- If user says "add a user named John", only include the name column, NOT the id column
- Use the "For INSERT, use only:" hint in the schema to know which columns to include

COMMON PATTERNS:
- "Show all tables": ${dbType === 'mysql' ? 'SHOW TABLES' : "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"}
- "Describe table X": ${dbType === 'mysql' ? 'DESCRIBE table_name' : "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'table_name'"}

RESPOND WITH ONLY THE SQL QUERY:`;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let query = response.text();

            // Sanitize the query
            query = sanitizeQuery(query, dbType);

            // Validate the query
            const validation = validateQuery(query, dbType);

            if (!validation.isValid && attempt < maxRetries) {
                console.warn(`Query validation failed on attempt ${attempt + 1}:`, validation.errors);
                continue; // Retry
            }

            // Analyze query type
            const analysis = dbType === 'mongodb'
                ? { type: 'mongodb', isDangerous: false, requiresConfirmation: false }
                : analyzeQuery(query);

            return {
                query,
                validation,
                analysis,
                dbType,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            lastError = error;
            console.error(`Error generating query (attempt ${attempt + 1}):`, error);

            if (attempt < maxRetries) {
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }

    // All retries failed
    if (lastError?.message?.includes('API key')) {
        throw new Error('Invalid API key. Please check your VITE_GEMINI_API_KEY in .env file');
    }
    if (lastError?.message?.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection');
    }

    throw new Error(`Failed to generate ${dbType} query after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Explain a database query in natural language using AI
 * @param {string} query - Query to explain
 * @param {string} dbType - Database type ('postgres', 'mysql', 'mongodb')
 * @returns {Promise<string>} - Natural language explanation
 */
export async function explainSQLQuery(query, dbType = 'postgres') {
    if (!genAI) {
        throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
        }
    });

    const queryType = dbType === 'mongodb' ? 'MongoDB' : 'SQL';
    const prompt = `Explain the following ${queryType} query in simple, natural language. Be concise and clear. Focus on what the query does, not on syntax details.

${queryType} Query:
${query}

Provide a clear, beginner-friendly explanation in 2-3 sentences:`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Error explaining query:', error);
        throw new Error(`Failed to explain query: ${error.message}`);
    }
}

/**
 * Get database schema information using AI
 * @param {string} connectionString - Database connection string
 * @returns {Promise<object>} - Schema information
 */
export async function getSchemaInfo(connectionString) {
    const schemaQuery = `
    SELECT 
      table_name,
      column_name,
      data_type
    FROM 
      information_schema.columns
    WHERE 
      table_schema = 'public'
    ORDER BY 
      table_name, ordinal_position;
  `;

    return {
        query: schemaQuery,
        description: 'Query to fetch database schema'
    };
}

/**
 * Suggest optimizations for a SQL query using AI
 * @param {string} sqlQuery - SQL query to optimize
 * @returns {Promise<object>} - Optimization suggestions
 */
export async function suggestOptimizations(sqlQuery) {
    if (!genAI) {
        throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
        }
    });

    const prompt = `Analyze the following SQL query and suggest optimizations. Return your response as valid JSON with this exact structure (no markdown):
{
  "optimizedQuery": "the optimized SQL query",
  "improvements": ["list of improvements made"],
  "explanation": "brief explanation of optimizations"
}

SQL Query:
${sqlQuery}

Respond with only the JSON object:`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Clean up response
        text = sanitizeQuery(text, 'json');

        // Try to parse JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            optimizedQuery: sqlQuery,
            improvements: [],
            explanation: text
        };
    } catch (error) {
        console.error('Error suggesting optimizations:', error);
        throw new Error(`Failed to suggest optimizations: ${error.message}`);
    }
}

/**
 * Generate query suggestions based on schema
 * @param {object} schema - Database schema
 * @param {string} dbType - Database type
 * @returns {string[]} - Array of suggested queries
 */
export function generateQuerySuggestions(schema, dbType = 'postgres') {
    const suggestions = [];

    if (!schema || Object.keys(schema).length === 0) {
        return [
            'Show me all tables',
            'Count all records',
            'Get the latest 10 entries'
        ];
    }

    const tables = Object.keys(schema);

    if (tables.length > 0) {
        const firstTable = tables[0];
        suggestions.push(`Show all data from ${firstTable}`);
        suggestions.push(`Count records in ${firstTable}`);

        const columns = schema[firstTable];
        if (columns && columns.length > 0) {
            const firstColumn = columns[0].name;
            suggestions.push(`Get unique ${firstColumn} values from ${firstTable}`);
        }
    }

    if (tables.length > 1) {
        suggestions.push(`Show table relationships`);
    }

    return suggestions.slice(0, 5);
}
