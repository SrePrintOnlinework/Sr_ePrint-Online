'use client';

import { useState } from 'react';
import { pdfs } from './pdfs';

export default function Home() {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!selectedPdf) {
      alert('Please select a PDF first.');
      return;
    }

    setLoading(true);

    try {
      const isLoaded = await loadRazorpayScript();

      if (!isLoaded) {
        alert('Razorpay SDK failed to load.');
        setLoading(false);
        return;
      }

      const orderRes = await fetch('/create-order', {
        method: 'POST',
      });

      if (!orderRes.ok) {
        throw new Error('Failed to create payment order');
      }

      const orderData = await orderRes.json();

      if (!orderData.orderId) {
        throw new Error('Order ID not received');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: '9900',
        currency: 'INR',
        name: 'ePrint Online',
        description: `PDF Access - ${selectedPdf.name}`,
        order_id: orderData.orderId,

        handler: async function (response) {
          try {
            const verifyRes = await fetch('/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                pdfId: selectedPdf.id,
              }),
            });

            if (!verifyRes.ok) {
              const errorText = await verifyRes.text();
              throw new Error(errorText || 'Payment verification failed');
            }

            const blob = await verifyRes.blob();

            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = selectedPdf.file;

            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);

            alert('✅ Payment Successful! PDF downloaded.');
          } catch (error) {
            console.error(error);
            alert('Payment verification failed.');
          }
        },

        prefill: {
          name: '',
          email: '',
          contact: '',
        },

        theme: {
          color: '#1a73e8',
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on('payment.failed', function () {
        alert('Payment failed. Please try again.');
      });

      razorpay.open();

    } catch (error) {
      console.error(error);
      alert('Something went wrong: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPdfs = pdfs.filter((pdf) =>
    pdf.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fa',
        padding: '30px 15px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '700px',
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            color: '#1a73e8',
            marginBottom: '10px',
          }}
        >
          📄 ePrint Online
        </h1>

        <p
          style={{
            textAlign: 'center',
            color: '#555',
            marginBottom: '25px',
          }}
        >
          Select your PDF and pay ₹99 to download
        </p>

        <input
          type="text"
          placeholder="🔎 Search PDF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '10px',
            marginBottom: '15px',
          }}
        />

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {filteredPdfs.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px' }}>
              No PDF found.
            </p>
          ) : (
            filteredPdfs.map((pdf) => (
              <div
                key={pdf.id}
                onClick={() => setSelectedPdf(pdf)}
                style={{
                  padding: '16px',
                  margin: '6px 0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border:
                    selectedPdf?.id === pdf.id
                      ? '2px solid #1a73e8'
                      : '1px solid #ddd',
                  background:
                    selectedPdf?.id === pdf.id
                      ? '#eef5ff'
                      : 'white',
                }}
              >
                <strong>📄 {pdf.name}</strong>

                {selectedPdf?.id === pdf.id && (
                  <span
                    style={{
                      float: 'right',
                      color: '#1a73e8',
                      fontWeight: 'bold',
                    }}
                  >
                    ✓ Selected
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {selectedPdf && (
          <div
            style={{
              marginTop: '20px',
              padding: '20px',
              background: 'white',
              borderRadius: '12px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            <p>
              Selected PDF:
              <br />
              <strong>{selectedPdf.name}</strong>
            </p>

            <button
              onClick={handlePayment}
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: loading ? '#aaa' : '#1a73e8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Processing...' : '💳 Pay ₹99 & Download'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
