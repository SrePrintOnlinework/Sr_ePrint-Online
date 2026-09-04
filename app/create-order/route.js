import { NextResponse } from 'next/server';
import { pdfs } from '../pdfs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // ==========================================
    // READ REQUEST
    // ==========================================

    const body = await request.json();
    const pdfId = body?.pdfId;

    // ==========================================
    // CHECK PDF ID
    // ==========================================

    if (!pdfId) {
      return NextResponse.json(
        {
          error: 'PDF ID is required.',
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // FIND PDF FROM SERVER-SIDE pdfs.js
    // ==========================================

    const selectedPdf = pdfs.find(
      (pdf) => String(pdf.id) === String(pdfId)
    );

    if (!selectedPdf) {
      return NextResponse.json(
        {
          error: 'Selected PDF not found.',
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================
    // CHECK PDF FILE NAME
    // ==========================================

    if (!selectedPdf.file) {
      console.error(
        'PDF file name is missing:',
        selectedPdf
      );

      return NextResponse.json(
        {
          error: 'PDF file configuration is missing.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // CHECK PDF PRICE
    // ==========================================

    const price = Number(selectedPdf.price);

    if (!Number.isFinite(price) || price <= 0) {
      console.error(
        'Invalid PDF price:',
        selectedPdf
      );

      return NextResponse.json(
        {
          error: 'Invalid PDF price configuration.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // RAZORPAY ENVIRONMENT VARIABLES
    // ==========================================

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error(
        'Razorpay environment variables are missing.'
      );

      return NextResponse.json(
        {
          error:
            'Razorpay payment configuration is missing. Please check Vercel Environment Variables.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // CONVERT INR TO PAISE
    // ==========================================

    // ₹99 = 9900 paise
    // ₹20 = 2000 paise

    const amount = Math.round(price * 100);

    // ==========================================
    // CREATE BASIC AUTH
    // ==========================================

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString('base64');

    // ==========================================
    // CREATE RAZORPAY ORDER
    // ==========================================

    const response = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },

        body: JSON.stringify({
          amount: amount,
          currency: 'INR',

          receipt: `pdf_${selectedPdf.id}_${Date.now()}`,

          notes: {
            pdfId: String(selectedPdf.id),
            pdfName: String(selectedPdf.name || ''),
            pdfFile: String(selectedPdf.file),
            price: String(price),
          },
        }),

        cache: 'no-store',
      }
    );

    // ==========================================
    // READ RAZORPAY RESPONSE
    // ==========================================

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      console.error(
        'Invalid Razorpay response:',
        responseText
      );

      return NextResponse.json(
        {
          error:
            'Invalid response received from Razorpay.',
        },
        {
          status: 502,
        }
      );
    }

    // ==========================================
    // CHECK RAZORPAY ERROR
    // ==========================================

    if (!response.ok) {
      console.error(
        'Razorpay order creation failed:',
        data
      );

      return NextResponse.json(
        {
          error:
            data?.error?.description ||
            data?.error?.reason ||
            'Failed to create Razorpay order.',
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // CHECK RAZORPAY ORDER ID
    // ==========================================

    if (!data?.id) {
      console.error(
        'Razorpay order ID missing:',
        data
      );

      return NextResponse.json(
        {
          error:
            'Razorpay Order ID was not received.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // VERIFY RAZORPAY AMOUNT
    // ==========================================

    if (Number(data.amount) !== amount) {
      console.error(
        'Razorpay amount mismatch:',
        {
          expected: amount,
          received: data.amount,
        }
      );

      return NextResponse.json(
        {
          error:
            'Razorpay payment amount verification failed.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // VERIFY CURRENCY
    // ==========================================

    if (data.currency !== 'INR') {
      console.error(
        'Unexpected Razorpay currency:',
        data.currency
      );

      return NextResponse.json(
        {
          error:
            'Unexpected payment currency received from Razorpay.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // LOG SUCCESS
    // ==========================================

    console.log(
      '=========================================='
    );

    console.log(
      'RAZORPAY ORDER CREATED SUCCESSFULLY'
    );

    console.log(
      'Order ID:',
      data.id
    );

    console.log(
      'PDF ID:',
      selectedPdf.id
    );

    console.log(
      'PDF Name:',
      selectedPdf.name
    );

    console.log(
      'PDF File:',
      selectedPdf.file
    );

    console.log(
      'Price:',
      price
    );

    console.log(
      'Amount:',
      amount
    );

    console.log(
      '=========================================='
    );

    // ==========================================
    // SEND ORDER DETAILS TO CLIENT
    // ==========================================

    return NextResponse.json(
      {
        success: true,

        orderId: data.id,

        amount: data.amount,

        currency: data.currency,

        pdfId: String(selectedPdf.id),

        pdfName: String(
          selectedPdf.name || ''
        ),

        price: price,
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    // ==========================================
    // SERVER ERROR
    // ==========================================

    console.error(
      '=========================================='
    );

    console.error(
      'CREATE ORDER ERROR:',
      error
    );

    console.error(
      '=========================================='
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Something went wrong while creating the payment order.',
      },
      {
        status: 500,
      }
    );
  }
}
