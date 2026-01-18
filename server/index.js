const express = require('express');
const cors = require('cors');
const { Client, Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const CONFIG = {
    queryTimeout: 30000, // 30 seconds
    maxResultRows: 1000, // Limit result rows
    poolMaxConnections: 10,
    poolIdleTimeout: 30000,
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Connection pools/cache
const pools = new Map();
const mongoClients = new Map();

// Helper to detect database type from connection string
const getDatabaseType = (connectionString) => {
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
        return 'postgres';
    } else if (connectionString.startsWith('mysql://')) {
        return 'mysql';
    } else if (connectionString.startsWith('mongodb://') || connectionString.startsWith('mongodb+srv://')) {
        return 'mongodb';
    }
    // Default to postgres for backward compatibility
    return 'postgres';
};

// Helper to get or create a pool for PostgreSQL
const getPostgresPool = (connectionString) => {
    if (!pools.has(connectionString)) {
        const pool = new Pool({
            connectionString,
            ssl: {
                rejectUnauthorized: false // Allow self-signed certs (common in cloud DBs)
            },
            max: CONFIG.poolMaxConnections,
            idleTimeoutMillis: CONFIG.poolIdleTimeout,
            connectionTimeoutMillis: 10000,
            statement_timeout: CONFIG.queryTimeout,
        });

        pool.on('error', (err) => {
            console.error('PostgreSQL pool error:', err);
        });

        pools.set(connectionString, pool);
    }
    return pools.get(connectionString);
};

// Helper to get or create a MySQL connection pool
const getMySQLPool = (connectionString) => {
    if (!pools.has(connectionString)) {
        const pool = mysql.createPool({
            uri: connectionString,
            connectionLimit: CONFIG.poolMaxConnections,
            acquireTimeout: 60000,
            timeout: CONFIG.queryTimeout,
            waitForConnections: true,
            queueLimit: 0,
        });
        pools.set(connectionString, pool);
    }
    return pools.get(connectionString);
};

// Helper to get or create a MongoDB client
const getMongoClient = async (connectionString) => {
    if (!mongoClients.has(connectionString)) {
        const client = new MongoClient(connectionString, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: CONFIG.queryTimeout,
        });
        await client.connect();
        mongoClients.set(connectionString, client);
    }
    return mongoClients.get(connectionString);
};

// Close MongoDB client on error
const closeMongoClient = async (connectionString) => {
    if (mongoClients.has(connectionString)) {
        try {
            await mongoClients.get(connectionString).close();
        } catch (e) {
            console.error('Error closing MongoDB client:', e);
        }
        mongoClients.delete(connectionString);
    }
};

/**
 * Wrap query execution with timeout
 */
const withTimeout = (promise, timeoutMs, errorMessage) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage || `Query timeout after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

/**
 * Sanitize and validate query before execution
 */
const validateQuery = (query, dbType) => {
    if (!query || typeof query !== 'string') {
        throw new Error('Query must be a non-empty string');
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
        throw new Error('Query cannot be empty');
    }

    if (trimmedQuery.length > 50000) {
        throw new Error('Query is too long (max 50000 characters)');
    }

    return trimmedQuery;
};

/**
 * Parse and validate MongoDB query
 */
const parseMongoQuery = (query) => {
    let mongoQuery;
    try {
        mongoQuery = JSON.parse(query);
    } catch (parseError) {
        throw new Error('Invalid MongoDB query format: Expected valid JSON');
    }

    if (!mongoQuery.collection) {
        throw new Error('MongoDB query must specify a collection');
    }

    const validOperations = ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments', 'aggregate'];
    if (mongoQuery.operation && !validOperations.includes(mongoQuery.operation)) {
        throw new Error(`Invalid MongoDB operation: ${mongoQuery.operation}. Valid operations: ${validOperations.join(', ')}`);
    }

    return mongoQuery;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Test Database Connection
app.post('/api/test-connection', async (req, res) => {
    const { connectionString } = req.body;

    if (!connectionString) {
        return res.status(400).json({ error: 'Connection string is required' });
    }

    const dbType = getDatabaseType(connectionString);

    try {
        let result;
        switch (dbType) {
            case 'postgres':
                const pgClient = new Client({
                    connectionString,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    connectionTimeoutMillis: 10000,
                });
                await withTimeout(pgClient.connect(), 10000, 'PostgreSQL connection timeout');
                result = await pgClient.query('SELECT version()');
                await pgClient.end();
                res.json({
                    success: true,
                    message: 'Successfully connected to PostgreSQL',
                    version: result.rows[0].version,
                    dbType: 'postgres'
                });
                break;

            case 'mysql':
                const mysqlConnection = await withTimeout(
                    mysql.createConnection(connectionString),
                    10000,
                    'MySQL connection timeout'
                );
                result = await mysqlConnection.execute('SELECT VERSION() as version');
                await mysqlConnection.end();
                res.json({
                    success: true,
                    message: 'Successfully connected to MySQL',
                    version: result[0][0].version,
                    dbType: 'mysql'
                });
                break;

            case 'mongodb':
                const mongoClient = new MongoClient(connectionString, {
                    serverSelectionTimeoutMS: 10000,
                });
                await withTimeout(mongoClient.connect(), 10000, 'MongoDB connection timeout');
                const adminDb = mongoClient.db().admin();
                const serverInfo = await adminDb.serverInfo();
                await mongoClient.close();
                res.json({
                    success: true,
                    message: 'Successfully connected to MongoDB',
                    version: serverInfo.version,
                    dbType: 'mongodb'
                });
                break;

            default:
                throw new Error('Unsupported database type');
        }
    } catch (error) {
        console.error('Connection error:', error);

        // Provide helpful error messages
        let errorMessage = error.message;
        if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused. Please check if the database server is running and accessible.';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Host not found. Please check the database hostname.';
        } else if (error.message.includes('authentication')) {
            errorMessage = 'Authentication failed. Please check your username and password.';
        } else if (error.message.includes('SSL')) {
            errorMessage = 'SSL connection error. The database may require specific SSL configuration.';
        }

        res.status(500).json({
            success: false,
            message: 'Connection failed',
            error: errorMessage
        });
    }
});

// 2. Execute Query
app.post('/api/query', async (req, res) => {
    const { connectionString, query, dbType } = req.body;

    if (!connectionString || !query) {
        return res.status(400).json({ error: 'Connection string and query are required' });
    }

    const detectedDbType = dbType || getDatabaseType(connectionString);

    try {
        // Validate query
        const validatedQuery = validateQuery(query, detectedDbType);

        const start = Date.now();
        let result;

        switch (detectedDbType) {
            case 'postgres':
                const pgPool = getPostgresPool(connectionString);

                // Execute with timeout
                result = await withTimeout(
                    pgPool.query(validatedQuery),
                    CONFIG.queryTimeout,
                    'PostgreSQL query timeout'
                );

                const duration = Date.now() - start;

                // Limit result rows
                const rows = result.rows || [];
                const limitedRows = rows.slice(0, CONFIG.maxResultRows);
                const hasMore = rows.length > CONFIG.maxResultRows;

                res.json({
                    success: true,
                    rows: limitedRows,
                    columns: result.fields ? result.fields.map(f => f.name) : [],
                    rowCount: result.rowCount,
                    executionTime: duration,
                    dbType: 'postgres',
                    hasMore,
                    totalRows: rows.length
                });
                break;

            case 'mysql':
                const mysqlPool = getMySQLPool(connectionString);

                const mysqlResult = await withTimeout(
                    mysqlPool.execute(validatedQuery),
                    CONFIG.queryTimeout,
                    'MySQL query timeout'
                );

                const mysqlDuration = Date.now() - start;

                // mysqlResult is [rows, fields]
                const mysqlRowsRaw = mysqlResult[0];
                const mysqlFields = mysqlResult[1];

                let normalizedRows = [];
                let columns = [];
                let rowCount = 0;

                if (Array.isArray(mysqlRowsRaw)) {
                    normalizedRows = mysqlRowsRaw.slice(0, CONFIG.maxResultRows);
                    rowCount = mysqlRowsRaw.length;
                    columns = mysqlFields ? mysqlFields.map(f => f.name) : (normalizedRows[0] ? Object.keys(normalizedRows[0]) : []);
                } else if (mysqlRowsRaw && typeof mysqlRowsRaw === 'object') {
                    // This is likely an OkPacket / ResultSetHeader for write operations
                    normalizedRows = [mysqlRowsRaw];
                    rowCount = typeof mysqlRowsRaw.affectedRows === 'number' ? mysqlRowsRaw.affectedRows : 1;
                    columns = Object.keys(mysqlRowsRaw);
                }

                res.json({
                    success: true,
                    rows: normalizedRows,
                    columns,
                    rowCount,
                    executionTime: mysqlDuration,
                    dbType: 'mysql',
                    hasMore: Array.isArray(mysqlRowsRaw) && mysqlRowsRaw.length > CONFIG.maxResultRows
                });
                break;

            case 'mongodb':
                try {
                    const mongoClient = await getMongoClient(connectionString);
                    const db = mongoClient.db();

                    // Parse MongoDB query
                    const mongoQuery = parseMongoQuery(validatedQuery);
                    const collection = db.collection(mongoQuery.collection);
                    let mongoResult;

                    switch (mongoQuery.operation || 'find') {
                        case 'find':
                            mongoResult = await withTimeout(
                                collection.find(mongoQuery.filter || {})
                                    .limit(Math.min(mongoQuery.limit || 100, CONFIG.maxResultRows))
                                    .toArray(),
                                CONFIG.queryTimeout,
                                'MongoDB query timeout'
                            );
                            break;

                        case 'findOne':
                            const doc = await withTimeout(
                                collection.findOne(mongoQuery.filter || {}),
                                CONFIG.queryTimeout,
                                'MongoDB query timeout'
                            );
                            mongoResult = doc ? [doc] : [];
                            break;

                        case 'insertOne':
                            if (!mongoQuery.document) {
                                throw new Error('insertOne requires a "document" field');
                            }
                            mongoResult = await collection.insertOne(mongoQuery.document);
                            break;

                        case 'insertMany':
                            if (!mongoQuery.documents || !Array.isArray(mongoQuery.documents)) {
                                throw new Error('insertMany requires a "documents" array');
                            }
                            mongoResult = await collection.insertMany(mongoQuery.documents);
                            break;

                        case 'updateOne':
                            if (!mongoQuery.update) {
                                throw new Error('updateOne requires an "update" field');
                            }
                            mongoResult = await collection.updateOne(
                                mongoQuery.filter || {},
                                mongoQuery.update
                            );
                            break;

                        case 'updateMany':
                            if (!mongoQuery.update) {
                                throw new Error('updateMany requires an "update" field');
                            }
                            mongoResult = await collection.updateMany(
                                mongoQuery.filter || {},
                                mongoQuery.update
                            );
                            break;

                        case 'deleteOne':
                            mongoResult = await collection.deleteOne(mongoQuery.filter || {});
                            break;

                        case 'deleteMany':
                            mongoResult = await collection.deleteMany(mongoQuery.filter || {});
                            break;

                        case 'countDocuments':
                            const count = await collection.countDocuments(mongoQuery.filter || {});
                            mongoResult = [{ count }];
                            break;

                        case 'aggregate':
                            if (!mongoQuery.pipeline || !Array.isArray(mongoQuery.pipeline)) {
                                throw new Error('aggregate requires a "pipeline" array');
                            }
                            mongoResult = await collection.aggregate(mongoQuery.pipeline).toArray();
                            break;

                        default:
                            throw new Error(`Unsupported MongoDB operation: ${mongoQuery.operation}`);
                    }

                    const mongoDuration = Date.now() - start;

                    // Format response based on operation type
                    let responseRows, responseColumns, responseRowCount;

                    if (Array.isArray(mongoResult)) {
                        responseRows = mongoResult.slice(0, CONFIG.maxResultRows);
                        responseColumns = mongoResult.length > 0 ? Object.keys(mongoResult[0]) : [];
                        responseRowCount = mongoResult.length;
                    } else {
                        // Write operation results
                        responseRows = [mongoResult];
                        responseColumns = Object.keys(mongoResult);
                        responseRowCount = mongoResult.modifiedCount || mongoResult.deletedCount ||
                            mongoResult.insertedCount || (mongoResult.insertedId ? 1 : 0);
                    }

                    res.json({
                        success: true,
                        rows: responseRows,
                        columns: responseColumns,
                        rowCount: responseRowCount,
                        executionTime: mongoDuration,
                        dbType: 'mongodb'
                    });
                } catch (mongoError) {
                    // Close and remove client on error
                    await closeMongoClient(connectionString);
                    throw mongoError;
                }
                break;

            default:
                throw new Error('Unsupported database type');
        }
    } catch (error) {
        console.error('Query error:', error);

        // Provide helpful error messages
        let errorMessage = error.message;
        let errorCode = 'QUERY_ERROR';

        if (error.message.includes('timeout')) {
            errorMessage = `Query execution timed out after ${CONFIG.queryTimeout / 1000} seconds. Try simplifying your query or adding LIMIT.`;
            errorCode = 'TIMEOUT';
        } else if (error.code === '42P01' || error.message.includes('does not exist')) {
            errorMessage = 'Table or column does not exist. Please check your query.';
            errorCode = 'NOT_FOUND';
        } else if (error.code === '42601' || error.message.includes('syntax error')) {
            errorMessage = `SQL syntax error: ${error.message}`;
            errorCode = 'SYNTAX_ERROR';
        } else if (error.message.includes('permission denied')) {
            errorMessage = 'Permission denied. You may not have access to perform this operation.';
            errorCode = 'PERMISSION_DENIED';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            errorCode,
            originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 3. Get Database Schema (for AI context)
app.post('/api/schema', async (req, res) => {
    const { connectionString, dbType } = req.body;

    if (!connectionString) {
        return res.status(400).json({ error: 'Connection string is required' });
    }

    const detectedDbType = dbType || getDatabaseType(connectionString);

    try {
        switch (detectedDbType) {
            case 'postgres':
                // Enhanced schema query with primary key and identity column info
                const schemaQuery = `
                SELECT
                  c.table_name,
                  c.column_name,
                  c.data_type,
                  c.is_nullable,
                  c.column_default,
                  c.is_identity,
                  CASE 
                    WHEN c.column_default LIKE 'nextval%' THEN 'YES'
                    ELSE 'NO'
                  END as is_serial,
                  CASE 
                    WHEN pk.column_name IS NOT NULL THEN 'YES'
                    ELSE 'NO'
                  END as is_primary_key,
                  CASE
                    WHEN c.column_default IS NOT NULL 
                         OR c.is_identity = 'YES' 
                         OR c.column_default LIKE 'nextval%'
                         OR c.data_type IN ('uuid') AND c.column_default LIKE '%uuid%'
                    THEN 'YES'
                    ELSE 'NO'
                  END as is_auto_generated
                FROM
                  information_schema.columns c
                LEFT JOIN (
                  SELECT ku.table_name, ku.column_name
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage ku 
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                  WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = 'public'
                ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
                WHERE
                  c.table_schema = 'public'
                ORDER BY
                  c.table_name, c.ordinal_position
                LIMIT 500;
              `;
                const pgPool = getPostgresPool(connectionString);
                const result = await withTimeout(
                    pgPool.query(schemaQuery),
                    10000,
                    'Schema query timeout'
                );

                // Group by table
                const tables = {};
                result.rows.forEach(row => {
                    if (!tables[row.table_name]) {
                        tables[row.table_name] = [];
                    }

                    // Determine if column should be excluded from INSERT
                    const isAutoGenerated = row.is_auto_generated === 'YES' ||
                        row.is_identity === 'YES' ||
                        row.is_serial === 'YES' ||
                        (row.is_primary_key === 'YES' && row.column_default);

                    tables[row.table_name].push({
                        name: row.column_name,
                        type: row.data_type,
                        nullable: row.is_nullable === 'YES',
                        default: row.column_default,
                        isPrimaryKey: row.is_primary_key === 'YES',
                        isAutoGenerated: isAutoGenerated,
                        excludeFromInsert: isAutoGenerated
                    });
                });

                res.json({
                    success: true,
                    tables: tables,
                    dbType: 'postgres'
                });
                break;

            case 'mysql':
                // Enhanced MySQL schema query with primary key and auto_increment info
                const mysqlSchemaQuery = `
                SELECT
                  c.TABLE_NAME as table_name,
                  c.COLUMN_NAME as column_name,
                  c.DATA_TYPE as data_type,
                  c.IS_NULLABLE as is_nullable,
                  c.COLUMN_DEFAULT as column_default,
                  c.COLUMN_KEY as column_key,
                  c.EXTRA as extra
                FROM
                  information_schema.COLUMNS c
                WHERE
                  c.TABLE_SCHEMA = DATABASE()
                ORDER BY
                  c.TABLE_NAME, c.ORDINAL_POSITION
                LIMIT 500;
              `;
                const mysqlPool = getMySQLPool(connectionString);
                const mysqlResult = await withTimeout(
                    mysqlPool.execute(mysqlSchemaQuery),
                    10000,
                    'Schema query timeout'
                );

                // Group by table
                const mysqlTables = {};
                mysqlResult[0].forEach(row => {
                    if (!mysqlTables[row.table_name]) {
                        mysqlTables[row.table_name] = [];
                    }

                    // Check if column is auto-generated
                    const isAutoIncrement = row.extra && row.extra.toLowerCase().includes('auto_increment');
                    const isPrimaryKey = row.column_key === 'PRI';
                    const hasDefault = row.column_default !== null;
                    const isAutoGenerated = isAutoIncrement ||
                        (isPrimaryKey && (isAutoIncrement || row.extra?.includes('DEFAULT_GENERATED')));

                    mysqlTables[row.table_name].push({
                        name: row.column_name,
                        type: row.data_type,
                        nullable: row.is_nullable === 'YES',
                        default: row.column_default,
                        isPrimaryKey: isPrimaryKey,
                        isAutoGenerated: isAutoGenerated,
                        excludeFromInsert: isAutoGenerated
                    });
                });

                res.json({
                    success: true,
                    tables: mysqlTables,
                    dbType: 'mysql'
                });
                break;

            case 'mongodb':
                const mongoClient = await getMongoClient(connectionString);
                const db = mongoClient.db();

                const collections = await db.listCollections().toArray();
                const mongoTables = {};

                for (const collection of collections.slice(0, 50)) { // Limit collections
                    const collectionName = collection.name;
                    try {
                        // Get sample documents to infer schema
                        const sampleDocs = await db.collection(collectionName)
                            .find()
                            .limit(5)
                            .toArray();

                        if (sampleDocs.length > 0) {
                            // Merge fields from all sample documents
                            const fieldMap = new Map();

                            for (const doc of sampleDocs) {
                                for (const [key, value] of Object.entries(doc)) {
                                    if (key !== '_id' && !fieldMap.has(key)) {
                                        let fieldType = typeof value;
                                        if (value === null) fieldType = 'null';
                                        else if (Array.isArray(value)) fieldType = 'array';
                                        else if (value instanceof Date) fieldType = 'date';

                                        fieldMap.set(key, { name: key, type: fieldType });
                                    }
                                }
                            }

                            mongoTables[collectionName] = Array.from(fieldMap.values());
                        } else {
                            mongoTables[collectionName] = [];
                        }
                    } catch (error) {
                        console.warn(`Could not get schema for collection ${collectionName}:`, error);
                        mongoTables[collectionName] = [];
                    }
                }

                res.json({
                    success: true,
                    tables: mongoTables,
                    dbType: 'mongodb'
                });
                break;

            default:
                throw new Error('Unsupported database type');
        }
    } catch (error) {
        console.error('Schema error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');

    // Close all PostgreSQL/MySQL pools
    for (const [, pool] of pools) {
        try {
            await pool.end();
        } catch (e) {
            console.error('Error closing pool:', e);
        }
    }

    // Close all MongoDB clients
    for (const [, client] of mongoClients) {
        try {
            await client.close();
        } catch (e) {
            console.error('Error closing MongoDB client:', e);
        }
    }

    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   - Query timeout: ${CONFIG.queryTimeout / 1000}s`);
    console.log(`   - Max result rows: ${CONFIG.maxResultRows}`);
});
