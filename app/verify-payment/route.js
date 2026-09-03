'use client';

import { useState, useRef, useEffect } from 'react';
import { pdfs } from './pdfs';

export default function Home() {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  // Prevent duplicate payment/download
  const paymentStartedRef = useRef(false);
  const downloadStartedRef = useRef(false);
  const razorpayRef = useRef(null);

  // ------------------------------------
  // CLEAN PDF URL
  // ------------------------------------

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ------------------------------------
  // LOAD RAZORPAY
  // ------------------------------------

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

  // ------------------------------------
  // CREATE ORDER
  // ------------------------------------

  const createOrder = async () => {
    const response = await fetch('/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfId: selectedPdf.id,
      }),
      cache: 'no-store',
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        'Server returned an invalid response while creating order.'
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        `Unable to create order. Server status: ${response.status}`
      );
    }

    if (!data?.orderId) {
      throw new Error(
        'Razorpay Order ID was not received.'
      );
    }

    return data;
  };

  // ------------------------------------
  // VERIFY PAYMENT
  // ------------------------------------

  const verifyPayment = async (razorpayResponse) => {
    const response = await fetch('/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id:
          razorpayResponse.razorpay_order_id,

        razorpay_payment_id:
          razorpayResponse.razorpay_payment_id,

        razorpay_signature:
          razorpayResponse.razorpay_signature,

        pdfId: selectedPdf.id,
      }),
      cache: 'no-store',
    });

    return response;
  };

  // ------------------------------------
  // PAYMENT
  // ------------------------------------

  const handlePayment = async () => {
    // --------------------------------
    // BLOCK DUPLICATE CLICK
    // --------------------------------

    if (paymentStartedRef.current || loading) {
      return;
    }

    if (!selectedPdf) {
      alert('Please select a PDF first.');
      return;
    }

    paymentStartedRef.current = true;
    downloadStartedRef.current = false;

    setLoading(true);
    setSuccessMessage('');

    // Revoke old PDF URL
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl('');
    }

    try {
      // --------------------------------
      // LOAD RAZORPAY
      // --------------------------------

      const razorpayLoaded =
        await loadRazorpayScript();

      if (!razorpayLoaded) {
        throw new Error(
          'Razorpay payment window could not be loaded. Please check your internet connection and try again.'
        );
      }

      // --------------------------------
      // PUBLIC RAZORPAY KEY
      // --------------------------------

      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!razorpayKey) {
        throw new Error(
          'Razorpay Key ID is missing. Please check Vercel Environment Variables.'
        );
      }

      // --------------------------------
      // CREATE ORDER
      // --------------------------------

      const orderData =
        await createOrder();

      // --------------------------------
      // RAZORPAY OPTIONS
      // --------------------------------

      const options = {
        key: razorpayKey,

        amount:
          Number(orderData.amount) || 9900,

        currency:
          orderData.currency || 'INR',

        name:
          'SR INTERNET Online Centre',

        description:
          `Digital PDF - ${selectedPdf.name}`,

        order_id:
          orderData.orderId,

        // --------------------------------
        // CUSTOMER DETAILS
        // --------------------------------

        prefill: {
          name: '',
          email: '',
          contact: '',
        },

        // --------------------------------
        // THEME
        // --------------------------------

        theme: {
          color: '#1565c0',
        },

        // --------------------------------
        // SUCCESS
        // --------------------------------

        handler: async function (response) {
          try {
            // --------------------------------
            // VALIDATE RAZORPAY RESPONSE
            // --------------------------------

            if (
              !response ||
              !response.razorpay_order_id ||
              !response.razorpay_payment_id ||
              !response.razorpay_signature
            ) {
              throw new Error(
                'Invalid payment response received from Razorpay.'
              );
            }

            // --------------------------------
            // PREVENT DUPLICATE DOWNLOAD
            // --------------------------------

            if (downloadStartedRef.current) {
              return;
            }

            setLoading(true);

            // --------------------------------
            // VERIFY PAYMENT
            // --------------------------------

            const verifyRes =
              await verifyPayment(response);

            // --------------------------------
            // HANDLE 405
            // --------------------------------

            if (verifyRes.status === 405) {
              console.error(
                'VERIFY PAYMENT 405:',
                verifyRes.status
              );

              throw new Error(
                'Payment was successful, but the verification API is not accepting POST requests. Please check the /verify-payment route deployment.'
              );
            }

            // --------------------------------
            // HANDLE OTHER ERRORS
            // --------------------------------

            if (!verifyRes.ok) {
              let errorMessage =
                'Payment verification failed.';

              try {
                const errorData =
                  await verifyRes.json();

                errorMessage =
                  errorData?.error ||
                  errorMessage;
              } catch {
                // Keep default error
              }

              throw new Error(
                errorMessage
              );
            }

            // --------------------------------
            // READ PDF
            // --------------------------------

            const contentType =
              verifyRes.headers.get(
                'content-type'
              );

            if (
              !contentType ||
              !contentType.includes(
                'application/pdf'
              )
            ) {
              let serverMessage =
                'Server did not return a PDF file.';

              try {
                const errorData =
                  await verifyRes.json();

                serverMessage =
                  errorData?.error ||
                  serverMessage;
              } catch {
                // Ignore JSON parsing error
              }

              throw new Error(
                serverMessage
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

            // --------------------------------
            // CREATE PDF URL
            // --------------------------------

            const url =
              window.URL.createObjectURL(
                blob
              );

            setPdfUrl(url);

            // --------------------------------
            // CREATE UNIQUE FILE NAME
            // --------------------------------

            const originalName =
              selectedPdf.file;

            const dotIndex =
              originalName.lastIndexOf('.');

            let baseName =
              originalName;

            let extension =
              '.pdf';

            if (dotIndex > 0) {
              baseName =
                originalName.substring(
                  0,
                  dotIndex
                );

              extension =
                originalName.substring(
                  dotIndex
                );
            }

            const uniqueFileName =
              `${baseName}-payment-${response.razorpay_payment_id}${extension}`;

            // --------------------------------
            // START DOWNLOAD ONLY ONCE
            // --------------------------------

            if (
              !downloadStartedRef.current
            ) {
              downloadStartedRef.current =
                true;

              const link =
                document.createElement('a');

              link.href = url;

              link.download =
                uniqueFileName;

              link.style.display =
                'none';

              document.body.appendChild(
                link
              );

              link.click();

              document.body.removeChild(
                link
              );
            }

            // --------------------------------
            // SUCCESS
            // --------------------------------

            setSuccessMessage(
              '✅ Payment Successful! Your PDF download has started.'
            );

          } catch (error) {
            console.error(
              'Payment verification/download error:',
              error
            );

            downloadStartedRef.current =
              false;

            alert(
              error?.message ||
              'Payment was received, but PDF download failed. Please contact support.'
            );

          } finally {
            setLoading(false);

            paymentStartedRef.current =
              false;

            razorpayRef.current = null;
          }
        },

        // --------------------------------
        // PAYMENT WINDOW CLOSED
        // --------------------------------

        modal: {
          ondismiss: function () {
            setLoading(false);

            paymentStartedRef.current =
              false;

            razorpayRef.current =
              null;
          },
        },
      };

      // --------------------------------
      // CREATE RAZORPAY INSTANCE
      // --------------------------------

      const razorpay =
        new window.Razorpay(options);

      razorpayRef.current =
        razorpay;

      // --------------------------------
      // PAYMENT FAILED
      // --------------------------------

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

          razorpayRef.current =
            null;

          const reason =
            response?.error?.description ||
            'Payment failed.';

          alert(
            `❌ ${reason}\n\nPlease try again.`
          );
        }
      );

      // --------------------------------
      // OPEN RAZORPAY
      // --------------------------------

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

      razorpayRef.current =
        null;

      alert(
        error?.message ||
        'Something went wrong. Please try again.'
      );
    }
  };

  // ------------------------------------
  // SEARCH
  // ------------------------------------

  const filteredPdfs =
    pdfs.filter((pdf) =>
      pdf.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  // ------------------------------------
  // SELECT PDF
  // ------------------------------------

  const selectPdf = (pdf) => {
    if (loading) {
      return;
    }

    setSelectedPdf(pdf);
    setSuccessMessage('');

    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
    }

    setPdfUrl('');

    downloadStartedRef.current =
      false;
  };

  // ------------------------------------
  // PAGE
  // ------------------------------------

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f4f7fb',
        fontFamily:
          'Arial, sans-serif',
      }}
    >

      {/* HEADER */}

      <header
        style={{
          background:
            'linear-gradient(135deg, #0d47a1, #1976d2)',
          color: 'white',
          padding: '26px 15px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '44px',
            }}
          >
            📄
          </div>

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

        {/* SUCCESS */}

        {successMessage && pdfUrl && (
          <div
            style={{
              background:
                'linear-gradient(135deg, #e8f5e9, #f1fff3)',
              border:
                '2px solid #66bb6a',
              color: '#2e7d32',
              padding: '18px',
              borderRadius: '14px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: 'bold',
              lineHeight: 1.5,
            }}
          >
            <div>
              {successMessage}
            </div>

            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: '13px',
                padding: '15px',
                background:
                  'linear-gradient(135deg, #2e7d32, #43a047)',
                color: 'white',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '17px',
              }}
            >
              📄 Open PDF
            </a>
          </div>
        )}

        {/* INTRO */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.07)',
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
            Select the required PDF,
            make a secure payment of ₹99,
            and download your PDF instantly.
          </p>
        </div>

        {/* SEARCH */}

        <div
          style={{
            background:
              'linear-gradient(135deg, #e3f2fd, #ffffff)',
            border:
              '1px solid #90caf9',
            borderRadius: '15px',
            padding: '15px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              fontWeight: 'bold',
              color: '#1565c0',
              marginBottom: '9px',
            }}
          >
            🔎 Search for your PDF
          </div>

          <input
            type="text"
            placeholder="Type PDF name here..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding:
                '15px 15px 15px 18px',
              fontSize: '16px',
              fontWeight: '500',
              border:
                '2px solid #1976d2',
              borderRadius: '10px',
              outline: 'none',
              background: '#e3f2fd',
              color: '#222',
            }}
          />

          {search && (
            <div
              style={{
                marginTop: '7px',
                fontSize: '13px',
                color: '#666',
              }}
            >
              {filteredPdfs.length}{' '}
              PDF
              {filteredPdfs.length !== 1
                ? 's'
                : ''}{' '}
              found
            </div>
          )}
        </div>

        {/* PDF LIST */}

        <div
          style={{
            background: 'lightgreen',
            borderRadius: '14px',
            padding: '10px',
            marginBottom: '20px',
          }}
        >
          <h3
            style={{
              padding: '8px 10px',
              margin: '0 0 5px',
              color: '#222',
            }}
          >
            Available PDFs
          </h3>

          {filteredPdfs.length === 0 ? (
            <p
              style={{
                padding: '20px 10px',
                textAlign: 'center',
                color: '#777',
              }}
            >
              No PDF found.
            </p>
          ) : (
            filteredPdfs.map((pdf) => (
              <div
                key={pdf.id}
                onClick={() =>
                  selectPdf(pdf)
                }
                style={{
                  border:
                    selectedPdf?.id === pdf.id
                      ? '2px solid #1565c0'
                      : '1px solid #e1e5eb',

                  borderRadius: '12px',
                  padding: '15px',
                  marginBottom: '10px',

                  cursor: loading
                    ? 'not-allowed'
                    : 'pointer',

                  background:
                    selectedPdf?.id === pdf.id
                      ? '#eef6ff'
                      : 'white',

                  opacity:
                    loading ? 0.7 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '32px',
                    }}
                  >
                    📄
                  </div>

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        color: '#222',
                        fontSize: '16px',
                      }}
                    >
                      {pdf.name}
                    </div>

                    <div
                      style={{
                        color: '#777',
                        fontSize: '13px',
                        marginTop: '4px',
                      }}
                    >
                      PDF Document
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: 'bold',
                      color: '#1565c0',
                    }}
                  >
                    ₹99
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* SELECTED PDF */}

        {selectedPdf && (
          <div
            style={{
              background: 'white',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center',
              boxShadow:
                '0 3px 12px rgba(0,0,0,0.07)',
            }}
          >
            <div
              style={{
                color: '#555',
                marginBottom: '8px',
              }}
            >
              Selected PDF
            </div>

            <h3
              style={{
                margin: '0 0 15px',
                color: '#222',
              }}
            >
              {selectedPdf.name}
            </h3>

            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1565c0',
                marginBottom: '15px',
              }}
            >
              ₹99
            </div>

            <button
              type="button"
              onClick={handlePayment}
              disabled={
                loading ||
                paymentStartedRef.current
              }
              style={{
                width: '100%',
                padding: '15px',
                border: 'none',
                borderRadius: '10px',

                background:
                  loading
                    ? '#999'
                    : 'linear-gradient(135deg, #1565c0, #1976d2)',

                color: 'white',
                fontSize: '17px',
                fontWeight: 'bold',

                cursor:
                  loading
                    ? 'not-allowed'
                    : 'pointer',

                opacity:
                  loading ? 0.8 : 1,
              }}
            >
              {loading
                ? '⏳ Processing Payment...'
                : '💳 Pay ₹99 & Download PDF'}
            </button>

            {loading && (
              <p
                style={{
                  marginTop: '12px',
                  marginBottom: 0,
                  color: '#666',
                  fontSize: '13px',
                }}
              >
                Please do not press the payment
                button again.
              </p>
            )}
          </div>
        )}

        {/* ABOUT */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              color: '#222',
            }}
          >
            About SR E-Print Online
          </h2>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            SR E-Print Online is a digital
            document service platform that
            provides downloadable PDF and
            digital document files to customers
            online.
          </p>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            Customers can browse available
            digital products, select the required
            file, make an online payment, and
            download the purchased digital file
            after successful payment.
          </p>
        </div>

        {/* SERVICES */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              color: '#222',
            }}
          >
            Our Services & Products
          </h2>

          <ul
            style={{
              color: '#555',
              lineHeight: 1.9,
            }}
          >
            <li>Digital PDF documents</li>
            <li>Printable document files</li>
            <li>Ready-to-use document formats and templates</li>
            <li>Application and form-related digital files</li>
            <li>Educational and reference PDF materials</li>
            <li>Other digital document files</li>
          </ul>
        </div>

        {/* HOW IT WORKS */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              color: '#222',
            }}
          >
            How It Works
          </h2>

          <ol
            style={{
              color: '#555',
              lineHeight: 1.9,
            }}
          >
            <li>Browse available digital products.</li>
            <li>Select the required PDF.</li>
            <li>Proceed to online payment.</li>
            <li>Complete the payment.</li>
            <li>Download the purchased digital file.</li>
          </ol>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            Digital products are delivered
            electronically. No physical product
            is shipped.
          </p>
        </div>

        {/* PAYMENT & DELIVERY */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              color: '#222',
            }}
          >
            Payment & Digital Delivery
          </h2>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            We accept online payments through
            the payment methods available at
            checkout.
          </p>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            All prices displayed on the website
            are in Indian Rupees (INR).
          </p>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            After successful payment, the
            purchased digital PDF/file is
            delivered electronically and can be
            downloaded by the customer.
          </p>
        </div>

        {/* SHIPPING POLICY */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              color: '#222',
            }}
          >
            Shipping Policy
          </h2>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            SR E-Print Online provides digital
            products only. No physical products
            are shipped to customers.
          </p>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            After successful payment, the
            purchased PDF or digital document
            is delivered electronically through
            the website.
          </p>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            Therefore, there is no physical
            shipping charge, courier delivery,
            or shipping time for our digital
            products.
          </p>
        </div>

        {/* BUSINESS ADDRESS */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              color: '#222',
            }}
          >
            Business Address
          </h2>

          <p
            style={{
              color: '#555',
              lineHeight: 1.7,
            }}
          >
            <strong>
              SR INTERNET Online Centre
            </strong>
            <br />
            New Maa Mart backside
            <br />
            Kurnool Road
            <br />
            Ieeja, Jogulamba Gadwal
            <br />
            Telangana - 509127
            <br />
            India
          </p>
        </div>

        {/* CONTACT */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '14px',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              color: '#222',
            }}
          >
            Contact Us
          </h2>

          <p
            style={{
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            For questions, payment-related
            issues, or assistance with our
            digital products, please contact us.
          </p>

          <p>
            <strong>Business Name:</strong>{' '}
            SR E-Print Online
          </p>

          <p>
            <strong>Contact Person:</strong>{' '}
            Gs Raju
          </p>

          <p>
            <strong>Email:</strong>{' '}
            <a
              href="mailto:sronline99890@gmail.com"
              style={{
                color: '#1565c0',
              }}
            >
              sronline99890@gmail.com
            </a>
          </p>

          <p>
            <strong>Phone / WhatsApp:</strong>{' '}
            <a
              href="tel:+919989057683"
              style={{
                color: '#1565c0',
              }}
            >
              9989057683
            </a>
          </p>

          <p>
            <strong>Business Hours:</strong>{' '}
            Monday to Saturday,
            9:00 AM to 6:00 PM
          </p>
        </div>

        {/* FOOTER */}

        <footer
          style={{
            textAlign: 'center',
            marginTop: '30px',
            color: '#777',
            fontSize: '13px',
            paddingBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '14px',
            }}
          >
            <a
              href="/privacy"
              style={{
                color: '#1565c0',
                fontWeight: 'bold',
              }}
            >
              Privacy Policy
            </a>

            <span>•</span>

            <a
              href="/refund"
              style={{
                color: '#1565c0',
                fontWeight: 'bold',
              }}
            >
              Refund / Cancellation
            </a>

            <span>•</span>

            <a
              href="/terms"
              style={{
                color: '#1565c0',
                fontWeight: 'bold',
              }}
            >
              Terms & Conditions
            </a>
          </div>

          <p>
            Secure payment powered by Razorpay
          </p>

          <p>
            © 2026 SR E-Print Online.
            All rights reserved.
          </p>
        </footer>
      </section>

      {/* WHATSAPP */}

      <a
        href="https://wa.me/919989057683?text=Hello%20SR%20E-Print%20Online,%20I%20need%20help%20regarding%20a%20PDF%20purchase."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp Help"
        style={{
          position: 'fixed',
          right: '18px',
          bottom: '18px',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: '#25D366',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          fontSize: '30px',
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.25)',
          zIndex: 9999,
        }}
      >
        💬
      </a>

    </main>
  );
}
