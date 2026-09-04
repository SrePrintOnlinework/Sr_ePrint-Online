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

  // ==========================================
  // LOAD RAZORPAY
  // ==========================================

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');

      script.src =
        'https://checkout.razorpay.com/v1/checkout.js';

      script.async = true;

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  };

  // ==========================================
  // DOWNLOAD PDF
  // ==========================================

  const downloadPdf = (url, fileName) => {
    if (!url) {
      throw new Error('PDF URL was not received.');
    }

    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener noreferrer';

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };

  // ==========================================
  // PAYMENT
  // ==========================================

  const handlePayment = async () => {
    if (!selectedPdf) {
      alert('Please select a PDF first.');
      return;
    }

    if (paymentStartedRef.current) {
      return;
    }

    paymentStartedRef.current = true;

    setLoading(true);
    setSuccessMessage('');
    setPdfUrl('');

    try {
      // ========================================
      // LOAD RAZORPAY
      // ========================================

      const razorpayLoaded =
        await loadRazorpayScript();

      if (!razorpayLoaded) {
        throw new Error(
          'Razorpay SDK failed to load. Please check your internet connection.'
        );
      }

      // ========================================
      // CREATE ORDER
      // ========================================

      const orderRes = await fetch('/create-order', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          pdfId: selectedPdf.id,
        }),

        cache: 'no-store',
      });

      const orderText = await orderRes.text();

      let orderData;

      try {
        orderData = JSON.parse(orderText);
      } catch {
        console.error(
          'Create order response:',
          orderText
        );

        throw new Error(
          'Server returned an invalid payment response.'
        );
      }

      if (!orderRes.ok) {
        throw new Error(
          orderData?.error ||
          'Failed to create payment order.'
        );
      }

      if (!orderData?.orderId) {
        throw new Error(
          'Razorpay Order ID was not received.'
        );
      }

      // ========================================
      // RAZORPAY KEY
      // ========================================

      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!razorpayKey) {
        throw new Error(
          'Razorpay Key ID is missing. Please check Vercel Environment Variables.'
        );
      }

      // ========================================
      // RAZORPAY OPTIONS
      // ========================================

      const options = {
        key: razorpayKey,

        amount: orderData.amount,

        currency:
          orderData.currency || 'INR',

        name:
          'SR INTERNET Online Centre',

        description:
          `Digital PDF - ${selectedPdf.name}`,

        order_id:
          orderData.orderId,

        handler: async function (response) {
          try {
            setLoading(true);

            // ==================================
            // CHECK PAYMENT RESPONSE
            // ==================================

            if (
              !response?.razorpay_order_id ||
              !response?.razorpay_payment_id ||
              !response?.razorpay_signature
            ) {
              throw new Error(
                'Incomplete Razorpay payment response.'
              );
            }

            console.log(
              'Payment successful:',
              response.razorpay_payment_id
            );

            // ==================================
            // VERIFY PAYMENT
            // ==================================

            const verifyRes = await fetch(
              '/verify-payment',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  razorpay_order_id:
                    response.razorpay_order_id,

                  razorpay_payment_id:
                    response.razorpay_payment_id,

                  razorpay_signature:
                    response.razorpay_signature,

                  pdfId:
                    selectedPdf.id,
                }),

                cache: 'no-store',
              }
            );

            // ==================================
            // CHECK RESPONSE
            // ==================================

            const contentType =
              verifyRes.headers.get(
                'content-type'
              ) || '';

            console.log(
              'Verify status:',
              verifyRes.status
            );

            console.log(
              'Verify content type:',
              contentType
            );

            // ==================================
            // SERVER ERROR
            // ==================================

            if (!verifyRes.ok) {
              let errorMessage =
                'Payment verification failed.';

              if (
                contentType.includes(
                  'application/json'
                )
              ) {
                try {
                  const errorData =
                    await verifyRes.json();

                  errorMessage =
                    errorData?.error ||
                    errorMessage;
                } catch {}
              } else {
                try {
                  const errorText =
                    await verifyRes.text();

                  if (errorText) {
                    errorMessage =
                      errorText;
                  }
                } catch {}
              }

              throw new Error(
                errorMessage
              );
            }

            // ==================================
            // MUST BE PDF
            // ==================================

            if (
              !contentType.includes(
                'application/pdf'
              )
            ) {
              let serverMessage =
                'Server did not return a PDF file.';

              try {
                const text =
                  await verifyRes.text();

                if (text) {
                  try {
                    const json =
