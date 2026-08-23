'use client';
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        alert('Razorpay SDK failed to load. Check your internet.');
        setLoading(false);
        return;
      }

      const orderRes = await fetch('/create-order', { method: 'POST' });
      if (!orderRes.ok) {
        const errorText = await orderRes.text();
        throw new Error(`Order API error (${orderRes.status}): ${errorText.slice(0, 100)}`);
      }
      const orderData = await orderRes.json();
      if (!orderData.orderId) throw new Error('Failed to create order');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: '9900',
        currency: 'INR',
        name: 'ePrint Online',
        description: 'Premium PDF Access - ₹99',
        order_id: orderData.orderId,
        handler: async function (response) {
          const verifyRes = await fetch('/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (!verifyRes.ok) {
            const errText = await verifyRes.text();
            alert('Verification failed: ' + errText.slice(0, 80));
            return;
          }

          const blob = await verifyRes.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt_${response.razorpay_payment_id}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          alert('✅ Payment Successful! PDF downloaded.');
        },
        prefill: {
          name: 'Demo User',
          email: 'demo@example.com',
          contact: '9999999999',
        },
        theme: { color: '#1a73e8' },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error(error);
      alert('Something went wrong: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      backgroundColor: '#f5f7fa'
    }}>
      <div style={{ 
        background: 'white', 
        padding: '40px', 
        borderRadius: '16px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#1a73e8' }}>📄 ePrint Online</h1>
        <p>Pay ₹99 and get your PDF receipt instantly</p>
        <button 
          onClick={handlePayment} 
          disabled={loading}
          style={{ 
            padding: '14px 50px', 
            fontSize: '20px', 
            fontWeight: 'bold',
            backgroundColor: loading ? '#ccc' : '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '20px'
          }}
        >
          {loading ? 'Processing...' : '💳 Pay ₹99'}
        </button>
      </div>
    </div>
  );
}
