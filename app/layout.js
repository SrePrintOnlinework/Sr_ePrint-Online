import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pdfs } from '../../pdfs';

export async function POST(request) {
  try {
    // ==========================================
    // GET REQUEST DATA
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
          error: 'Missing payment verification details.',
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // RAZORPAY SECRET
    // ==========================================

    const razorpaySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!razorpaySecret) {
      console.error(
        'RAZORPAY_KEY_SECRET is missing.'
      );

      return NextResponse.json(
        {
          error:
            'Payment server configuration error.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // CREATE EXPECTED SIGNATURE
    // ==========================================

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          razorpaySecret
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');

    // ==========================================
    // SAFE SIGNATURE COMPARISON
    // ==========================================

    const generatedBuffer =
      Buffer.from(
        generatedSignature,
        'utf8'
      );

    const receivedBuffer =
      Buffer.from(
        razorpay_signature,
        'utf8'
      );

    if (
      generatedBuffer.length !==
      receivedBuffer.length
    ) {
      console.error(
        'Invalid Razorpay signature length.'
      );

      return NextResponse.json(
        {
          error:
            'Payment verification failed.',
        },
        {
          status: 400,
        }
      );
    }

    const signatureIsValid =
      crypto.timingSafeEqual(
        generatedBuffer,
        receivedBuffer
      );

    // ==========================================
    // INVALID SIGNATURE
    // ==========================================

    if (!signatureIsValid) {
      console.error(
        'Invalid Razorpay payment signature.'
      );

      return NextResponse.json(
        {
          error:
            'Payment verification failed. Invalid signature.',
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      'Razorpay signature verified:',
      razorpay_payment_id
    );

    // ==========================================
    // FIND SELECTED PDF
    // ==========================================

    const selectedPdf = pdfs.find(
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
            'Requested PDF was not found.',
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================
    // CHECK PDF FILE
    // ==========================================

    if (!selectedPdf.file) {
      console.error(
        'PDF file is missing:',
        selectedPdf
      );

      return NextResponse.json(
        {
          error:
            'PDF file configuration is missing.',
        },
        {
          status: 500,
        }
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

    console.log(
      'PDF path:',
      pdfPath
    );

    // ==========================================
    // CHECK PDF EXISTS
    // ==========================================

    if (!fs.existsSync(pdfPath)) {
      console.error(
        'PDF file not found:',
        pdfPath
      );

      return NextResponse.json(
        {
          error:
            `PDF file "${selectedPdf.file}" was not found on the server.`,
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================
    // READ PDF
    // ==========================================

    const pdfBuffer =
      fs.readFileSync(pdfPath);

    if (
      !pdfBuffer ||
      pdfBuffer.length === 0
    ) {
      console.error(
        'PDF file is empty:',
        pdfPath
      );

      return NextResponse.json(
        {
          error:
            'PDF file is empty.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // CHECK PDF HEADER
    // ==========================================

    const pdfHeader =
      pdfBuffer
        .subarray(0, 4)
        .toString();

    if (pdfHeader !== '%PDF') {
      console.error(
        'Invalid PDF file:',
        pdfPath
      );

      return NextResponse.json(
        {
          error:
            'The selected file is not a valid PDF.',
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // SAFE FILE NAME
    // ==========================================

    const safeFileName =
      selectedPdf.name
        .replace(
          /[^a-zA-Z0-9-_]/g,
          '_'
        )
        .replace(
          /_+/g,
          '_'
        );

    const downloadFileName =
      `${safeFileName}.pdf`;

    // ==========================================
    // PAYMENT VERIFIED
    // ==========================================

    console.log(
      'Payment verified successfully:',
      {
        orderId:
          razorpay_order_id,

        paymentId:
          razorpay_payment_id,

        pdfId:
          selectedPdf.id,

        pdfName:
          selectedPdf.name,

        price:
          selectedPdf.price,
      }
    );

    // ==========================================
    // RETURN PDF
    // ==========================================

    return new NextResponse(
      pdfBuffer,
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/pdf',

          // Browser PDF viewerలో open అవుతుంది
          'Content-Disposition':
            `inline; filename="${downloadFileName}"`,

          'Content-Length':
            String(pdfBuffer.length),

          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',

          'Pragma':
            'no-cache',

          'Expires':
            '0',
        },
      }
    );
  } catch (error) {
    // ==========================================
    // GENERAL ERROR
    // ==========================================

    console.error(
      'VERIFY PAYMENT ERROR:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Internal server error during payment verification.',
      },
      {
        status: 500,
      }
    );
  }
}
