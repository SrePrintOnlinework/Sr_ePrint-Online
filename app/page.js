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

  // ==========================================
  // FILTER PDFs
  // ==========================================

  const filteredPdfs = pdfs.filter((pdf) =>
    pdf.name.toLowerCase().includes(search.toLowerCase())
  );

  // ==========================================
  // SELECT PDF
  // ==========================================

  const handleSelectPdf = (pdf) => {
    setSelectedPdf(pdf);
    setSuccessMessage('');
    setPdfUrl('');

    paymentStartedRef.current = false;
    downloadStartedRef.current = false;
  };

  // ==========================================
  // LOAD RAZORPAY
  // ==========================================

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');

      script.src = 'https://checkout.razorpay.com/v1/checkout.js';

      script.onload = () => {
        resolve(true);
      };

      script.onerror = () => {
        resolve(false);
      };

      document.body.appendChild(script);
    });
  };

  // ==========================================
  // DOWNLOAD PDF
  // ==========================================

  const downloadPdf = (blob, fileName) => {
    if (downloadStartedRef.current) {
      return;
    }

    downloadStartedRef.current = true;

    const url = window.URL.createObjectURL(blob);

    setPdfUrl(url);

    // ========================================
    // AUTOMATIC DOWNLOAD
    // ========================================

    const link = document.createElement('a');

    link.href = url;

    link.download = fileName;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    // ========================================
    // SUCCESS
    // ========================================

    setSuccessMessage(
      'Payment successful! Your PDF download has started.'
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

    setLoading(true);
    setSuccessMessage('');
    setPdfUrl('');

    try {
      // ========================================
      // LOAD RAZORPAY
      // ========================================

      const razorpayLoaded = await loadRazorpay();

      if (!razorpayLoaded) {
        throw new Error(
          'Razorpay payment system could not be loaded.'
        );
      }

      // ========================================
      // CREATE ORDER
      // ========================================

      const orderResponse = await fetch(
        '/create-order',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            pdfId: selectedPdf.id,
          }),
        }
      );

      const orderText = await orderResponse.text();

      let orderData;

      try {
        orderData = JSON.parse(orderText);
      } catch {
        console.error(
          'Create order returned:',
          orderText
        );

        throw new Error(
          'Server returned an invalid response while creating payment.'
        );
      }

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(
          orderData?.error ||
            'Unable to create payment order.'
        );
      }

      // ========================================
      // RAZORPAY OPTIONS
      // ========================================

      const options = {
        key: orderData.keyId,

        amount: orderData.amount,

        currency: orderData.currency,

        name: 'SR E-Print Online',

        description: selectedPdf.name,

        order_id: orderData.orderId,

        handler: async function (response) {
          try {
            // ==================================
            // VERIFY PAYMENT
            // ==================================

            const verifyResponse = await fetch(
              '/verify-payment',
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  razorpay_order_id:
                    response.razorpay_order_id,

                  razorpay_payment_id:
                    response.razorpay_payment_id,

                  razorpay_signature:
                    response.razorpay_signature,

                  pdfId: selectedPdf.id,
                }),
              }
            );

            // ==================================
            // CHECK RESPONSE
            // ==================================

            const contentType =
              verifyResponse.headers.get(
                'content-type'
              ) || '';

            if (
              !contentType.includes(
                'application/pdf'
              )
            ) {
              const errorText =
                await verifyResponse.text();

              let errorMessage =
                'PDF verification failed.';

              try {
                const errorData =
                  JSON.parse(errorText);

                errorMessage =
                  errorData?.error ||
                  errorMessage;
              } catch {
                console.error(
                  'Verify response:',
                  errorText
                );
              }

              throw new Error(errorMessage);
            }

            // ==================================
            // GET PDF BLOB
            // ==================================

            const blob =
              await verifyResponse.blob();

            if (!blob || blob.size === 0) {
              throw new Error(
                'PDF file is empty.'
              );
            }

            // ==================================
            // FILE NAME
            // ==================================

            const fileName =
              selectedPdf.name
                .replace(
                  /[^a-zA-Z0-9-_]/g,
                  '_'
                )
                .replace(/_+/g, '_') +
              '.pdf';

            // ==================================
            // DOWNLOAD
            // ==================================

            downloadPdf(
              blob,
              fileName
            );
          } catch (error) {
            console.error(
              'PDF download error:',
              error
            );

            setSuccessMessage('');

            alert(
              error?.message ||
                'Payment was received, but PDF download failed. Please contact support.'
            );
          } finally {
            setLoading(false);
          }
        },

        prefill: {
          name: '',
          email: '',
          contact: '',
        },

        notes: {
          pdfId: selectedPdf.id,

          pdfName: selectedPdf.name,
        },

        theme: {
          color: '#2563eb',
        },

        modal: {
          ondismiss: function () {
            setLoading(false);

            paymentStartedRef.current =
              false;
          },
        },
      };

      // ========================================
      // OPEN RAZORPAY
      // ========================================

      const razorpay =
        new window.Razorpay(options);

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

      alert(
        error?.message ||
          'Something went wrong. Please try again.'
      );
    }
  };

  // ==========================================
  // OPEN PDF
  // ==========================================

  const handleOpenPdf = () => {
    if (!pdfUrl) {
      return;
    }

    window.open(
      pdfUrl,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '30px 15px',
        fontFamily:
          'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <header
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '25px',
            marginBottom: '20px',
            textAlign: 'center',
            boxShadow:
              '0 4px 20px rgba(0,0,0,0.06)',
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
              margin:
                '8px 0 0',
              color: '#6b7280',
              fontSize: '15px',
            }}
          >
            Digital PDF & Online Services
          </p>
        </header>

        {/* ================================= */}
        {/* PDF DOWNLOAD SECTION */}
        {/* ================================= */}

        <section
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '25px',
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
            Online PDF Downloads
          </h2>

          <p
            style={{
              color: '#6b7280',
            }}
          >
            Select a PDF, make payment and
            download instantly.
          </p>

          {/* ================================= */}
          {/* SEARCH */}
          {/* ================================= */}

          <input
            type="text"
            placeholder="Search PDF..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              border:
                '1px solid #d1d5db',
              borderRadius: '10px',
              fontSize: '16px',
              margin:
                '10px 0 20px',
              outline: 'none',
            }}
          />

          {/* ================================= */}
          {/* PDF LIST */}
          {/* ================================= */}

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
                    onClick={() =>
                      handleSelectPdf(
                        pdf
                      )
                    }
                    style={{
                      textAlign: 'left',
                      padding: '18px',
                      borderRadius:
                        '12px',
                      border: isSelected
                        ? '2px solid #2563eb'
                        : '1px solid #e5e7eb',
                      background:
                        isSelected
                          ? '#eff6ff'
                          : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: '700',
                        fontSize: '17px',
                        color:
                          '#111827',
                      }}
                    >
                      {pdf.name}
                    </div>

                    <div
                      style={{
                        marginTop:
                          '8px',
                        fontSize: '18px',
                        fontWeight:
                          '700',
                        color:
                          '#2563eb',
                      }}
                    >
                      ₹{pdf.price}
                    </div>
                  </button>
                );
              }
            )}
          </div>

          {filteredPdfs.length ===
            0 && (
            <p
              style={{
                textAlign:
                  'center',
                color:
                  '#6b7280',
                padding:
                  '20px',
              }}
            >
              No PDF found.
            </p>
          )}

          {/* ================================= */}
          {/* SELECTED PDF */}
          {/* ================================= */}

          {selectedPdf && (
            <div
              style={{
                marginTop: '25px',
                padding: '20px',
                borderRadius: '14px',
                background:
                  '#f9fafb',
                border:
                  '1px solid #e5e7eb',
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color:
                    '#111827',
                }}
              >
                Selected PDF
              </h3>

              <p
                style={{
                  margin:
                    '6px 0',
                  color:
                    '#374151',
                }}
              >
                <strong>
                  {selectedPdf.name}
                </strong>
              </p>

              <p
                style={{
                  margin:
                    '6px 0 18px',
                  fontSize:
                    '20px',
                  fontWeight:
                    '700',
                  color:
                    '#2563eb',
                }}
              >
                ₹{selectedPdf.price}
              </p>

              {/* ================================= */}
              {/* PAY BUTTON */}
              {/* ================================= */}

              <button
                onClick={
                  handlePayment
                }
                disabled={loading}
                style={{
                  width: '100%',
                  padding:
                    '15px',
                  border: 'none',
                  borderRadius:
                    '10px',
                  background:
                    loading
                      ? '#9ca3af'
                      : '#2563eb',
                  color:
                    '#ffffff',
                  fontSize:
                    '17px',
                  fontWeight:
                    '700',
                  cursor:
                    loading
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {loading
                  ? 'Processing...'
                  : `Pay ₹${selectedPdf.price} & Download`}
              </button>
            </div>
          )}

          {/* ================================= */}
          {/* SUCCESS MESSAGE */}
          {/* ================================= */}

          {successMessage && (
            <div
              style={{
                marginTop:
                  '20px',
                padding:
                  '16px',
                borderRadius:
                  '10px',
                background:
                  '#ecfdf5',
                border:
                  '1px solid #a7f3d0',
                color:
                  '#065f46',
                fontWeight:
                  '600',
              }}
            >
              {successMessage}
            </div>
          )}

          {/* ================================= */}
          {/* OPEN PDF */}
          {/* ================================= */}

          {pdfUrl && (
            <button
              onClick={
                handleOpenPdf
              }
              style={{
                width: '100%',
                marginTop:
                  '12px',
                padding:
                  '14px',
                border: 'none',
                borderRadius:
                  '10px',
                background:
                  '#16a34a',
                color:
                  '#ffffff',
                fontSize:
                  '16px',
                fontWeight:
                  '700',
                cursor:
                  'pointer',
              }}
            >
              📄 Open PDF
            </button>
          )}
        </section>

        {/* ================================= */}
        {/* FOOTER */}
        {/* ================================= */}

        <footer
          style={{
            textAlign:
              'center',
            padding:
              '25px 10px',
            color:
              '#6b7280',
            fontSize:
              '14px',
          }}
        >
          © {new Date().getFullYear()}
          {' '}
          SR E-Print Online
        </footer>
      </div>
    </main>
  );
}
