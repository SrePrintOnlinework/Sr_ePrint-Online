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

    // ==================================================
    // 1. CHECK PAYMENT DETAILS
    // ==================================================

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

    // ==================================================
    // 2. RAZORPAY ENVIRONMENT VARIABLES
    // ==================================================

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay environment variables missing.');

      return NextResponse.json(
        {
          success: false,
          error:
            'Razorpay keys are missing in Vercel Environment Variables.',
        },
        { status: 500 }
      );
    }

    // ==================================================
    // 3. FIND SELECTED PDF
    // ==================================================

    const selectedPdf = pdfs.find(
      (pdf) =>
        String(pdf.id) === String(pdfId)
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

    // ==================================================
    // 4. CHECK PRICE
    // ==================================================

    const price = Number(selectedPdf.price);

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PDF price.',
        },
        { status: 500 }
      );
    }

    const expectedAmount =
      Math.round(price * 100);

    // ==================================================
    // 5. VERIFY RAZORPAY SIGNATURE
    // ==================================================

    const signatureString =
      `${razorpay_order_id}|${razorpay_payment_id}`;

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          keySecret
        )
        .update(signatureString)
        .digest('hex');

    if (
      typeof razorpay_signature !== 'string' ||
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

    const signatureValid =
      crypto.timingSafeEqual(
        Buffer.from(
          generatedSignature,
          'utf8'
        ),
        Buffer.from(
          razorpay_signature,
          'utf8'
        )
      );

    if (!signatureValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Razorpay signature verification failed.',
        },
        { status: 400 }
      );
    }

    // ==================================================
    // 6. RAZORPAY API AUTH
    // ==================================================

    const auth =
      Buffer.from(
        `${keyId}:${keySecret}`
      ).toString('base64');

    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    // ==================================================
    // 7. GET RAZORPAY ORDER
    // ==================================================

    const orderResponse =
      await fetch(
        `https://api.razorpay.com/v1/orders/${encodeURIComponent(
          razorpay_order_id
        )}`,
        {
          method: 'GET',
          headers,
          cache: 'no-store',
        }
      );

    const orderText =
      await orderResponse.text();

    let orderData;

    try {
      orderData =
        JSON.parse(orderText);
    } catch {
      console.error(
        'Razorpay order response:',
        orderText
      );

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

    // ==================================================
    // 8. VERIFY ORDER AMOUNT
    // ==================================================

    if (
      Number(orderData.amount) !==
      expectedAmount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Order amount mismatch. Expected ₹${price}, ` +
            `but Razorpay order amount is ₹${
              Number(orderData.amount) / 100
            }.`,
        },
        { status: 400 }
      );
    }

    // ==================================================
    // 9. VERIFY PDF ID FROM ORDER NOTES
    // ==================================================

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

    // ==================================================
    // 10. GET RAZORPAY PAYMENT
    // ==================================================

    const paymentResponse =
      await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(
          razorpay_payment_id
        )}`,
        {
          method: 'GET',
          headers,
          cache: 'no-store',
        }
      );

    const paymentText =
      await paymentResponse.text();

    let paymentData;

    try {
      paymentData =
        JSON.parse(paymentText);
    } catch {
      console.error(
        'Razorpay payment response:',
        paymentText
      );

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

    // ==================================================
    // 11. VERIFY PAYMENT ORDER
    // ==================================================

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

    // ==================================================
    // 12. VERIFY PAYMENT AMOUNT
    // ==================================================

    if (
      Number(paymentData.amount) !==
      expectedAmount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Payment amount mismatch. Expected ₹${price}.`,
        },
        { status: 400 }
      );
    }

    // ==================================================
    // 13. VERIFY PAYMENT CAPTURED
    // ==================================================

    if (
      paymentData.status !==
      'captured'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Payment is not captured. Current status: ${paymentData.status}`,
        },
        { status: 400 }
      );
    }

    // ==================================================
    // 14. VERIFY ORDER PAID
    // ==================================================

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

    // ==================================================
    // 15. VALIDATE PDF FILENAME
    // ==================================================

    const fileName =
      String(
        selectedPdf.file || ''
      ).trim();

    if (
      !fileName ||
      !fileName
        .toLowerCase()
        .endsWith('.pdf') ||
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      path.isAbsolute(fileName)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid PDF filename.',
        },
        { status: 400 }
      );
    }

    // ==================================================
    // 16. PDF PATH
    // ==================================================

    const publicDirectory =
      path.join(
        process.cwd(),
        'public'
      );

    const pdfPath =
      path.join(
        publicDirectory,
        fileName
      );

    console.log(
      '================================='
    );

    console.log(
      'PDF DOWNLOAD DEBUG'
    );

    console.log(
      'PDF ID:',
      selectedPdf.id
    );

    console.log(
      'PDF NAME:',
      selectedPdf.name
    );

    console.log(
      'PDF FILE:',
      fileName
    );

    console.log(
      'PDF PATH:',
      pdfPath
    );

    console.log(
      'PDF EXISTS:',
      fs.existsSync(pdfPath)
    );

    console.log(
      '================================='
    );

    // ==================================================
    // 17. CHECK PDF EXISTS
    // ==================================================

    if (
      !fs.existsSync(pdfPath)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `PDF file not found on server: ${fileName}`,

          fileName,

          expectedPath:
            pdfPath,
        },
        { status: 404 }
      );
    }

    // ==================================================
    // 18. READ PDF
    // ==================================================

    let fileBuffer;

    try {
      fileBuffer =
        fs.readFileSync(
          pdfPath
        );
    } catch (fileError) {
      console.error(
        'PDF READ ERROR:',
        fileError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            `Unable to read PDF file: ${fileName}`,

          details:
            fileError?.message,
        },
        { status: 500 }
      );
    }

    // ==================================================
    // 19. CHECK FILE SIZE
    // ==================================================

    if (
      !fileBuffer ||
      fileBuffer.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'PDF file is empty.',
        },
        { status: 500 }
      );
    }

    // ==================================================
    // 20. RETURN PDF
    // ==================================================

    console.log(
      'PDF READ SUCCESS:',
      fileName,
      fileBuffer.length,
      'bytes'
    );

    return new NextResponse(
      new Uint8Array(fileBuffer),
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/pdf',

          'Content-Disposition':
            `attachment; filename="${fileName}"`,

          'Content-Length':
            String(
              fileBuffer.length
            ),

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
        success: false,

        error:
          error?.message ||
          'Payment verification failed.',
      },
      { status: 500 }
    );
  }
}
