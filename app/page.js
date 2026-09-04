'use client';

import { useState, useRef } from 'react';
import { pdfs } from './pdfs';

export default function Home() {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const paymentStartedRef = useRef(false);
  const downloadStartedRef = useRef(false);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
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
    if (paymentStartedRef.current) return;
    paymentStartedRef.current = true;
    downloadStartedRef.current = false;
    setLoading(true);
    setSuccessMessage('');
    setPdfUrl('');
    try {
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) throw new Error('Razorpay SDK failed to load.');
      const orderRes = await fetch('/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfId: selectedPdf.id }),
      });
      let orderData;
      try { orderData = await orderRes.json(); } catch { throw new Error('Server returned an invalid response.'); }
      if (!orderRes.ok) throw new Error(orderData?.error || 'Failed to create payment order');
      if (!orderData?.orderId) throw new Error('Razorpay Order ID not received');
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) throw new Error('Razorpay Key ID is missing.');
      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'SR INTERNET Online Centre',
        description: `Digital PDF - ${selectedPdf.name}`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            if (downloadStartedRef.current) return;
            const verifyRes = await fetch('/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                pdfId: selectedPdf.id,
              }),
            });
            if (!verifyRes.ok) {
              let errorMessage = 'Payment verification failed';
              try { const errorData = await verifyRes.json(); errorMessage = errorData?.error || errorMessage; } catch {}
              throw new Error(errorMessage);
            }
            const blob = await verifyRes.blob();
            if (!blob || blob.size === 0) throw new Error('PDF file is empty');
            downloadStartedRef.current = true;
            const url = window.URL.createObjectURL(blob);
            setPdfUrl(url);
            const originalName = selectedPdf.file;
            const dotIndex = originalName.lastIndexOf('.');
            let baseName = originalName;
            let extension = '.pdf';
            if (dotIndex > 0) {
              baseName = originalName.substring(0, dotIndex);
              extension = originalName.substring(dotIndex);
            }
            const uniqueFileName = `${baseName}-payment-${response.razorpay_payment_id}${extension}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = uniqueFileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setSuccessMessage('✅ Payment Successful! Your PDF download has started.');
          } catch (error) {
            console.error('Payment verification/download error:', error);
            downloadStartedRef.current = false;
            alert('Payment was received, but PDF download failed. Please contact support.');
          } finally {
            setLoading(false);
            paymentStartedRef.current = false;
          }
        },
        prefill: { name: '', email: '', contact: '' },
        theme: { color: '#1565c0' },
        modal: { ondismiss: function () { setLoading(false); paymentStartedRef.current = false; } },
      };
      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        console.error('Razorpay payment failed:', response?.error);
        setLoading(false);
        paymentStartedRef.current = false;
        downloadStartedRef.current = false;
        alert('❌ Payment failed. Please try again.');
      });
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      setLoading(false);
      paymentStartedRef.current = false;
      downloadStartedRef.current = false;
      alert('Something went wrong: ' + error.message);
    }
  };

  const filteredPdfs = pdfs.filter((pdf) => pdf.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main style={{ minHeight: '100vh', background: '#f4f7fb', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ background: '#1565c0', color: 'white', padding: '24px 15px', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: 'auto' }}>
          <div style={{ fontSize: '42px' }}>📄</div>
          <h1 style={{ margin: '5px 0', fontSize: '30px' }}>SR INTERNET Online Centre</h1>
          <p style={{ margin: '8px 0 0', fontSize: '16px', opacity: 0.95 }}>Digital PDF & Online Services</p>
        </div>
      </header>

      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '25px 15px 40px' }}>
        {successMessage && (
          <div style={{ background: '#e8f5e9', border: '1px solid #81c784', color: '#2e7d32', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', lineHeight: 1.5 }}>
            {successMessage}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', padding: '13px', background: '#2e7d32', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold' }}>📄 Open PDF</a>
            )}
          </div>
        )}

        <div style={{ background: 'white', padding: '20px', borderRadius: '14px', marginBottom: '20px', textAlign: 'center', boxShadow: '0 3px 12px rgba(0,0,0,0.07)' }}>
          <h2 style={{ margin: '0 0 8px', color: '#222' }}>Online PDF Downloads</h2>
          <p style={{ margin: 0, color: '#666', lineHeight: 1.6 }}>
            Select the required PDF, make a secure payment, and download your PDF instantly.
          </p>
        </div>

        <input type="text" placeholder="🔎 Search PDF..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '15px', fontSize: '16px', border: '1px solid #d5dbe3', borderRadius: '12px', outline: 'none', marginBottom: '15px', background: 'white' }} />

        <div style={{ background: 'white', borderRadius: '14px', padding: '10px', boxShadow: '0 3px 12px rgba(0,0,0,0.07)', marginBottom: '20px' }}>
          <h3 style={{ padding: '8px 10px', margin: '0 0 5px', color: '#222' }}>Available PDFs</h3>
          {filteredPdfs.length === 0 ? (
            <p style={{ padding: '20px 10px', textAlign: 'center', color: '#777' }}>No PDF found.</p>
          ) : (
            filteredPdfs.map((pdf) => (
              <div key={pdf.id} onClick={() => { if (loading) return; setSelectedPdf(pdf); setSuccessMessage(''); setPdfUrl(''); }}
                style={{
                  border: selectedPdf?.id === pdf.id ? '2px solid #1565c0' : '1px solid #e1e5eb',
                  borderRadius: '12px', padding: '15px', marginBottom: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: selectedPdf?.id === pdf.id ? '#eef6ff' : 'white', transition: '0.2s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#222', fontSize: '16px' }}>{pdf.name}</div>
                    <div style={{ color: '#777', fontSize: '13px', marginTop: '4px' }}>PDF Document</div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: '#1565c0' }}>₹{pdf.price}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedPdf && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', marginTop: '20px', marginBottom: '20px', textAlign: 'center', boxShadow: '0 3px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ color: '#555', marginBottom: '8px' }}>Selected PDF</div>
            <h3 style={{ margin: '0 0 15px', color: '#222' }}>{selectedPdf.name}</h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1565c0', marginBottom: '15px' }}>₹{selectedPdf.price}</div>
            <button onClick={handlePayment} disabled={loading}
              style={{ width: '100%', padding: '15px', border: 'none', borderRadius: '10px', background: loading ? '#999' : '#1565c0', color: 'white', fontSize: '17px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
              {loading ? '⏳ Processing Payment...' : `💳 Pay ₹${selectedPdf.price} & Download PDF`}
            </button>
          </div>
        )}

        {/* మిగతా About, Services, Footer అంతా మీ పాత కోడ్ లాగే ఉంటుంది */}
      </section>

      <a href="https://wa.me/919989057683?text=Hello%20SR%20E-Print%20Online,%20I%20need%20help%20regarding%20a%20PDF%20purchase." target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Help"
        style={{ position: 'fixed', right: '18px', bottom: '18px', width: '58px', height: '58px', borderRadius: '50%', background: '#25D366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: '30px', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', zIndex: 9999 }}>💬</a>
    </main>
  );
}
