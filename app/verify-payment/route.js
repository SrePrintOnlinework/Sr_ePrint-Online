import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { pdfs } from '../../pdfs';

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      pdfId,
    } = body;

    // Check required fields
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !pdfId
    ) {
      return NextResponse.json(
        { error: 'Required payment details are missing' },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Razorpay keys are missing' },
        { status: 500 }
      );
    }

    // ------------------------------------
    // 1. Verify Razorpay payment signature
    // ------------------------------------

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(
        razorpay_order_id + '|' + razorpay_payment_id
      )
      .digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(razorpay_signature)
      )
    ) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // ------------------------------------
    // 2. Find selected PDF
    // ------------------------------------

    const selectedPdf = pdfs.find(
      (pdf) => pdf.id === pdfId
    );

    if (!selectedPdf) {
      return NextResponse.json(
        { error: 'Selected PDF not found' },
        { status: 404 }
      );
    }

    // ------------------------------------
    // 3. Verify Razorpay order amount
    // ------------------------------------

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString('base64');

    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: 'no-store',
      }
    );

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      return NextResponse.json(
        {
          error: 'Unable to verify Razorpay order',
        },
        { status: 400 }
      );
    }

    // Must be exactly ₹99
    if (
      orderData.amount !== 9900 ||
      orderData.currency !== 'INR'
    ) {
      return NextResponse.json(
        {
          error: 'Invalid payment amount',
        },
        { status: 400 }
      );
    }

    // ------------------------------------
    // 4. Verify order ID
    // ------------------------------------

    if (orderData.id !== razorpay_order_id) {
      return NextResponse.json(
        {
          error: 'Invalid Razorpay order',
        },
        { status: 400 }
      );
    }

    // ------------------------------------
    // 5. Read PDF
    // ------------------------------------

    const pdfPath = path.join(
      process.cwd(),
      'Public',
      selectedPdf.file
    );

    const pdfBuffer = await readFile(pdfPath);

    // ------------------------------------
    // 6. Send PDF after successful payment
    // ------------------------------------

    return new NextResponse(pdfBuffer, {
      status: 200,

      headers: {
        'Content-Type': 'application/pdf',

        'Content-Disposition':
          `attachment; filename="${selectedPdf.file}"`,

        'Content-Length':
          pdfBuffer.length.toString(),

        'Cache-Control':
          'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error(
      'Payment verification error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Payment verification failed',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
