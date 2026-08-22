import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // సిగ్నేచర్ వెరిఫికేషన్
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // నిజమైన PDF జనరేట్ చేసే కోడ్ ఇక్కడ రాయండి
    // ఇప్పుడు కేవలం డమ్మీ PDF రెస్పాన్స్ ఇస్తున్నా (మీరు తర్వాత మార్చుకోవచ్చు)
    const pdfBuffer = Buffer.from('PDF content placeholder', 'utf-8');
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt_${razorpay_payment_id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
