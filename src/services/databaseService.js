/**
 * Database Service
 * 
 * Connects to the backend proxy to execute real PostgreSQL queries.
 */

const API_URL = import.meta.env.VITE_DB_PROXY_URL || 'http://localhost:3001/api';

/**
 * Test database connection
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Promise<object>} - Connection test result
 */
export async function testConnection(connectionString) {
    try {
        const response = await fetch(`${API_URL}/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionString }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Connection failed');
        }

        return data;
    } catch (error) {
        throw new Error(error.message || 'Failed to connect to database server');
    }
}

/**
 * Execute SQL query
 * @param {string} connectionString - Database connection string
 * @param {string} sqlQuery - SQL query to execute
 * @param {string} dbType - Database type ('postgres', 'mysql', 'mongodb')
 * @returns {Promise<object>} - Query results
 */
export async function executeQuery(connectionString, sqlQuery, dbType = null) {
    try {
        const response = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionString, query: sqlQuery, dbType }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Query execution failed');
        }

        return data;
    } catch (error) {
        throw new Error(error.message || 'Failed to execute query');
    }
}

/**
 * Get database schema
 * @param {string} connectionString - Database connection string
 * @param {string} dbType - Database type ('postgres', 'mysql', 'mongodb')
 * @returns {Promise<object>} - Database schema
 */
export async function getDatabaseSchema(connectionString, dbType = null) {
    try {
        const response = await fetch(`${API_URL}/schema`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionString, dbType }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.warn('Failed to fetch schema:', data.error);
            return null;
        }

        return data.tables;
    } catch (error) {
        console.warn('Failed to fetch schema:', error);
        return null;
    }
}

/**
 * Format connection string for display (hide password)
 * @param {string} connectionString - Database connection string
 * @returns {string} - Formatted connection string
 */
export function formatConnectionString(connectionString) {
    try {
        // Basic redaction
        return connectionString.replace(/:[^:@]+@/, ':****@');
    } catch {
        return 'postgresql://...';
    }
}
