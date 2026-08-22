import { NextResponse } from 'next/server';

export async function POST() {
  // ఇది టెస్ట్ రెస్పాన్స్ మాత్రమే - Razorpay అవసరం లేదు
  return NextResponse.json({ orderId: 'test_order_12345' });
}

// ఈ లైన్ Vercel కి ఇది డైనమిక్ API అని చెప్తుంది
export const dynamic = 'force-dynamic';
