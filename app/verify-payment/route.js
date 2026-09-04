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

    // ==============================
    // CHECK PAYMENT DATA
    // ==============================

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

    // ==============================
    // RAZORPAY SECRET
    // ==============================

    const secret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      console.error(
        'RAZORPAY_KEY_SECRET is missing'
      );

      return NextResponse.json(
        {
          error:
            'Payment configuration error.',
        },
        { status: 500 }
      );
    }

    // ==============================
    // VERIFY RAZORPAY SIGNATURE
    // ==============================

    const generatedSignature =
      crypto
        .createHmac('sha256', secret)
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');

    if (
      generatedSignature !==
      razorpay_signature
    ) {
      console.error(
        'Invalid Razorpay signature'
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
      'Payment signature verified successfully.'
    );

    // ==============================
    // FIND PDF
    // ==============================

    const selectedPdf =
      pdfs.find(
        (pdf) =>
          String(pdf.id) ===
          String(pdfId)
      );

    if (!selectedPdf) {
      console.error(
        'PDF not found in pdfs.js:',
        pdfId
      );

      return NextResponse.json(
        {
          error:
            `Selected PDF was not found. PDF ID: ${pdfId}`,
        },
        { status: 404 }
      );
    }

    console.log(
      'Selected PDF:',
      selectedPdf
    );

    // ==============================
    // CHECK FILE NAME
    // ==============================

    const fileName =
      selectedPdf.file;

    if (!fileName) {
      console.error(
        'PDF file name is missing:',
        selectedPdf
      );

      return NextResponse.json(
        {
          error:
            'PDF file name is missing in pdfs.js.',
        },
        { status: 500 }
      );
    }

    // ==============================
    // FILE PATH
    // ==============================

    const filePath =
      path.join(
        process.cwd(),
        'public',
        fileName
      );

    console.log(
      'PDF file path:',
      filePath
    );

    // ==============================
    // CHECK FILE
    // ==============================

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

    // ==============================
    // READ PDF
    // ==============================

    const fileBuffer =
      fs.readFileSync(filePath);

    if (
      !fileBuffer ||
      fileBuffer.length === 0
    ) {
      console.error(
        'PDF file is empty:',
        filePath
      );

      return NextResponse.json(
        {
          error:
            'PDF file is empty.',
        },
        { status: 500 }
      );
    }

    console.log(
      `PDF loaded successfully. Size: ${fileBuffer.length} bytes`
    );

    // ==============================
    // RETURN PDF
    // ==============================

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

          Pragma:
            'no-cache',

          Expires:
            '0',
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
