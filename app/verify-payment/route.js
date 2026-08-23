import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
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

    // Razorpay signature verification
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Find selected PDF
    const selectedPdf = pdfs.find((pdf) => pdf.id === pdfId);

    if (!selectedPdf) {
      return NextResponse.json(
        { error: 'Selected PDF not found' },
        { status: 404 }
      );
    }

    // Read selected PDF
    const pdfPath = path.join(
      process.cwd(),
      'Public',
      selectedPdf.file
    );

    const pdfBuffer = await readFile(pdfPath);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${selectedPdf.file}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Verification error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Verification failed',
      },
      { status: 500 }
    );
  }
}
