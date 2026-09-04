import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { pdfs } from '../pdfs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // ==========================================
    // READ REQUEST
    // ==========================================

    const body = await request.json();
    const pdfId = body?.pdfId;

    if (!pdfId) {
      return NextResponse.json(
        {
          success: false,
          error: 'PDF ID is required',
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
    // ENV VARIABLES
    // ==========================================

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('Razorpay environment variables are missing');

      return NextResponse.json(
        {
          success: false,
          error: 'Razorpay configuration is missing',
        },
        { status: 500 }
      );
    }

    // ==========================================
    // PRICE
    // ==========================================

    const amount = Math.round(Number(selectedPdf.price) * 100);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PDF price',
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CREATE RAZORPAY ORDER
    // ==========================================

    const receipt = `pdf_${selectedPdf.id}_${Date.now()}`;

    const orderData = {
      amount,
      currency: 'INR',
      receipt,
      notes: {
        pdfId: selectedPdf.id,
        pdfName: selectedPdf.name,
        pdfFile: selectedPdf.file,
      },
    };

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const razorpayResponse = await fetch(
      'https://api.razorpay.com/v1/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
        cache: 'no-store',
      }
    );

    const razorpayData = await razorpayResponse.json();

    // ==========================================
    // RAZORPAY ERROR
    // ==========================================

    if (!razorpayResponse.ok) {
      console.error('Razorpay order error:', razorpayData);

      return NextResponse.json(
        {
          success: false,
          error:
            razorpayData?.error?.description ||
            'Failed to create Razorpay order',
        },
        { status: razorpayResponse.status }
      );
    }

    // ==========================================
    // SUCCESS
    // ==========================================

    return NextResponse.json({
      success: true,

      orderId: razorpayData.id,

      amount: razorpayData.amount,

      currency: razorpayData.currency,

      keyId,

      pdfId: selectedPdf.id,

      pdfName: selectedPdf.name,
    });
  } catch (error) {
    console.error('Create order error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to create payment order',
      },
      { status: 500 }
    );
  }
}
