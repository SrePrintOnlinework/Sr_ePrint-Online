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
      // 1. Script load చేయాలి
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        alert('Razorpay SDK failed to load. Check your internet.');
        setLoading(false);
        return;
      }

      // 2. మన API నుండి Order ID తీసుకోవాలి
      const orderRes = await fetch('/api/create-order', { method: 'POST' });
      const orderData = await orderRes.json();
      if (!orderData.orderId) throw new Error('Failed to create order');

      // 3. Razorpay Checkout Options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: '9900',
        currency: 'INR',
        name: 'Your Company Name',
        description: 'Premium Access - ₹99',
        order_id: orderData.orderId,
        handler: async function (response) {
          // ✅ Payment Success ఇక్కడే వస్తుంది
          // 4. మన Verify API కి పంపి, PDF ని download చేద్దాం
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          if (!verifyRes.ok) {
            const err = await verifyRes.json();
            alert('Verification failed: ' + err.error);
            return;
          }

          // 5. PDF ని Blob గా తీసుకుని ఆటోమేటిక్ డౌన్లోడ్ ట్రిగ్గర్ చేయడం
          const blob = await verifyRes.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt_${response.razorpay_payment_id}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          alert('Payment Successful! PDF downloaded.');
        },
        prefill: {
          name: 'John Doe',
          email: 'john@example.com',
          contact: '9999999999',
        },
        theme: { color: '#F37254' },
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
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Premium Access</h1>
      <p>Pay ₹99 and get your PDF instantly</p>
      <button 
        onClick={handlePayment} 
        disabled={loading}
        style={{ padding: '15px 40px', fontSize: '20px', cursor: 'pointer' }}
      >
        {loading ? 'Processing...' : 'Pay ₹99'}
      </button>
    </div>
  );
}
