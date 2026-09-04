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
          error: 'Required payment information is missing.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // RAZORPAY SECRET
    // ==========================================

    const secret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      console.error(
        'RAZORPAY_KEY_SECRET is missing.'
      );

      return NextResponse.json(
        {
          error: 'Payment configuration error.',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // VERIFY PAYMENT SIGNATURE
    // ==========================================

    const generatedSignature =
      crypto
        .createHmac('sha256', secret)
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
          error: 'Payment verification failed.',
        },
        { status: 400 }
      );
    }

    const signatureValid =
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'utf8'),
        Buffer.from(razorpay_signature, 'utf8')
      );

    if (!signatureValid) {
      console.error(
        'Invalid Razorpay signature.'
      );

      return NextResponse.json(
        {
          error: 'Payment verification failed.',
        },
        { status: 400 }
      );
    }

    console.log(
      '✅ Razorpay payment verified:',
      razorpay_payment_id
    );

    // ==========================================
    // FIND PDF
    // ==========================================

    const selectedPdf =
      pdfs.find(
        (pdf) =>
          String(pdf.id) ===
          String(pdfId)
      );

    if (!selectedPdf) {
      console.error(
        'PDF not found:',
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
    // SECURITY
    // ==========================================

    if (
      fileName.includes('..') ||
      fileName.includes('\\') ||
      path.isAbsolute(fileName)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid PDF file path.',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // PDF PATH
    // ==========================================

    const filePath = path.join(
      process.cwd(),
      'public',
      fileName
    );

    console.log(
      'PDF PATH:',
      filePath
    );

    // ==========================================
    // CHECK FILE
    // ==========================================

    if (!fs.existsSync(filePath)) {
      console.error(
        'PDF FILE NOT FOUND:',
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
          error: 'PDF file is empty.',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // CHECK PDF
    // ==========================================

    const header =
      fileBuffer
        .subarray(0, 4)
        .toString('ascii');

    if (header !== '%PDF') {
      console.error(
        'Invalid PDF header:',
        header
      );

      return NextResponse.json(
        {
          error:
            'Selected file is not a valid PDF.',
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ PDF READY: ${fileName} (${fileBuffer.length} bytes)`
    );

    // ==========================================
    // RETURN PDF
    // ==========================================

    return new NextResponse(
      new Uint8Array(fileBuffer),
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/pdf',

          // IMPORTANT:
          // inline = browserలో PDF open అవుతుంది
          'Content-Disposition':
            `inline; filename="${path.basename(fileName)}"`,

          'Content-Length':
            String(fileBuffer.length),

          'Cache-Control':
            'no-store, no-cache, must-revalidate',

          'Pragma':
            'no-cache',

          'Expires':
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
