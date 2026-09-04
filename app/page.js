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
  const paymentCompletedRef = useRef(false);

  // ==========================================
  // LOAD RAZORPAY
  // ==========================================

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (
        typeof window !== 'undefined' &&
        window.Razorpay
      ) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener(
          'load',
          () => resolve(true),
          { once: true }
        );

        existingScript.addEventListener(
          'error',
          () => resolve(false),
          { once: true }
        );

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
      throw new Error(
        'PDF URL was not received.'
      );
    }

    if (downloadStartedRef.current) {
      return;
    }

    downloadStartedRef.current = true;

    const link =
      document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    link.rel =
      'noopener noreferrer';

    link.style.display = 'none';

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };

  // ==========================================
  // PAYMENT
  // ==========================================

  const handlePayment = async () => {
    if (!selectedPdf) {
      alert(
        'Please select a PDF first.'
      );
      return;
    }

    if (paymentStartedRef.current) {
      return;
    }

    paymentStartedRef.current = true;
    downloadStartedRef.current = false;
    paymentCompletedRef.current = false;

    setLoading(true);
    setSuccessMessage('');
    setPdfUrl('');

    try {
      // --------------------------------------
      // LOAD RAZORPAY
      // --------------------------------------

      const razorpayLoaded =
        await loadRazorpayScript();

      if (!razorpayLoaded) {
        throw new Error(
          'Razorpay checkout failed to load. Please check your internet connection and try again.'
        );
      }

      // --------------------------------------
      // CREATE ORDER
      // --------------------------------------

      const orderRes =
        await fetch(
          '/create-order',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              pdfId:
                selectedPdf.id,
            }),
          }
        );

      const orderText =
        await orderRes.text();

      let orderData = null;

      try {
        orderData =
          JSON.parse(orderText);
      } catch (error) {
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

      // --------------------------------------
      // RAZORPAY KEY
      // --------------------------------------

      const razorpayKey =
        process.env
          .NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!razorpayKey) {
        throw new Error(
          'Razorpay Key ID is missing. Please check Vercel Environment Variables.'
        );
      }

      // --------------------------------------
      // RAZORPAY OPTIONS
      // --------------------------------------

      const options = {
        key: razorpayKey,

        amount:
          orderData.amount ||
          9900,

        currency:
          orderData.currency ||
          'INR',

        name:
          'SR INTERNET Online Centre',

        description:
          `Digital PDF - ${selectedPdf.name}`,

        order_id:
          orderData.orderId,

        prefill: {
          name: '',
          email: '',
          contact: '',
        },

        notes: {
          pdf_id:
            String(selectedPdf.id),

          pdf_name:
            selectedPdf.name,
        },

        theme: {
          color: '#1565c0',
        },

        // ------------------------------------
        // PAYMENT SUCCESS
        // ------------------------------------

        handler:
          async function (response) {
            paymentCompletedRef.current =
              true;

            try {
              if (
                downloadStartedRef.current
              ) {
                return;
              }

              // ------------------------------
              // VERIFY PAYMENT
              // ------------------------------

              const verifyRes =
                await fetch(
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
                  }
                );

              // ------------------------------
              // RESPONSE TYPE
              // ------------------------------

              const contentType =
                verifyRes.headers.get(
                  'content-type'
                ) || '';

              // =================================
              // JSON RESPONSE
              // =================================

              if (
                contentType.includes(
                  'application/json'
                )
              ) {
                const data =
                  await verifyRes.json();

                if (!verifyRes.ok) {
                  throw new Error(
                    data?.error ||
                      'Payment verification failed.'
                  );
                }

                if (!data?.pdfUrl) {
                  throw new Error(
                    data?.error ||
                      'PDF URL was not received.'
                  );
                }

                const fileUrl =
                  data.pdfUrl.startsWith(
                    'http'
                  )
                    ? data.pdfUrl
                    : window.location.origin +
                      data.pdfUrl;

                setPdfUrl(fileUrl);

                // ----------------------------
                // FILE NAME
                // ----------------------------

                const originalName =
                  selectedPdf.file ||
                  `${selectedPdf.name}.pdf`;

                const dotIndex =
                  originalName.lastIndexOf(
                    '.'
                  );

                const baseName =
                  dotIndex > 0
                    ? originalName.substring(
                        0,
                        dotIndex
                      )
                    : originalName;

                const uniqueFileName =
                  `${baseName}-payment-${response.razorpay_payment_id}.pdf`;

                // ----------------------------
                // DOWNLOAD
                // ----------------------------

                downloadPdf(
                  fileUrl,
                  uniqueFileName
                );

                setSuccessMessage(
                  'Payment Successful! Your PDF download has started.'
                );

                setLoading(false);

                return;
              }

              // =================================
              // PDF / BLOB RESPONSE
              // =================================

              if (!verifyRes.ok) {
                let errorMessage =
                  'Payment verification failed.';

                try {
                  const errorText =
                    await verifyRes.text();

                  if (errorText) {
                    try {
                      const errorData =
                        JSON.parse(
                          errorText
                        );

                      errorMessage =
                        errorData?.error ||
                        errorMessage;
                    } catch {
                      // Ignore invalid JSON
                    }
                  }
                } catch {
                  // Ignore response read error
                }

                throw new Error(
                  errorMessage
                );
              }

              const blob =
                await verifyRes.blob();

              if (
                !blob ||
                blob.size === 0
              ) {
                throw new Error(
                  'PDF file is empty.'
                );
              }

              // ----------------------------
              // PDF BLOB
              // ----------------------------

              const pdfBlob =
                new Blob(
                  [blob],
                  {
                    type:
                      'application/pdf',
                  }
                );

              const url =
                window.URL.createObjectURL(
                  pdfBlob
                );

              setPdfUrl(url);

              // ----------------------------
              // FILE NAME
              // ----------------------------

              const originalName =
                selectedPdf.file ||
                `${selectedPdf.name}.pdf`;

              const dotIndex =
                originalName.lastIndexOf(
                  '.'
                );

              const baseName =
                dotIndex > 0
                  ? originalName.substring(
                      0,
                      dotIndex
                    )
                  : originalName;

              const uniqueFileName =
                `${baseName}-payment-${response.razorpay_payment_id}.pdf`;

              // ----------------------------
              // DOWNLOAD
              // ----------------------------

              downloadPdf(
                url,
                uniqueFileName
              );

              setSuccessMessage(
                'Payment Successful! Your PDF download has started.'
              );

            } catch (error) {
              console.error(
                'Payment verification/download error:',
                error
              );

              downloadStartedRef.current =
                false;

              setSuccessMessage('');

              alert(
                'Payment was received, but PDF download failed. Please contact support.'
              );
            } finally {
              setLoading(false);

              paymentStartedRef.current =
                false;
            }
          },

        // ------------------------------------
        // PAYMENT WINDOW CLOSED
        // ------------------------------------

        modal: {
          ondismiss:
            function () {
              if (
                paymentCompletedRef.current
              ) {
                return;
              }

              setLoading(false);

              paymentStartedRef.current =
                false;
            },
        },
      };

      // ======================================
      // OPEN RAZORPAY
      // ======================================

      const razorpay =
        new window.Razorpay(
          options
        );

      // ======================================
      // PAYMENT FAILED
      // ======================================

      razorpay.on(
        'payment.failed',
        function (response) {
          console.error(
            'Razorpay payment failed:',
            response?.error
          );

          setLoading(false);

          paymentStartedRef.current =
            false;

          downloadStartedRef.current =
            false;

          paymentCompletedRef.current =
            false;

          alert(
            response?.error?.description ||
              'Payment failed. Please try again.'
          );
        }
      );

      razorpay.open();

    } catch (error) {
      console.error(
        'Payment error:',
        error
      );

      setLoading(false);

      paymentStartedRef.current =
        false;

      downloadStartedRef.current =
        false;

      paymentCompletedRef.current =
        false;

      alert(
        'Something went wrong: ' +
          (
            error?.message ||
            'Please try again.'
          )
      );
    }
  };

  // ==========================================
  // SEARCH
  // ==========================================

  const searchText =
    search
      .trim()
      .toLowerCase();

  const filteredPdfs =
    pdfs.filter((pdf) =>
      String(pdf.name || '')
        .toLowerCase()
        .includes(searchText)
    );

  // ==========================================
  // SELECT PDF
  // ==========================================

  const selectPdf = (pdf) => {
    if (loading) {
      return;
    }

    setSelectedPdf(pdf);
    setSuccessMessage('');
    setPdfUrl('');
  };

  // ==========================================
  // CLEAR SEARCH
  // ==========================================

  const clearSearch = () => {
    setSearch('');
  };

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <>
      <main className="page">

        {/* ==================================
            HEADER
        ================================== */}

        <header className="hero">

          <div className="heroContent">

            <div className="logoCircle">
              📄
            </div>

            <h1>
              SR INTERNET Online Centre
            </h1>

            <p>
              Digital PDF & Online Services
            </p>

            <div className="heroBadges">
              <span>
                🔒 Secure Payment
              </span>

              <span>
                📥 Instant Digital Delivery
              </span>
            </div>

          </div>

        </header>

        {/* ==================================
            MAIN CONTENT
        ================================== */}

        <section className="container">

          {/* =================================
              SUCCESS MESSAGE
          ================================= */}

          {successMessage && pdfUrl && (
            <div className="successBox">

              <div className="successIcon">
                ✓
              </div>

              <div className="successTitle">
                Payment Successful
              </div>

              <div className="successText">
                Your PDF download has started.
              </div>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="openPdfButton"
              >
                📄 Open PDF
              </a>

            </div>
          )}

          {/* =================================
              INTRO CARD
          ================================= */}

          <section className="introCard">

            <div className="introIcon">
              📚
            </div>

            <h2>
              Online PDF Downloads
            </h2>

            <p>
             
