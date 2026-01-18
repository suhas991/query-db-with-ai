import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDatabase } from '../contexts/DatabaseContext';
import DatabaseSidebar from '../components/DatabaseSidebar';
import ChatInterface from '../components/ChatInterface';
import { Database, LogOut, Menu, X } from 'lucide-react';

export default function Dashboard() {
    const { user, signOut } = useAuth();
    const { selectedConnection } = useDatabase();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleSignOut = () => {
        signOut();
        navigate('/');
    };

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <button
                        className="btn btn-icon btn-ghost mobile-menu-btn"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X className="icon" /> : <Menu className="icon" />}
                    </button>
                    <div className="header-logo">
                        <Database className="icon" />
                        <span className="header-title">AI Database Query</span>
                    </div>
                    <span className="header-subtitle">Natural language database queries</span>
                </div>
                <div className="header-right">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="user-details">
                            <div className="user-name">{user?.name || 'User'}</div>
                            <div className="user-email">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={handleSignOut}
                        title="Sign out"
                    >
                        <LogOut className="icon" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="dashboard-content">
                {/* Sidebar */}
                <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                    <DatabaseSidebar />
                </aside>

                {/* Main Area */}
                <main className="dashboard-main">
                    {selectedConnection ? (
                        <ChatInterface />
                    ) : (
                        <div className="empty-state">
                            <Database className="empty-state-icon" />
                            <h3 className="empty-state-title">No database selected</h3>
                            <p className="empty-state-description">
                                Select or add a database connection to start querying
                            </p>
                        </div>
                    )}
                </main>
            </div>

            <style>{`
        .dashboard {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg-primary);
        }

        .dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-lg) var(--space-xl);
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: var(--space-lg);
        }

        .mobile-menu-btn {
          display: none;
        }

        .header-logo {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          color: var(--color-primary);
        }

        .header-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .header-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-tertiary);
          display: none;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .user-avatar {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          color: var(--color-text-inverse);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1rem;
        }

        .user-details {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .user-email {
          font-size: 0.75rem;
          color: var(--color-text-tertiary);
        }

        .dashboard-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .dashboard-sidebar {
          width: 320px;
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          overflow-y: auto;
          transition: transform var(--transition-base);
        }

        .dashboard-sidebar.closed {
          transform: translateX(-100%);
          width: 0;
        }

        .dashboard-main {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 1024px) {
          .header-subtitle {
            display: none;
          }

          .user-details {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .dashboard-header {
            padding: var(--space-md);
          }

          .mobile-menu-btn {
            display: flex;
          }

          .header-left {
            gap: var(--space-md);
          }

          .header-subtitle {
            display: none;
          }

          .dashboard-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            z-index: 100;
            box-shadow: var(--shadow-xl);
          }

          .dashboard-sidebar.closed {
            transform: translateX(-100%);
          }
        }
      `}</style>
        </div>
    );
}
