import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DatabaseContext = createContext(null);

export const useDatabase = () => {
    const context = useContext(DatabaseContext);
    if (!context) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return context;
};

export const DatabaseProvider = ({ children }) => {
    const { user } = useAuth();
    const [connections, setConnections] = useState([]);
    const [selectedConnection, setSelectedConnection] = useState(null);
    const [queryHistory, setQueryHistory] = useState([]);

    useEffect(() => {
        if (user) {
            // Load user's database connections
            const userConnections = JSON.parse(
                localStorage.getItem(`connections_${user.id}`) || '[]'
            );
            setConnections(userConnections);

            // Load query history
            const history = JSON.parse(
                localStorage.getItem(`query_history_${user.id}`) || '[]'
            );
            setQueryHistory(history);
        } else {
            setConnections([]);
            setSelectedConnection(null);
            setQueryHistory([]);
        }
    }, [user]);

    const addConnection = (connection) => {
        const newConnection = {
            id: Date.now().toString(),
            ...connection,
            createdAt: new Date().toISOString()
        };

        const updatedConnections = [...connections, newConnection];
        setConnections(updatedConnections);
        localStorage.setItem(
            `connections_${user.id}`,
            JSON.stringify(updatedConnections)
        );

        return newConnection;
    };

    const updateConnection = (id, updates) => {
        const updatedConnections = connections.map(conn =>
            conn.id === id ? { ...conn, ...updates, updatedAt: new Date().toISOString() } : conn
        );
        setConnections(updatedConnections);
        localStorage.setItem(
            `connections_${user.id}`,
            JSON.stringify(updatedConnections)
        );
    };

    const deleteConnection = (id) => {
        const updatedConnections = connections.filter(conn => conn.id !== id);
        setConnections(updatedConnections);
        localStorage.setItem(
            `connections_${user.id}`,
            JSON.stringify(updatedConnections)
        );

        if (selectedConnection?.id === id) {
            setSelectedConnection(null);
        }
    };

    const selectConnection = (connection) => {
        setSelectedConnection(connection);
    };

    const addQueryToHistory = (query) => {
        const newQuery = {
            id: Date.now().toString(),
            connectionId: selectedConnection?.id,
            ...query,
            createdAt: new Date().toISOString()
        };

        const updatedHistory = [newQuery, ...queryHistory].slice(0, 100); // Keep last 100 queries
        setQueryHistory(updatedHistory);
        localStorage.setItem(
            `query_history_${user.id}`,
            JSON.stringify(updatedHistory)
        );

        return newQuery;
    };

    const clearQueryHistory = () => {
        setQueryHistory([]);
        localStorage.setItem(`query_history_${user.id}`, JSON.stringify([]));
    };

    const value = {
        connections,
        selectedConnection,
        queryHistory,
        addConnection,
        updateConnection,
        deleteConnection,
        selectConnection,
        addQueryToHistory,
        clearQueryHistory
    };

    return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
};
