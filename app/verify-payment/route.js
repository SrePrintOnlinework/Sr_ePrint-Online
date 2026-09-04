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
          error: 'Missing Razorpay payment details.',
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
          error:
            'Razorpay keys are missing in Vercel Environment Variables.',
        },
        { status: 500 }
      );
    }

    // Find PDF
    const selectedPdf = pdfs.find(
      (pdf) => String(pdf.id) === String(pdfId)
    );

    if (!selectedPdf) {
      return NextResponse.json(
        {
          success: false,
          error: `PDF ID not found: ${pdfId}`,
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
    // 1. Verify Razorpay signature
    // --------------------------------------------------

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    if (
      generatedSignature.length !==
      razorpay_signature.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Razorpay signature.',
        },
        { status: 400 }
      );
    }

    const signatureValid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    );

    if (!signatureValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Razorpay signature verification failed.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Razorpay authentication
    // --------------------------------------------------

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString('base64');

    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    // --------------------------------------------------
    // 2. Get Razorpay Order
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
          error:
            'Razorpay order API returned an invalid response.',
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
            'Unable to fetch Razorpay order.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Verify order amount
    // --------------------------------------------------

    if (Number(orderData.amount) !== expectedAmount) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Order amount mismatch. ` +
            `Expected ₹${price}, Razorpay order amount is ₹${
              Number(orderData.amount) / 100
            }.`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Verify PDF ID from order notes
    // --------------------------------------------------

    if (
      orderData.notes?.pdfId &&
      String(orderData.notes.pdfId) !==
        String(selectedPdf.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This payment order does not belong to the selected PDF.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Get Razorpay Payment
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
          error:
            'Razorpay payment API returned an invalid response.',
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
            'Unable to fetch Razorpay payment.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. Verify payment belongs to order
    // --------------------------------------------------

    if (
      String(paymentData.order_id) !==
      String(razorpay_order_id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Razorpay payment does not belong to this order.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 7. Verify payment amount
    // --------------------------------------------------

    if (Number(paymentData.amount) !== expectedAmount) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Payment amount mismatch. Expected ₹${price}.`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 8. Verify payment captured
    // --------------------------------------------------

    if (paymentData.status !== 'captured') {
      return NextResponse.json(
        {
          success: false,
          error:
            `Payment is not captured. Current status: ${paymentData.status}`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 9. Verify order paid
    // --------------------------------------------------

    if (
      orderData.status &&
      orderData.status !== 'paid'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Razorpay order is not marked paid. Current status: ${orderData.status}`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 10. Validate filename
    // --------------------------------------------------

    const fileName = String(
      selectedPdf.file || ''
    );

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
          error: 'Invalid PDF filename.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 11. Find PDF in public folder
    // --------------------------------------------------

    const pdfPath = path.join(
      process.cwd(),
      'public',
      fileName
    );

    console.log('PDF PATH:', pdfPath);
    console.log('PDF EXISTS:', fs.existsSync(pdfPath));

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        {
          success: false,
          error:
            `PDF file not found on server: ${fileName}`,
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 12. Read PDF
    // --------------------------------------------------

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
    // 13. Return PDF
    // --------------------------------------------------

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          `attachment; filename="${fileName}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control':
          'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error(
      'VERIFY PAYMENT ERROR:',
      error
    );

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
