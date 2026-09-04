'use client';

import { useState, useRef, useEffect } from 'react';
import { pdfs } from './pdfs';

export default function Home() {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const paymentStartedRef = useRef(false);
  const downloadStartedRef = useRef(false);

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
          () => resolve(true)
        );

        existingScript.addEventListener(
          'error',
          () => resolve(false)
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
  // CLEAN OLD PDF URL
  // ==========================================

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ==========================================
  // DOWNLOAD PDF
  // ==========================================

  const downloadPdf = (url, fileName) => {
    if (!url) {
      alert('PDF URL was not received.');
      return;
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
  // OPEN PDF
  // ==========================================

  const openPdf = (url) => {
    if (!url) {
      alert('PDF is not available.');
      return;
    }

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );
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
    downloadStartedRef.current = false;

    setLoading(true);
    setSuccessMessage('');

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

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

      const orderRes = await fetch(
        '/create-order',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            pdfId: selectedPdf.id,
          }),

          cache: 'no-store',
        }
      );

      const orderText =
        await orderRes.text();

      let orderData;

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

      // ========================================
      // RAZORPAY PUBLIC KEY
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

                  cache: 'no-store',
                }
              );

            // ==================================
            // CONTENT TYPE
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
                } catch {
                  // Ignore JSON parse error
                }
              } else {
                try {
                  const errorText =
                    await verifyRes.text();

                  if (errorText) {
                    errorMessage =
                      errorText;
                  }
                } catch {
                  // Ignore text parse error
                }
              }

              throw new Error(
                errorMessage
              );
            }

            // ==================================
            // MUST RETURN PDF
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
                      JSON.parse(text);

                    serverMessage =
                      json?.error ||
                      json?.message ||
                      serverMessage;
                  } catch {
                    serverMessage =
                      text;
                  }
                }
              } catch {
                // Ignore response read error
              }

              throw new Error(
                serverMessage
              );
            }

            // ==================================
            // GET PDF BLOB
            // ==================================

            const pdfBlob =
              await verifyRes.blob();

            if (!pdfBlob ||
                pdfBlob.size === 0) {
              throw new Error(
                'Received an empty PDF file.'
              );
            }

            // ==================================
            // CREATE PDF URL
            // ==================================

            const url =
              URL.createObjectURL(
                pdfBlob
              );

            setPdfUrl(url);

            setSuccessMessage(
              'Payment successful! Your PDF is ready.'
            );

            // ==================================
            // FILE NAME
            // ==================================

            const safeFileName =
              selectedPdf.name
                .replace(
                  /[^a-zA-Z0-9-_]/g,
                  '_'
                )
                .replace(
                  /_+/g,
                  '_'
                );

            const fileName =
              `${safeFileName}.pdf`;

            // ==================================
            // AUTOMATIC DOWNLOAD
            // ==================================

            if (
              !downloadStartedRef.current
            ) {
              downloadStartedRef.current =
                true;

              setTimeout(() => {
                downloadPdf(
                  url,
                  fileName
                );
              }, 300);
            }

            setLoading(false);
          } catch (error) {
            console.error(
              'Payment verification error:',
              error
            );

            setLoading(false);

            setSuccessMessage('');

            alert(
              error?.message ||
              'Payment verification failed.'
            );
          }
        },

        // ======================================
        // PAYMENT FAILED
        // ======================================

        modal: {
          ondismiss: function () {
            setLoading(false);
            paymentStartedRef.current =
              false;

            setSuccessMessage('');
          },
        },

        prefill: {
          name: '',
          email: '',
          contact: '',
        },

        theme: {
          color: '#2563eb',
        },
      };

      // ========================================
      // CREATE RAZORPAY
      // ========================================

      const razorpay =
        new window.Razorpay(
          options
        );

      // ========================================
      // PAYMENT ERROR
      // ========================================

      razorpay.on(
        'payment.failed',
        function (response) {
          console.error(
            'Payment failed:',
            response
          );

          setLoading(false);

          paymentStartedRef.current =
            false;

          setSuccessMessage('');

          alert(
            response?.error?.description ||
            'Payment failed. Please try again.'
          );
        }
      );

      // ========================================
      // OPEN CHECKOUT
      // ========================================

      razorpay.open();
    } catch (error) {
      console.error(
        'Payment error:',
        error
      );

      setLoading(false);

      paymentStartedRef.current =
        false;

      setSuccessMessage('');

      alert(
        error?.message ||
        'Something went wrong. Please try again.'
      );
    }
  };

  // ==========================================
  // SELECT PDF
  // ==========================================

  const handleSelectPdf = (pdf) => {
    if (loading) {
      return;
    }

    setSelectedPdf(pdf);
    setSuccessMessage('');

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl('');
    }
  };

  // ==========================================
  // SEARCH
  // ==========================================

  const filteredPdfs =
    pdfs.filter((pdf) =>
      pdf.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  // ==========================================
  // RESET PAYMENT LOCK
  // ==========================================

  const resetPayment = () => {
    paymentStartedRef.current =
      false;

    downloadStartedRef.current =
      false;

    setLoading(false);
  };

  // ==========================================
  // PAGE UI
  // ==========================================

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '20px',
        fontFamily:
          'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >

        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <header
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '25px 20px',
            textAlign: 'center',
            boxShadow:
              '0 4px 20px rgba(0,0,0,0.08)',
            marginBottom: '20px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              color: '#111827',
            }}
          >
            SR INTERNET Online Centre
          </h1>

          <p
            style={{
              marginTop: '8px',
              marginBottom: 0,
              color: '#6b7280',
              fontSize: '15px',
            }}
          >
            Digital PDF & Online Services
          </p>
        </header>

        {/* ================================= */}
        {/* PDF SECTION */}
        {/* ================================= */}

        <section
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '25px 20px',
            boxShadow:
              '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <h2
            style={{
              marginTop: 0,
              color: '#111827',
              textAlign: 'center',
            }}
          >
            Online PDF Downloads
          </h2>

          <p
            style={{
              textAlign: 'center',
              color: '#6b7280',
              marginBottom: '20px',
            }}
          >
            Select a PDF, make payment and
            download instantly.
          </p>

          {/* SEARCH */}

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="🔍 Search PDF..."
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              borderRadius: '10px',
              border:
                '1px solid #d1d5db',
              outline: 'none',
              fontSize: '16px',
              marginBottom: '20px',
            }}
          />

          {/* PDF LIST */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '15px',
            }}
          >
            {filteredPdfs.map(
              (pdf) => {
                const isSelected =
                  selectedPdf?.id ===
                  pdf.id;

                return (
                  <button
                    key={pdf.id}
                    type="button"
                    onClick={() =>
                      handleSelectPdf(
                        pdf
                      )
                    }
                    disabled={loading}
                    style={{
                      textAlign: 'left',
                      padding: '18px',
                      borderRadius: '12px',
                      border: isSelected
                        ? '2px solid #2563eb'
                        : '1px solid #e5e7eb',
                      background:
                        isSelected
                          ? '#eff6ff'
                          : '#ffffff',
                      cursor: loading
                        ? 'not-allowed'
                        : 'pointer',
                      opacity:
                        loading ? 0.7 : 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '30px',
                        marginBottom:
                          '10px',
                      }}
                    >
                      📄
                    </div>

                    <div
                      style={{
                        fontWeight: '700',
                        color: '#111827',
                        fontSize: '16px',
                      }}
                    >
                      {pdf.name}
                    </div>

                    <div
                      style={{
                        marginTop: '8px',
                        color: '#6b7280',
                        fontSize: '13px',
                      }}
                    >
                      Click to select
                    </div>
                  </button>
                );
              }
            )}
          </div>

          {/* NO RESULTS */}

          {filteredPdfs.length === 0 && (
            <p
              style={{
                textAlign: 'center',
                color: '#6b7280',
                padding: '20px',
              }}
            >
              No PDF found.
            </p>
          )}

          {/* SELECTED PDF */}

          {selectedPdf && (
            <div
              style={{
                marginTop: '25px',
                padding: '18px',
                borderRadius: '12px',
                background: '#f9fafb',
                border:
                  '1px solid #e5e7eb',
              }}
            >
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '13px',
                  marginBottom: '5px',
                }}
              >
                Selected PDF
              </div>

              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#111827',
                }}
              >
                📄 {selectedPdf.name}
              </div>

              {/* PRICE */}

              <div
                style={{
                  marginTop: '12px',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#111827',
                }}
              >
                ₹99
              </div>
            </div>
          )}

          {/* ================================= */}
          {/* PAY BUTTON */}
          {/* ================================= */}

          <button
            type="button"
            onClick={handlePayment}
            disabled={
              loading ||
              !selectedPdf
            }
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '15px',
              border: 'none',
              borderRadius: '10px',
              background:
                loading ||
                !selectedPdf
                  ? '#9ca3af'
                  : '#2563eb',
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: '700',
              cursor:
                loading ||
                !selectedPdf
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {loading
              ? '⏳ Processing...'
              : '💳 Pay ₹99 & Download PDF'}
          </button>

          {/* ================================= */}
          {/* SUCCESS */}
          {/* ================================= */}

          {successMessage && (
            <div
              style={{
                marginTop: '20px',
                padding: '15px',
                borderRadius: '10px',
                background: '#ecfdf5',
                border:
                  '1px solid #a7f3d0',
                color: '#065f46',
                textAlign: 'center',
                fontWeight: '600',
              }}
            >
              ✅ {successMessage}
            </div>
          )}

          {/* ================================= */}
          {/* PDF OPEN / DOWNLOAD */}
          {/* ================================= */}

          {pdfUrl && (
            <div
              style={{
                marginTop: '20px',
                padding: '20px',
                borderRadius: '12px',
                background: '#eff6ff',
                border:
                  '1px solid #bfdbfe',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1e3a8a',
                  marginBottom:
                    '15px',
                }}
              >
                📄 Your PDF is ready
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  justifyContent:
                    'center',
                  flexWrap: 'wrap',
                }}
              >
                {/* OPEN */}

                <button
                  type="button"
                  onClick={() =>
                    openPdf(pdfUrl)
                  }
                  style={{
                    padding:
                      '12px 20px',
                    border: 'none',
                    borderRadius:
                      '8px',
                    background:
                      '#2563eb',
                    color: '#ffffff',
                    fontSize:
                      '15px',
                    fontWeight:
                      '700',
                    cursor:
                      'pointer',
                  }}
                >
                  📖 Open PDF
                </button>

                {/* DOWNLOAD */}

                <button
                  type="button"
                  onClick={() =>
                    downloadPdf(
                      pdfUrl,
                      `${selectedPdf.name
                        .replace(
                          /[^a-zA-Z0-9-_]/g,
                          '_'
                        )}.pdf`
                    )
                  }
                  style={{
                    padding:
                      '12px 20px',
                    border: 'none',
                    borderRadius:
                      '8px',
                    background:
                      '#059669',
                    color: '#ffffff',
                    fontSize:
                      '15px',
                    fontWeight:
                      '700',
                    cursor:
                      'pointer',
                  }}
                >
                  ⬇️ Download PDF
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ================================= */}
        {/* INFO */}
        {/* ================================= */}

        <section
          style={{
            marginTop: '20px',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '25px 20px',
            boxShadow:
              '0 4px 20px rgba(0,0,0,0.06)',
          }}
        >
          <h2
            style={{
              marginTop: 0,
              color: '#111827',
            }}
          >
            About SR E-Print Online
          </h2>

          <p
            style={{
              color: '#4b5563',
              lineHeight: '1.7',
            }}
          >
            SR INTERNET Online Centre provides
            digital PDF files and online services.
            Select your required document, complete
            the secure Razorpay payment and receive
            your PDF instantly.
          </p>

          <h3
            style={{
              color: '#111827',
            }}
          >
            How It Works
          </h3>

          <p
            style={{
              color: '#4b5563',
              lineHeight: '1.8',
            }}
          >
            1️⃣ Select a PDF
            <br />
            2️⃣ Click Pay ₹99
            <br />
            3️⃣ Complete Razorpay payment
            <br />
            4️⃣ Payment is verified securely
            <br />
            5️⃣ PDF opens/downloads instantly
          </p>

          <h3
            style={{
              color: '#111827',
            }}
          >
            Payment & Delivery
          </h3>

          <p
            style={{
              color: '#4b5563',
              lineHeight: '1.7',
            }}
          >
            Payments are processed securely through
            Razorpay. Digital PDF delivery is provided
            after successful payment verification.
          </p>
        </section>

        {/* ================================= */}
        {/* FOOTER */}
        {/* ================================= */}

        <footer
          style={{
            textAlign: 'center',
            padding: '25px 10px',
            color: '#6b7280',
            fontSize: '13px',
          }}
        >
          © {new Date().getFullYear()} SR INTERNET
          Online Centre. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
