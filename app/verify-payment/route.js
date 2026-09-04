import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pdfs } from '../pdfs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // ==========================================
    // READ REQUEST
    // ==========================================

    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      pdfId,
    } = body;

    // ==========================================
    // CHECK REQUIRED DATA
    // ==========================================

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !pdfId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment verification data is incomplete',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // FIND PDF
    // ==========================================

    const selectedPdf = pdfs.find((pdf) => pdf.id === pdfId);

    if (!selectedPdf) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF not found',
        },
        { status: 404 }
      );
    }

    // ==========================================
    // RAZORPAY SECRET
    // ==========================================

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error('RAZORPAY_KEY_SECRET is missing');

      return NextResponse.json(
        {
          success: false,
          error: 'Payment configuration error',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // VERIFY SIGNATURE
    // ==========================================

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    const signatureBuffer = Buffer.from(generatedSignature);
    const receivedBuffer = Buffer.from(razorpay_signature);

    if (
      signatureBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(
        signatureBuffer,
        receivedBuffer
      )
    ) {
      console.error('Invalid Razorpay signature');

      return NextResponse.json(
        {
          success: false,
          error: 'Payment verification failed',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // PDF PATH
    // ==========================================

    const pdfPath = path.join(
      process.cwd(),
      'public',
      selectedPdf.file
    );

    console.log('PDF path:', pdfPath);

    // ==========================================
    // CHECK FILE EXISTS
    // ==========================================

    if (!fs.existsSync(pdfPath)) {
      console.error('PDF file does not exist:', pdfPath);

      return NextResponse.json(
        {
          success: false,
          error: `PDF file not found: ${selectedPdf.file}`,
        },
        { status: 404 }
      );
    }

    // ==========================================
    // READ PDF
    // ==========================================

    const pdfBuffer = fs.readFileSync(pdfPath);

    // ==========================================
    // SAFE DOWNLOAD NAME
    // ==========================================

    const safeFileName =
      selectedPdf.name
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_+/g, '_') + '.pdf';

    // ==========================================
    // RETURN PDF
    // ==========================================

    return new Response(pdfBuffer, {
      status: 200,

      headers: {
        'Content-Type': 'application/pdf',

        'Content-Disposition': `attachment; filename="${safeFileName}"`,

        'Content-Length': String(pdfBuffer.length),

        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',

        Pragma: 'no-cache',

        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Payment received, but PDF download failed',
      },
      { status: 500 }
    );
  }
}
