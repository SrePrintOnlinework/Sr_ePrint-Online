const handlePayment = async () => {
  setLoading(true);
  try {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      alert('Razorpay SDK failed to load. Check your internet.');
      setLoading(false);
      return;
    }

    // ----- మార్పు 1: ఇక్కడ చూడండి (Order API) -----
    const orderRes = await fetch('/api/create-order', { method: 'POST' });
    
    // సర్వర్ నుండి 404, 500 వస్తే, JSON పార్స్ చేయకుండా ఆపేయండి
    if (!orderRes.ok) {
      const errorText = await orderRes.text(); // HTML టెక్స్ట్ గా చదవండి
      throw new Error(`Order API fail (${orderRes.status}): ${errorText.slice(0, 100)}`);
    }
    
    const orderData = await orderRes.json(); // ఇప్పుడు సురక్షితం
    if (!orderData.orderId) throw new Error('Failed to create order');

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: '9900',
      currency: 'INR',
      name: 'ePrint Online',
      description: 'Premium PDF Access - ₹99',
      order_id: orderData.orderId,
      handler: async function (response) {
        const verifyRes = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        // ----- మార్పు 2: ఇక్కడ చూడండి (Verify API) -----
        if (!verifyRes.ok) {
          // ఇక్కడ JSON కి బదులు టెక్స్ట్ గా తీసుకోండి (ఎందుకంటే HTML వస్తోంది)
          const errText = await verifyRes.text();
          alert('Verification failed: Server returned ' + errText.slice(0, 80));
          return;
        }

        // ఇక్కడ మీ కోడ్ లో verifyRes.json() లేదు, కాబట్టి blob కి వెళ్ళొచ్చు
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
