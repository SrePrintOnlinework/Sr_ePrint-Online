'use client';

import { useEffect, useState } from 'react';

export default function PaymentHistoryPage() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  // ------------------------------------
  // Load Payment History
  // ------------------------------------

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        '/api/payment-history',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setLoggedIn(false);
        setPayments([]);
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to load payment history'
        );
      }

      setPayments(data.payments || []);
      setLoggedIn(true);

    } catch (error) {
      console.error(error);

      setError(
        error?.message ||
          'Unable to load payment history'
      );

    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------
  // Login
  // ------------------------------------

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('Please enter password');
      return;
    }

    try {
      setLoginLoading(true);
      setError('');

      const response = await fetch(
        '/api/payment-history',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Invalid password'
        );
      }

      setPassword('');
      setLoggedIn(true);

      await loadPayments();

    } catch (error) {
      console.error(error);

      setError(
        error?.message ||
          'Login failed'
      );

    } finally {
      setLoginLoading(false);
    }
  };

  // ------------------------------------
  // Logout
  // ------------------------------------

  const handleLogout = async () => {
    try {
      await fetch(
        '/api/payment-history',
        {
          method: 'DELETE',
        }
      );

      setLoggedIn(false);
      setPayments([]);
      setError('');

    } catch (error) {
      console.error(error);
    }
  };

  // ------------------------------------
  // Check login when page opens
  // ------------------------------------

  useEffect(() => {
    loadPayments();
  }, []);

  // ------------------------------------
  // Format Date
  // ------------------------------------

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return '-';
    }

    try {
      return new Date(
        timestamp * 1000
      ).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return '-';
    }
  };

  // ------------------------------------
  // LOGIN SCREEN
  // ------------------------------------

  if (!loggedIn) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f5f7fb',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: '#ffffff',
            padding: '30px',
            borderRadius: '16px',
            boxShadow:
              '0 8px 30px rgba(0,0,0,0.08)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: '44px',
              marginBottom: '10px',
            }}
          >
            🔐
          </div>

          <h1
            style={{
              textAlign: 'center',
              margin: '0 0 8px',
              fontSize: '28px',
            }}
          >
            Payment History
          </h1>

          <p
            style={{
              textAlign: 'center',
              color: '#666',
              marginBottom: '25px',
            }}
          >
            Secure Login
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border:
                  '1px solid #d1d5db',
                fontSize: '16px',
                marginBottom: '15px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: '10px',
                background:
                  loginLoading
                    ? '#9ca3af'
                    : '#111827',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor:
                  loginLoading
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {loginLoading
                ? 'Checking...'
                : 'Login'}
            </button>
          </form>

          {error && (
            <div
              style={{
                marginTop: '15px',
                padding: '10px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ------------------------------------
  // PAYMENT HISTORY SCREEN
  // ------------------------------------

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Header */}

        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            boxShadow:
              '0 4px 15px rgba(0,0,0,0.05)',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '26px',
              }}
            >
              💳 Payment History
            </h1>

            <p
              style={{
                margin: '6px 0 0',
                color: '#666',
              }}
            >
              Razorpay Payments
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
            }}
          >
            <button
              onClick={loadPayments}
              disabled={loading}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔄 Refresh
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Summary */}

        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
            boxShadow:
              '0 4px 15px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '5px',
            }}
          >
            Total Payments
          </div>

          <div
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            {payments.length}
          </div>
        </div>

        {/* Loading */}

        {loading && (
          <div
            style={{
              background: '#ffffff',
              padding: '30px',
              textAlign: 'center',
              borderRadius: '14px',
            }}
          >
            Loading payments...
          </div>
        )}

        {/* Error */}

        {error && !loading && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '15px',
            }}
          >
            {error}
          </div>
        )}

        {/* No Payments */}

        {!loading &&
          payments.length === 0 && (
            <div
              style={{
                background: '#ffffff',
                padding: '30px',
                textAlign: 'center',
                borderRadius: '14px',
              }}
            >
              <div
                style={{
                  fontSize: '40px',
                  marginBottom: '10px',
                }}
              >
                💳
              </div>

              <strong>
                No payments found
              </strong>

              <p
                style={{
                  color: '#666',
                }}
              >
                Razorpay payment records
                will appear here.
              </p>
            </div>
          )}

        {/* Payment Table */}

        {!loading &&
          payments.length > 0 && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                overflowX: 'auto',
                boxShadow:
                  '0 4px 15px rgba(0,0,0,0.05)',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse:
                    'collapse',
                  minWidth: '900px',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        '#f3f4f6',
                    }}
                  >
                    <th style={thStyle}>
                      #
                    </th>

                    <th style={thStyle}>
                      Payment ID
                    </th>

                    <th style={thStyle}>
                      Order ID
                    </th>

                    <th style={thStyle}>
                      Amount
                    </th>

                    <th style={thStyle}>
                      Status
                    </th>

                    <th style={thStyle}>
                      Method
                    </th>

                    <th style={thStyle}>
                      Contact
                    </th>

                    <th style={thStyle}>
                      Date
                    </th>
                 
