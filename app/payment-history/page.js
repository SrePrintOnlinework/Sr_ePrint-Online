'use client';

import { useEffect, useState } from 'react';

export default function PaymentHistoryPage() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  // Check login and load payments
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
          data?.error || 'Unable to load payments'
        );
      }

      setPayments(data.payments || []);
      setLoggedIn(true);
    } catch (err) {
      console.error(err);
      setError(
        err?.message || 'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  };

  // Login
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
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Invalid password'
        );
      }

      setPassword('');
      await loadPayments();
    } catch (err) {
      console.error(err);
      setError(
        err?.message || 'Login failed'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout
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
    } catch (err) {
      console.error(err);
    }
  };

  // Date format
  const formatDate = (timestamp) => {
    if (!timestamp) {
      return '-';
    }

    return new Date(
      timestamp * 1000
    ).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  useEffect(() => {
    loadPayments();
  }, []);

  // ------------------------------------
  // LOGIN PAGE
  // ------------------------------------

  if (!loggedIn) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#ffffff',
            padding: '30px',
            borderRadius: '15px',
            boxShadow:
              '0 8px 25px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: '45px',
              marginBottom: '10px',
            }}
          >
            🔐
          </div>

          <h1
            style={{
              textAlign: 'center',
              margin: '0 0 8px',
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
              value={password}
              placeholder="Enter password"
              onChange={(e) =>
                setPassword(e.target.value)
              }
              style={{
                width: '100%',
                padding: '14px',
                border:
                  '1px solid #d1d5db',
                borderRadius: '10px',
                fontSize: '16px',
                boxSizing: 'border-box',
                marginBottom: '15px',
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
                background: '#111827',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 'bold',
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
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#991b1b',
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
  // PAYMENT HISTORY PAGE
  // ------------------------------------

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: '20px',
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
            borderRadius: '15px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
              }}
            >
              💳 Payment History
            </h1>

            <p
              style={{
                margin: '5px 0 0',
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
              style={{
                padding: '10px 15px',
                border: 'none',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 'bold',
              }}
            >
              🔄 Refresh
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '10px 15px',
                border: 'none',
                borderRadius: '8px',
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 'bold',
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Total */}

        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              color: '#666',
              fontSize: '14px',
            }}
          >
            Total Payments
          </div>

          <div
            style={{
              fontSize: '30px',
              fontWeight: 'bold',
              marginTop: '5px',
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
              borderRadius: '15px',
              textAlign: 'center',
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

        {/* No payments */}

        {!loading &&
          payments.length === 0 && (
            <div
              style={{
                background: '#ffffff',
                padding: '30px',
                borderRadius: '15px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '40px',
                }}
              >
                💳
              </div>

              <h3>
                No Payments Found
              </h3>

              <p
                style={{
                  color: '#666',
                }}
              >
                Razorpay payments will
                appear here.
              </p>
            </div>
          )}

        {/* Payments Table */}

        {!loading &&
          payments.length > 0 && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '15px',
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: '900px',
                  borderCollapse:
                    'collapse',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#f9fafb',
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
                  </tr>
                </thead>

                <tbody>
                  {payments.map(
                    (payment, index) => (
                      <tr
                        key={
                          payment.id
                        }
                      >
                        <td style={tdStyle}>
                          {index + 1}
                        </td>

                        <td style={tdStyle}>
                          {payment.id}
                        </td>

                        <td style={tdStyle}>
                          {payment.orderId}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight:
                              'bold',
                          }}
                        >
                          ₹
                          {Number(
                            payment.amount
                          ).toFixed(2)}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight:
                              'bold',
                          }}
                        >
                          {payment.status}
                        </td>

                        <td style={tdStyle}>
                          {payment.method}
                        </td>

                        <td style={tdStyle}>
                          {payment.contact}
                        </td>

                        <td style={tdStyle}>
                          {formatDate(
                            payment.createdAt
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </main>
  );
}

const thStyle = {
  padding: '14px',
  textAlign: 'left',
  borderBottom: '1px solid #ddd',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '14px',
  borderBottom: '1px solid #eee',
  whiteSpace: 'nowrap',
};
