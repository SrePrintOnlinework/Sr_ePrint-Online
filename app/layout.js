import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pdfs } from '../pdfs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      pdfId,
    } = body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !pdfId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing payment verification details.',
        },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Razorpay server configuration is missing.',
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 1. Find selected PDF
    // --------------------------------------------------
    const selectedPdf = pdfs.find(
      (pdf) => String(pdf.id) === String(pdfId)
    );

    if (!selectedPdf) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF not found.',
        },
        { status: 404 }
      );
    }

    const price = Number(selectedPdf.price);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PDF price.',
        },
        { status: 500 }
      );
    }

    const expectedAmount = Math.round(price * 100);

    // --------------------------------------------------
    // 2. Verify Razorpay signature
    // --------------------------------------------------
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    );

    if (!signaturesMatch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Razorpay payment signature.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Razorpay Basic Authentication
    // --------------------------------------------------
    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString('base64');

    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    // --------------------------------------------------
    // 3. Fetch Razorpay Order
    // --------------------------------------------------
    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(
        razorpay_order_id
      )}`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    );

    const orderText = await orderResponse.text();

    let orderData;

    try {
      orderData = JSON.parse(orderText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to verify Razorpay order.',
        },
        { status: 502 }
      );
    }

    if (!orderResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            orderData?.error?.description ||
            'Razorpay order verification failed.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Verify PDF ID from order notes
    // --------------------------------------------------
    const orderPdfId = orderData?.notes?.pdfId;

    if (
      orderPdfId &&
      String(orderPdfId) !== String(selectedPdf.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF does not match the Razorpay order.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Verify order amount
    // --------------------------------------------------
    if (Number(orderData?.amount) !== expectedAmount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment amount does not match the PDF price.',
        },
        { status: 400 }
      );
    }

    // IMPORTANT:
    // Do NOT reject the order because status is "paid".
    // Razorpay can change order status from "created"
    // to "paid" after successful payment.

    // --------------------------------------------------
    // 6. Fetch Razorpay Payment
    // --------------------------------------------------
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        razorpay_payment_id
      )}`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    );

    const paymentText = await paymentResponse.text();

    let paymentData;

    try {
      paymentData = JSON.parse(paymentText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to verify Razorpay payment.',
        },
        { status: 502 }
      );
    }

    if (!paymentResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            paymentData?.error?.description ||
            'Razorpay payment verification failed.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 7. Verify payment belongs to this order
    // --------------------------------------------------
    if (
      String(paymentData?.order_id) !==
      String(razorpay_order_id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment does not belong to this order.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 8. Verify payment amount
    // --------------------------------------------------
    if (Number(paymentData?.amount) !== expectedAmount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment amount is incorrect.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 9. Verify captured payment
    // --------------------------------------------------
    if (paymentData?.status !== 'captured') {
      return NextResponse.json(
        {
          success: false,
          error: `Payment is not captured. Current status: ${paymentData?.status}`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 10. Validate PDF filename
    // --------------------------------------------------
    const fileName = String(selectedPdf.file || '');

    if (
      !fileName ||
      !fileName.toLowerCase().endsWith('.pdf') ||
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      path.isAbsolute(fileName)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PDF file.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 11. Find PDF inside /public
    // --------------------------------------------------
    const publicDirectory = path.join(
      process.cwd(),
      'public'
    );

    const pdfPath = path.join(
      publicDirectory,
      fileName
    );

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        {
          success: false,
          error: `PDF file not found: ${fileName}`,
        },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF file is empty.',
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 12. Send PDF to browser
    // --------------------------------------------------
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('VERIFY PAYMENT ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Payment verification failed.',
      },
      { status: 500 }
    );
  }
}
