import { useState } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { testConnection } from '../services/databaseService';
import { Database, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

export default function DatabaseSidebar() {
    const {
        connections,
        selectedConnection,
        addConnection,
        deleteConnection,
        selectConnection
    } = useDatabase();

    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        connectionString: '',
        dbType: 'postgres'
    });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim() || !formData.connectionString.trim()) {
            setError('Please fill in all fields');
            return;
        }

        try {
            const newConnection = addConnection(formData);
            setFormData({ name: '', connectionString: '', dbType: 'postgres' });
            setShowAddForm(false);
            setTestResult(null);
            selectConnection(newConnection);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        setError('');

        try {
            const result = await testConnection(formData.connectionString);
            setTestResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setTesting(false);
        }
    };

    const handleDelete = (id, e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this connection?')) {
            deleteConnection(id);
        }
    };

    return (
        <div className="sidebar-container">
            {/* Header */}
            <div className="sidebar-header">
                <div className="card-header">
                    <Database className="icon" />
                    <div>
                        <h3 className="card-title">Database Connections</h3>
                        <p className="card-subtitle">Manage your databases</p>
                    </div>
                </div>
                <button
                    className="btn btn-primary btn-icon"
                    onClick={() => setShowAddForm(!showAddForm)}
                    title="Add connection"
                >
                    <Plus className="icon" />
                </button>
            </div>

            {/* Add Connection Form */}
            {showAddForm && (
                <div className="add-connection-form">
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label" htmlFor="conn-name">
                                Connection Name
                            </label>
                            <input
                                id="conn-name"
                                type="text"
                                className="input"
                                placeholder="My Production DB"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="db-type">
                                Database Type
                            </label>
                            <select
                                id="db-type"
                                className="input"
                                value={formData.dbType}
                                onChange={(e) =>
                                    setFormData({ ...formData, dbType: e.target.value })
                                }
                            >
                                <option value="postgres">PostgreSQL</option>
                                <option value="mysql">MySQL</option>
                                <option value="mongodb">MongoDB</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="conn-string">
                                Connection String
                            </label>
                            <textarea
                                id="conn-string"
                                className="input"
                                placeholder={
                                    formData.dbType === 'postgres' ? 'postgresql://user:password@host:port/database' :
                                    formData.dbType === 'mysql' ? 'mysql://user:password@host:port/database' :
                                    'mongodb://user:password@host:port/database'
                                }
                                value={formData.connectionString}
                                onChange={(e) =>
                                    setFormData({ ...formData, connectionString: e.target.value })
                                }
                                rows={3}
                            />
                            <span className="input-hint">
                                Your connection string is encrypted and stored securely
                            </span>
                        </div>

                        {error && (
                            <div className="error-message">
                                <AlertCircle className="icon" />
                                {error}
                            </div>
                        )}

                        {testResult && (
                            <div className="success-message">
                                <Check className="icon" />
                                {testResult.message}
                            </div>
                        )}

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleTestConnection}
                                disabled={testing || !formData.connectionString}
                            >
                                {testing ? (
                                    <>
                                        <div className="spinner" />
                                        Testing...
                                    </>
                                ) : (
                                    'Test Connection'
                                )}
                            </button>
                            <button type="submit" className="btn btn-primary">
                                <Plus className="icon" />
                                Add Connection
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Connections List */}
            <div className="connections-list">
                {connections.length === 0 ? (
                    <div className="empty-state-small">
                        <Database className="empty-icon" />
                        <p className="empty-text">No database connections yet</p>
                        <p className="empty-subtext">Add your first connection above</p>
                    </div>
                ) : (
                    connections.map((conn) => (
                        <div
                            key={conn.id}
                            className={`connection-item ${selectedConnection?.id === conn.id ? 'active' : ''
                                }`}
                            onClick={() => selectConnection(conn)}
                        >
                            <div className="connection-icon">
                                <Database className="icon" />
                            </div>
                            <div className="connection-info">
                                <div className="connection-name">{conn.name}</div>
                                <div className="connection-type">
                                    {conn.dbType === 'postgres' ? 'PostgreSQL' :
                                     conn.dbType === 'mysql' ? 'MySQL' :
                                     conn.dbType === 'mongodb' ? 'MongoDB' : conn.dbType}
                                </div>
                            </div>
                            <button
                                className="btn btn-ghost btn-icon delete-btn"
                                onClick={(e) => handleDelete(conn.id, e)}
                                title="Delete connection"
                            >
                                <Trash2 className="icon" />
                            </button>
                        </div>
                    ))
                )}
            </div>

                        <style>{`
        .sidebar-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: var(--space-lg);
        }

        .sidebar-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: var(--space-lg);
        }

        .add-connection-form {
          background: var(--color-bg-secondary);
          padding: var(--space-lg);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-lg);
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .form-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          margin-top: var(--space-md);
        }

        .form-actions .btn {
          width: 100%;
          justify-content: center;
        }

        .form-actions .btn-primary {
          order: -1;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-error);
          font-size: 0.875rem;
          margin-bottom: var(--space-md);
        }

        .success-message {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-success);
          font-size: 0.875rem;
          margin-bottom: var(--space-md);
        }

        .connections-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .empty-state-small {
          text-align: center;
          padding: var(--space-xl);
          color: var(--color-text-tertiary);
        }

        .empty-icon {
          width: 3rem;
          height: 3rem;
          margin: 0 auto var(--space-md);
          opacity: 0.5;
        }

        .empty-text {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-xs);
        }

        .empty-subtext {
          font-size: 0.75rem;
          margin-bottom: 0;
        }

        .connection-item {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          padding: var(--space-md);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .connection-item:hover {
          background: var(--color-surface-hover);
          border-color: var(--color-border-hover);
          transform: translateX(2px);
        }

        .connection-item.active {
          background: var(--color-primary-alpha);
          border-color: var(--color-primary);
        }

        .connection-icon {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: var(--radius-md);
          background: var(--color-primary-alpha);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .connection-item.active .connection-icon {
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .connection-info {
          flex: 1;
          min-width: 0;
        }

        .connection-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .connection-type {
          font-size: 0.75rem;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
        }

        .delete-btn {
          opacity: 0;
          transition: opacity var(--transition-base);
        }

        .connection-item:hover .delete-btn {
          opacity: 1;
        }

        .delete-btn:hover {
          color: var(--color-error);
        }
      `}</style>
        </div>
    );
}
