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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfId: selectedPdf.id,
        }),
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

        amount: orderData.amount || 9900,
        currency: 'INR',

        name: 'SR INTERNET Online Centre',

        description: `Digital PDF - ${selectedPdf.name}`,

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
              throw new Error('Payment verification failed');
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
            alert(
              'Payment was received, but PDF verification/download failed. Please contact support.'
            );
          }
        },

        prefill: {
          name: '',
          email: '',
          contact: '',
        },

        theme: {
          color: '#1565c0',
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on('payment.failed', function () {
        alert('❌ Payment failed. Please try again.');
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
    <main
      style={{
        minHeight: '100vh',
        background: '#f4f7fb',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: '#1565c0',
          color: 'white',
          padding: '24px 15px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: 'auto',
          }}
        >
          <div style={{ fontSize: '42px' }}>📄</div>

          <h1
            style={{
              margin: '5px 0',
              fontSize: '30px',
            }}
          >
            SR INTERNET Online Centre
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              fontSize: '16px',
              opacity: 0.95,
            }}
          >
            Digital PDF & Online Services
          </p>
        </div>
      </header>

      {/* MAIN */}
      <section
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '25px 15px 40px',
        }}
      >
        {/* INTRO CARD */}
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
            textAlign: 'center',
            boxShadow: '0 3px 12px rgba(0,0,0,0.07)',
          }}
        >
          <h2
            style={{
              margin: '0 0 8px',
              color: '#222',
            }}
          >
            Online PDF Downloads
          </h2>

          <p
            style={{
              margin: 0,
              color: '#666',
              lineHeight: 1.6,
            }}
          >
            Select the required PDF, make a secure payment of ₹99,
            and download your PDF instantly.
          </p>
        </div>

        {/* SEARCH */}
        <input
          type="text"
          placeholder="🔎 Search PDF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '15px',
            fontSize: '16px',
            border: '1px solid #d5dbe3',
            borderRadius: '12px',
            outline: 'none',
            marginBottom: '15px',
            background: 'white',
          }}
        />

        {/* PDF LIST */}
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '10px',
            boxShadow: '0 3px 12px rgba(0,0,0,0.07)',
          }}
        >
          <h3
            style={{
              padding: '8px 10px',
