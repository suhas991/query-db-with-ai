import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Database, Mail, Lock, User } from 'lucide-react';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                if (!name.trim()) {
                    throw new Error('Name is required');
                }
                await signUp(email, password, name);
            }
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                {/* Logo and Title */}
                <div className="auth-header">
                    <div className="icon-wrapper">
                        <Database className="icon-lg" />
                    </div>
                    <h1 className="auth-title">AI Database Query</h1>
                    <p className="auth-subtitle">
                        Connect and query your database with natural language
                    </p>
                </div>

                {/* Auth Form */}
                <div className="card auth-card">
                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div className="input-group">
                                <label className="input-label" htmlFor="name">
                                    Your Name
                                </label>
                                <div className="input-with-icon">
                                    <User className="input-icon" />
                                    <input
                                        id="name"
                                        type="text"
                                        className="input"
                                        placeholder="John Doe"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required={!isLogin}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="input-group">
                            <label className="input-label" htmlFor="email">
                                Email address
                            </label>
                            <div className="input-with-icon">
                                <Mail className="input-icon" />
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="password">
                                Your Password
                            </label>
                            <div className="input-with-icon">
                                <Lock className="input-icon" />
                                <input
                                    id="password"
                                    type="password"
                                    className="input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" />
                                    {isLogin ? 'Signing in...' : 'Creating account...'}
                                </>
                            ) : (
                                <>{isLogin ? 'Sign in' : 'Sign up'}</>
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                        >
                            {isLogin
                                ? "Don't have an account? Sign up"
                                : 'Already have an account? Sign in'}
                        </button>
                    </div>
                </div>

                {/* Demo Credentials */}
                <div className="demo-info">
                    <p className="demo-title">Demo Mode</p>
                    <p className="demo-text">
                        This is a demo application. Create any account to get started!
                    </p>
                </div>
            </div>

            <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-lg);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .auth-container {
          width: 100%;
          max-width: 420px;
        }

        .auth-header {
          text-align: center;
          margin-bottom: var(--space-xl);
        }

        .icon-wrapper {
          margin: 0 auto var(--space-lg);
        }

        .auth-title {
          color: var(--color-text-inverse);
          margin-bottom: var(--space-sm);
        }

        .auth-subtitle {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.875rem;
          margin-bottom: 0;
        }

        .auth-card {
          animation: slideUp 0.4s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1.25rem;
          height: 1.25rem;
          color: var(--color-text-tertiary);
          pointer-events: none;
        }

        .input-with-icon .input {
          padding-left: 3rem;
        }

        .error-message {
          padding: var(--space-md);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-md);
          color: var(--color-error);
          font-size: 0.875rem;
          margin-bottom: var(--space-lg);
        }

        .btn-full {
          width: 100%;
        }

        .auth-footer {
          margin-top: var(--space-lg);
          text-align: center;
        }

        .btn-link {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          cursor: pointer;
          transition: color var(--transition-base);
        }

        .btn-link:hover {
          color: var(--color-primary);
          text-decoration: underline;
        }

        .demo-info {
          margin-top: var(--space-xl);
          padding: var(--space-lg);
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
        }

        .demo-title {
          color: var(--color-text-inverse);
          font-weight: 600;
          margin-bottom: var(--space-sm);
        }

        .demo-text {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
          margin-bottom: 0;
        }

        @media (max-width: 768px) {
          .auth-page {
            padding: var(--space-md);
          }

          .auth-title {
            font-size: 1.5rem;
          }
        }
      `}</style>
        </div>
    );
}
