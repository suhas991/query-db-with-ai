import { useState, useRef, useEffect } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { generateSQLQuery, explainSQLQuery, analyzeQuery, generateQuerySuggestions } from '../services/aiService';
import { executeQuery, getDatabaseSchema } from '../services/databaseService';
import { Send, Play, HelpCircle, AlertCircle, Loader2, Sparkles, Database, ChevronDown, ChevronUp, Copy, Check, AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function ChatInterface() {
    const { selectedConnection, addQueryToHistory } = useDatabase();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [schema, setSchema] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load schema when connection changes
    useEffect(() => {
        if (selectedConnection) {
            loadSchema();
            setMessages([{
                id: 'welcome',
                role: 'system',
                content: `Connected to **${selectedConnection.name}**. Ask me anything about your database!`,
                timestamp: new Date()
            }]);
        }
    }, [selectedConnection]);

    // Update suggestions when schema changes
    useEffect(() => {
        if (schema) {
            const newSuggestions = generateQuerySuggestions(schema, selectedConnection?.dbType);
            setSuggestions(newSuggestions);
        }
    }, [schema, selectedConnection?.dbType]);

    const loadSchema = async () => {
        if (!selectedConnection) return;
        try {
            const schemaData = await getDatabaseSchema(selectedConnection.connectionString, selectedConnection.dbType);
            setSchema(schemaData);
        } catch (error) {
            console.error('Failed to load schema:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedConnection || loading) return;

        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Generate SQL with the improved service - pass conversation history for context
            const dbType = selectedConnection?.dbType || 'postgres';
            const result = await generateSQLQuery(input, schema, dbType, {
                conversationHistory: messages // Pass existing messages for context
            });

            const aiMessageId = (Date.now() + 1).toString();
            const queryType = dbType === 'mongodb' ? 'MongoDB Query' : 'SQL Query';

            // Check for validation warnings
            const warningMessage = result.validation.warnings.length > 0
                ? `\n\n⚠️ Note: ${result.validation.warnings.join(', ')}`
                : '';

            setMessages(prev => [...prev, {
                id: aiMessageId,
                role: 'assistant',
                content: `I generated this ${queryType} for you:${warningMessage}`,
                sql: result.query,
                queryAnalysis: result.analysis,
                timestamp: new Date()
            }]);

            // Check if query requires confirmation
            if (result.analysis.requiresConfirmation) {
                setConfirmDialog({
                    messageId: aiMessageId,
                    query: result.query,
                    analysis: result.analysis,
                    onConfirm: () => {
                        handleExecuteQuery(result.query, aiMessageId);
                        setConfirmDialog(null);
                    },
                    onCancel: () => {
                        setMessages(prev => prev.map(msg =>
                            msg.id === aiMessageId ? { ...msg, executionStatus: 'cancelled' } : msg
                        ));
                        setConfirmDialog(null);
                    }
                });
            } else {
                // Execute automatically for safe queries
                await handleExecuteQuery(result.query, aiMessageId);
            }

        } catch (error) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'error',
                content: error.message,
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteQuery = async (sql, messageId) => {
        try {
            console.log('Executing Query:', {
                connectionString: selectedConnection?.connectionString ? '***hidden***' : null,
                sql: sql,
                dbType: selectedConnection?.dbType
            });

            if (!selectedConnection?.connectionString) {
                throw new Error('No connection string found. Please check your database connection settings.');
            }

            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, executionStatus: 'running' } : msg
            ));

            const result = await executeQuery(selectedConnection.connectionString, sql, selectedConnection.dbType);

            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? {
                    ...msg,
                    executionStatus: 'success',
                    result: result
                } : msg
            ));

            addQueryToHistory({
                query: sql,
                timestamp: new Date().toISOString(),
                status: 'success',
                connectionId: selectedConnection.id,
                rowCount: result.rowCount,
                executionTime: result.executionTime
            });

        } catch (error) {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? {
                    ...msg,
                    executionStatus: 'error',
                    executionError: error.message
                } : msg
            ));

            addQueryToHistory({
                query: sql,
                timestamp: new Date().toISOString(),
                status: 'error',
                connectionId: selectedConnection.id,
                error: error.message
            });
        }
    };

    const handleRetryQuery = async (messageId) => {
        const message = messages.find(m => m.id === messageId);
        if (message?.sql) {
            await handleExecuteQuery(message.sql, messageId);
        }
    };

    const handleExplain = async (sql) => {
        try {
            setLoading(true);
            const explanation = await explainSQLQuery(sql, selectedConnection?.dbType);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `**Explanation:**\n\n${explanation}`,
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error('Failed to explain:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'error',
                content: `Failed to explain query: ${error.message}`,
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-interface">
            {/* Confirmation Dialog */}
            {confirmDialog && (
                <ConfirmationDialog
                    query={confirmDialog.query}
                    analysis={confirmDialog.analysis}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={confirmDialog.onCancel}
                />
            )}

            <div className="chat-messages">
                {messages.map(msg => (
                    <MessageItem
                        key={msg.id}
                        message={msg}
                        onExecute={(sql) => handleExecuteQuery(sql, msg.id)}
                        onExplain={handleExplain}
                        onRetry={() => handleRetryQuery(msg.id)}
                    />
                ))}
                {loading && (
                    <div className="message assistant loading">
                        <div className="message-avatar">
                            <Sparkles className="icon" />
                        </div>
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <form onSubmit={handleSubmit} className="chat-input-form">
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Ask a question about your database..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={loading || !selectedConnection}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary btn-icon"
                        disabled={loading || !input.trim() || !selectedConnection}
                    >
                        {loading ? <Loader2 className="icon spin" /> : <Send className="icon" />}
                    </button>
                </form>
                <div className="chat-suggestions">
                    <span className="suggestion-label">Try asking:</span>
                    {suggestions.length > 0 ? (
                        suggestions.slice(0, 3).map((suggestion, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => setInput(suggestion)}
                                className="suggestion-chip"
                            >
                                {suggestion}
                            </button>
                        ))
                    ) : (
                        <>
                            <button type="button" onClick={() => setInput("Show me all tables")} className="suggestion-chip">
                                Show me all tables
                            </button>
                            <button type="button" onClick={() => setInput("Latest 10 orders")} className="suggestion-chip">
                                Latest 10 orders
                            </button>
                            <button type="button" onClick={() => setInput("Count total users")} className="suggestion-chip">
                                Count total users
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ConfirmationDialog({ query, analysis, onConfirm, onCancel }) {
    return (
        <div className="confirmation-overlay">
            <div className="confirmation-dialog">
                <div className="confirmation-header">
                    <AlertTriangle className="icon-warning" />
                    <h3>Confirm Dangerous Operation</h3>
                </div>
                <div className="confirmation-body">
                    <p>This query will perform a <strong>{analysis.type.toUpperCase()}</strong> operation that could:</p>
                    <ul>
                        {analysis.keywords?.isDangerous && analysis.type === 'ddl' && (
                            <li>Permanently delete tables or data structures</li>
                        )}
                        {query.toUpperCase().includes('DELETE') && (
                            <li>Remove records from your database</li>
                        )}
                        {query.toUpperCase().includes('TRUNCATE') && (
                            <li>Remove ALL records from a table</li>
                        )}
                        {query.toUpperCase().includes('DROP') && (
                            <li>Permanently drop database objects</li>
                        )}
                    </ul>
                    <div className="confirmation-query">
                        <code>{query}</code>
                    </div>
                    <p className="confirmation-warning">This action cannot be undone!</p>
                </div>
                <div className="confirmation-actions">
                    <button className="btn btn-ghost" onClick={onCancel}>
                        <X className="icon-sm" /> Cancel
                    </button>
                    <button className="btn btn-danger" onClick={onConfirm}>
                        <Play className="icon-sm" /> Execute Anyway
                    </button>
                </div>
            </div>

            <style>{`
                .confirmation-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                
                .confirmation-dialog {
                    background: var(--color-surface);
                    border-radius: var(--radius-xl);
                    padding: var(--space-xl);
                    max-width: 500px;
                    width: 90%;
                    box-shadow: var(--shadow-xl);
                    border: 1px solid var(--color-border);
                }
                
                .confirmation-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-md);
                    margin-bottom: var(--space-lg);
                }
                
                .confirmation-header h3 {
                    margin: 0;
                    color: var(--color-text-primary);
                    font-size: 1.25rem;
                }
                
                .icon-warning {
                    width: 2rem;
                    height: 2rem;
                    color: var(--color-warning);
                }
                
                .confirmation-body {
                    margin-bottom: var(--space-lg);
                }
                
                .confirmation-body p {
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--space-md) 0;
                }
                
                .confirmation-body ul {
                    margin: 0 0 var(--space-md) 0;
                    padding-left: var(--space-lg);
                    color: var(--color-text-secondary);
                }
                
                .confirmation-body li {
                    margin-bottom: var(--space-xs);
                }
                
                .confirmation-query {
                    background: var(--color-bg-tertiary);
                    padding: var(--space-md);
                    border-radius: var(--radius-md);
                    overflow-x: auto;
                    margin-bottom: var(--space-md);
                }
                
                .confirmation-query code {
                    font-family: 'Fira Code', 'Monaco', monospace;
                    font-size: 0.875rem;
                    color: var(--color-error);
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                
                .confirmation-warning {
                    color: var(--color-error) !important;
                    font-weight: 600;
                }
                
                .confirmation-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--space-md);
                }
                
                .btn-danger {
                    background: var(--color-error);
                    color: white;
                    border: none;
                }
                
                .btn-danger:hover {
                    background: #dc2626;
                }
            `}</style>
        </div>
    );
}

function MessageItem({ message, onExecute, onExplain, onRetry }) {
    const [expanded, setExpanded] = useState(true);
    const [copied, setCopied] = useState(false);
    const { selectedConnection } = useDatabase();

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (message.role === 'system') {
        return (
            <div className="message system">
                <div className="system-content">
                    <Database className="icon-sm" />
                    <span dangerouslySetInnerHTML={{ __html: message.content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                </div>
            </div>
        );
    }

    if (message.role === 'error') {
        return (
            <div className="message error">
                <div className="message-avatar error">
                    <AlertCircle className="icon" />
                </div>
                <div className="message-content error-content">
                    <div className="error-text">{message.content}</div>
                    <div className="error-hint">
                        Try rephrasing your question or check your database connection.
                    </div>
                </div>
            </div>
        );
    }

    const isUser = message.role === 'user';

    return (
        <div className={`message ${isUser ? 'user' : 'assistant'}`}>
            <div className="message-avatar">
                {isUser ? (
                    <div className="user-avatar-sm">U</div>
                ) : (
                    <Sparkles className="icon" />
                )}
            </div>

            <div className="message-body">
                {message.content && (
                    <div className="message-content" dangerouslySetInnerHTML={{
                        __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>')
                    }} />
                )}

                {message.sql && (
                    <div className="sql-block">
                        <div className="sql-header">
                            <span className="sql-label">
                                {selectedConnection?.dbType === 'mongodb' ? 'MongoDB Query' : 'SQL Query'}
                                {message.queryAnalysis?.type && (
                                    <span className={`query-type-badge ${message.queryAnalysis.type}`}>
                                        {message.queryAnalysis.type.toUpperCase()}
                                    </span>
                                )}
                            </span>
                            <div className="sql-actions">
                                <button
                                    className="btn-icon-sm"
                                    onClick={() => copyToClipboard(message.sql)}
                                    title="Copy SQL"
                                >
                                    {copied ? <Check className="icon-xs" /> : <Copy className="icon-xs" />}
                                </button>
                                <button
                                    className="btn-icon-sm"
                                    onClick={() => setExpanded(!expanded)}
                                >
                                    {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
                                </button>
                            </div>
                        </div>

                        {expanded && (
                            <div className="sql-code">
                                <code>{message.sql}</code>
                            </div>
                        )}

                        <div className="sql-footer">
                            <button
                                className="btn btn-sm btn-outline"
                                onClick={() => onExplain(message.sql)}
                            >
                                <HelpCircle className="icon-sm" /> Explain
                            </button>
                            {message.executionStatus !== 'success' && message.executionStatus !== 'running' && (
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => onExecute(message.sql)}
                                >
                                    <Play className="icon-sm" /> Execute
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {message.executionStatus === 'running' && (
                    <div className="execution-status running">
                        <Loader2 className="icon-sm spin" /> Executing query...
                    </div>
                )}

                {message.executionStatus === 'cancelled' && (
                    <div className="execution-status cancelled">
                        <AlertCircle className="icon-sm" /> Query execution was cancelled
                    </div>
                )}

                {message.executionStatus === 'error' && (
                    <div className="execution-status error">
                        <AlertCircle className="icon-sm" />
                        <div className="execution-error-content">
                            <span>Error: {message.executionError}</span>
                            <button
                                className="btn btn-sm btn-outline retry-btn"
                                onClick={onRetry}
                            >
                                <RefreshCw className="icon-xs" /> Retry
                            </button>
                        </div>
                    </div>
                )}

                {message.executionStatus === 'success' && message.result && (
                    <div className="execution-result">
                        <div className="result-header">
                            <span className="result-count">
                                {message.result.rowCount} {message.result.rowCount === 1 ? 'result' : 'results'} found
                                <span className="result-time">({Math.round(message.result.executionTime)}ms)</span>
                            </span>
                        </div>
                        {message.result.rows && message.result.rows.length > 0 ? (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            {message.result.columns.map(col => (
                                                <th key={col}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {message.result.rows.map((row, i) => (
                                            <tr key={i}>
                                                {message.result.columns.map(col => (
                                                    <td key={`${i}-${col}`}>
                                                        {formatCellValue(row[col])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-result">
                                <p>Query executed successfully with no rows returned.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .query-type-badge {
                    font-size: 0.625rem;
                    padding: 2px 6px;
                    border-radius: var(--radius-sm);
                    margin-left: var(--space-sm);
                    text-transform: uppercase;
                    font-weight: 600;
                }
                
                .query-type-badge.read {
                    background: rgba(34, 197, 94, 0.2);
                    color: #22c55e;
                }
                
                .query-type-badge.write {
                    background: rgba(234, 179, 8, 0.2);
                    color: #eab308;
                }
                
                .query-type-badge.ddl {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }
                
                .error-hint {
                    font-size: 0.75rem;
                    color: var(--color-text-tertiary);
                    margin-top: var(--space-xs);
                }
                
                .execution-status.cancelled {
                    background: rgba(156, 163, 175, 0.1);
                    color: var(--color-text-tertiary);
                    padding: var(--space-sm) var(--space-md);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    gap: var(--space-sm);
                    font-size: 0.875rem;
                }
                
                .execution-error-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex: 1;
                    gap: var(--space-md);
                }
                
                .retry-btn {
                    flex-shrink: 0;
                }
                
                .empty-result {
                    padding: var(--space-md);
                    text-align: center;
                    color: var(--color-text-tertiary);
                    font-size: 0.875rem;
                }
            `}</style>
        </div>
    );
}

/**
 * Format cell value for display
 */
function formatCellValue(value) {
    if (value === null || value === undefined) {
        return <span className="null-value">NULL</span>;
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    return value.toString();
}
