import { NextResponse } from 'next/server';
import { pdfs } from '../pdfs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();

    const pdfId = body?.pdfId;

    if (!pdfId) {
      return NextResponse.json(
        {
          error: 'PDF ID is required',
        },
        { status: 400 }
      );
    }

    const selectedPdf = pdfs.find(
      (pdf) => pdf.id === pdfId
    );

    if (!selectedPdf) {
      return NextResponse.json(
        {
          error: 'Selected PDF not found',
        },
        { status: 404 }
      );
    }

    const keyId =
      process.env.RAZORPAY_KEY_ID;

    const keySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error:
            'Razorpay keys are missing',
        },
        { status: 500 }
      );
    }

    // ₹99 = 9900 paise
    const amount = 9900;

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString('base64');

    const response = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Basic ${auth}`,
        },

        body: JSON.stringify({
          amount: amount,
          currency: 'INR',
          receipt:
            `pdf_${selectedPdf.id}_${Date.now()}`,
        }),

        cache: 'no-store',
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        'Razorpay order error:',
        data
      );

      return NextResponse.json(
        {
          error:
            data?.error?.description ||
            'Failed to create Razorpay order',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
    });

  } catch (error) {
    console.error(
      'Create order error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Something went wrong',
      },
      { status: 500 }
    );
  }
}
