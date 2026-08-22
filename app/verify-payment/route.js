import { NextResponse } from 'next/server';
import crypto from 'crypto';
// PDF generate కోసం (ఉదా: @react-pdf/renderer లేదా pdf-lib). ఇక్కడ simple buffer example ఇస్తున్నా.
import { PDFDocument, rgb } from 'pdf-lib';

export async function POST(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    // 1. Signature Verification (ఇది ముఖ్యమైన భద్రతా స్టెప్)
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 2. Signature correctే కాబట్టి, PDF generate చేద్దాం.
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const { width, height } = page.getSize();
    page.drawText('Payment Successful!', {
      x: 50,
      y: height - 100,
      size: 30,
      color: rgb(0, 0.5, 0),
    });
    page.drawText(`Order ID: ${razorpay_order_id}`, { x: 50, y: height - 150, size: 16 });
    page.drawText(`Payment ID: ${razorpay_payment_id}`, { x: 50, y: height - 180, size: 16 });
    page.drawText('Thank you for your purchase of ₹99!', { x: 50, y: height - 230, size: 18 });

    const pdfBytes = await pdfDoc.save();

    // 3. PDF ని Download చేసేలా Response ఇవ్వడం
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt_${razorpay_payment_id}.pdf"`,
      },
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
