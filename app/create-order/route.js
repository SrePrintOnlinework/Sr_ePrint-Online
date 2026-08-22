import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request) {
  try {
    // 1. Razorpay instance సృష్టించండి
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 2. ఆర్డర్ ఆప్షన్స్ సెట్ చేయండి (మొత్తం 9900 పైసలు = ₹99)
    const options = {
      amount: 9900,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    // 3. Razorpay లో ఆర్డర్ క్రియేట్ చేయండి
    const order = await instance.orders.create(options);

    // 4. సక్సెస్ అయితే JSON లో orderId పంపండి
    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    // 5. ఎర్రర్ వస్తే కూడా JSON లోనే ఎర్రర్ మెసేజ్ పంపండి (HTML కాదు)
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
