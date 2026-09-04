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

    // ==========================================
    // CHECK PAYMENT DATA
    // ==========================================

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !pdfId
    ) {
      return NextResponse.json(
        {
          error:
            'Required payment information is missing.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // RAZORPAY SECRET
    // ==========================================

    const secret =
      process.env.RAZORPAY_KEY_SECRET;

    const keyId =
      process.env.RAZORPAY_KEY_ID;

    if (!secret || !keyId) {
      console.error(
        'Razorpay environment variables are missing.'
      );

      return NextResponse.json(
        {
          error:
            'Payment configuration error.',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // FIND PDF
    // ==========================================

    const selectedPdf = pdfs.find(
      (pdf) =>
        String(pdf.id) === String(pdfId)
    );

    if (!selectedPdf) {
      return NextResponse.json(
        {
          error:
            'Selected PDF was not found.',
        },
        { status: 404 }
      );
    }

    // ==========================================
    // VERIFY RAZORPAY SIGNATURE
    // ==========================================

    const generatedSignature =
      crypto
        .createHmac('sha256', secret)
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');

    const receivedBuffer =
      Buffer.from(
        razorpay_signature,
        'hex'
      );

    const generatedBuffer =
      Buffer.from(
        generatedSignature,
        'hex'
      );

    let signatureValid = false;

    if (
      receivedBuffer.length ===
      generatedBuffer.length
    ) {
      signatureValid =
        crypto.timingSafeEqual(
          generatedBuffer,
          receivedBuffer
        );
    }

    if (!signatureValid) {
      console.error(
        'Invalid Razorpay signature.'
      );

      return NextResponse.json(
        {
          error:
            'Payment verification failed.',
        },
        { status: 400 }
      );
    }

    console.log(
      'Razorpay signature verified:',
      razorpay_payment_id
    );

    // ==========================================
    // VERIFY ORDER WITH RAZORPAY
    // ==========================================

    const auth = Buffer.from(
      `${keyId}:${secret}`
    ).toString('base64');

    const orderResponse =
      await fetch(
        `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Basic ${auth}`,
          },

          cache: 'no-store',
        }
      );

    const orderData =
      await orderResponse.json();

    if (!orderResponse.ok) {
      console.error(
        'Unable to fetch Razorpay order:',
        orderData
      );

      return NextResponse.json(
        {
          error:
            'Unable to verify Razorpay order.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CHECK ORDER PDF ID
    // ==========================================

    const orderPdfId =
      orderData?.notes?.pdfId;

    if (
      String(orderPdfId) !==
      String(selectedPdf.id)
    ) {
      console.error(
        'PDF ID mismatch.',
        {
          orderPdfId,
          requestedPdfId: selectedPdf.id,
        }
      );

      return NextResponse.json(
        {
          error:
            'Payment order does not match the selected PDF.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CHECK ORDER AMOUNT
    // ==========================================

    const expectedAmount =
      Math.round(
        Number(selectedPdf.price) * 100
      );

    const orderAmount =
      Number(orderData?.amount);

    if (
      !Number.isFinite(orderAmount) ||
      orderAmount !== expectedAmount
    ) {
      console.error(
        'Order amount mismatch.',
        {
          orderAmount,
          expectedAmount,
        }
      );

      return NextResponse.json(
        {
          error:
            'Payment amount does not match the selected PDF price.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CHECK ORDER STATUS
    // ==========================================

    if (
      orderData?.status !== 'created'
    ) {
      console.error(
        'Invalid Razorpay order status:',
        orderData?.status
      );

      return NextResponse.json(
        {
          error:
            'Invalid Razorpay order.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // VERIFY PAYMENT DETAILS
    // ==========================================

    const paymentResponse =
      await fetch(
        `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Basic ${auth}`,
          },

          cache: 'no-store',
        }
      );

    const paymentData =
      await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        'Unable to fetch payment:',
        paymentData
      );

      return NextResponse.json(
        {
          error:
            'Unable to verify payment details.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CHECK PAYMENT ORDER ID
    // ==========================================

    if (
      String(paymentData?.order_id) !==
      String(razorpay_order_id)
    ) {
      console.error(
        'Payment Order ID mismatch.'
      );

      return NextResponse.json(
        {
          error:
            'Payment does not belong to this order.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CHECK PAYMENT AMOUNT
    // ==========================================

    const paymentAmount =
      Number(paymentData?.amount);

    if (
      paymentAmount !==
      expectedAmount
    ) {
      console.error(
        'Payment amount mismatch.',
        {
          paymentAmount,
          expectedAmount,
        }
      );

      return NextResponse.json(
        {
          error:
            'Payment amount does not match PDF price.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CHECK PAYMENT STATUS
    // ==========================================

    if (
      paymentData?.status !== 'captured'
    ) {
      console.error(
        'Payment is not captured:',
        paymentData?.status
      );

      return NextResponse.json(
        {
          error:
            'Payment has not been captured yet.',
        },
        { status: 400 }
      );
    }

    console.log(
      'Payment verified and captured:',
      razorpay_payment_id
    );

    // ==========================================
    // FILE NAME
    // ==========================================

    const fileName =
      selectedPdf.file;

    if (!fileName) {
      return NextResponse.json(
        {
          error:
            'PDF file name is missing in pdfs.js.',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // SECURITY CHECK
    // ==========================================

    if (
      fileName.includes('..') ||
      fileName.includes('\\') ||
      path.isAbsolute(fileName) ||
      !fileName.toLowerCase().endsWith('.pdf')
    ) {
      console.error(
        'Invalid PDF file path:',
        fileName
      );

      return NextResponse.json(
        {
          error:
            'Invalid PDF file path.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // PUBLIC DIRECTORY
    // ==========================================

    const publicDirectory =
      path.join(
        process.cwd(),
        'public'
      );

    const filePath =
      path.join(
        publicDirectory,
        fileName
      );

    // ==========================================
    // CHECK FILE
    // ==========================================

    if (
      !fs.existsSync(filePath)
    ) {
      console.error(
        'PDF file does not exist:',
        filePath
      );

      return NextResponse.json(
        {
          error:
            `PDF file not found on server: ${fileName}`,
        },
        { status: 404 }
      );
    }

    // ==========================================
    // READ PDF
    // ==========================================

    const fileBuffer =
      fs.readFileSync(filePath);

    if (
      !fileBuffer ||
      fileBuffer.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'PDF file is empty.',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // RETURN PDF
    // ==========================================

    return new NextResponse(
      fileBuffer,
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/pdf',

          'Content-Disposition':
            `attachment; filename="${fileName}"`,

          'Content-Length':
            String(fileBuffer.length),

          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',

          Pragma: 'no-cache',

          Expires: '0',
        },
      }
    );

  } catch (error) {
    console.error(
      'VERIFY PAYMENT ERROR:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Payment verification or PDF delivery failed.',
      },
      { status: 500 }
    );
  }
}
