import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { PDFDocument, rgb } from 'pdf-lib';

export async function POST(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const { height } = page.getSize();

    page.drawText('📄 ePrint Online - Payment Receipt', {
      x: 50,
      y: height - 80,
      size: 22,
      color: rgb(0.1, 0.45, 0.91),
    });
    page.drawText(`✅ Payment Successful!`, {
      x: 50,
      y: height - 140,
      size: 26,
      color: rgb(0, 0.6, 0.2),
    });
    page.drawText(`Order ID: ${razorpay_order_id}`, {
      x: 50,
      y: height - 190,
      size: 16,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(`Payment ID: ${razorpay_payment_id}`, {
      x: 50,
      y: height - 220,
      size: 16,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(`Amount: ₹99`, {
      x: 50,
      y: height - 260,
      size: 18,
      color: rgb(0.8, 0.2, 0.1),
    });
    page.drawText(`Downloaded on: ${new Date().toLocaleString()}`, {
      x: 50,
      y: height - 310,
      size: 12,
      color: rgb(0.4, 0.4, 0.4),
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt_${razorpay_payment_id}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
