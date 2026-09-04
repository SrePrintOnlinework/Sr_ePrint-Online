import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pdfs } from '../pdfs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body =
      await request.json();

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

    if (!secret) {
      console.error(
        'RAZORPAY_KEY_SECRET is missing.'
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
    // VERIFY SIGNATURE
    // ==========================================

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          secret
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');

    let signatureValid = false;

    try {
      const generatedBuffer =
        Buffer.from(
          generatedSignature,
          'hex'
        );

      const receivedBuffer =
        Buffer.from(
          razorpay_signature,
          'hex'
        );

      if (
        generatedBuffer.length ===
        receivedBuffer.length
      ) {
        signatureValid =
          crypto.timingSafeEqual(
            generatedBuffer,
            receivedBuffer
          );
      }
    } catch (error) {
      signatureValid = false;
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
      'Razorpay signature verified successfully.'
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

    // ==========================================
    // FILE NAME
    // ==========================================

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

    // ==========================================
    // SECURITY CHECK
    // ==========================================

    if (
      fileName.includes('..') ||
      fileName.includes('\\') ||
      path.isAbsolute(fileName)
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

    console.log(
      'PDF path:',
      filePath
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
