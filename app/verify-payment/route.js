import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pdfs } from '../pdfs';

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      pdfId,
    } = body;

    // -----------------------------
    // CHECK REQUIRED DATA
    // -----------------------------

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

    // -----------------------------
    // RAZORPAY SECRET
    // -----------------------------

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

    // -----------------------------
    // VERIFY SIGNATURE
    // -----------------------------

    const generatedSignature =
      crypto
        .createHmac('sha256', secret)
        .update(
          razorpay_order_id +
            '|' +
            razorpay_payment_id
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

    // -----------------------------
    // FIND PDF
    // -----------------------------

    const selectedPdf =
      pdfs.find(
        (pdf) =>
          String(pdf.id) === String(pdfId)
      );

    if (!selectedPdf) {
      console.error(
        'PDF not found:',
        pdfId
      );

      return NextResponse.json(
        {
          error:
            'Selected PDF was not found.',
        },
        { status: 404 }
      );
    }

    // -----------------------------
    // PDF FILE PATH
    // -----------------------------

    const fileName =
      selectedPdf.file;

    const filePath =
      path.join(
        process.cwd(),
        'public',
        fileName
      );

    console.log(
      'PDF path:',
      filePath
    );

    // -----------------------------
    // CHECK FILE EXISTS
    // -----------------------------

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
            'PDF file is not available on the server.',
        },
        { status: 404 }
      );
    }

    // -----------------------------
    // READ PDF
    // -----------------------------

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

    // -----------------------------
    // RETURN PDF
    // -----------------------------

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
            'no-store, no-cache, must-revalidate',
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
          'Payment verification or PDF delivery failed.',
      },
      { status: 500 }
    );
  }
}
