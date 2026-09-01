import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COOKIE_NAME = 'payment_history_auth';

function createToken(password) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  return crypto
    .createHmac('sha256', secret)
    .update(password)
    .digest('hex');
}

function isAuthenticated(request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const password = process.env.PAYMENT_HISTORY_PASSWORD;

  if (!keySecret || !password) {
    return false;
  }

  const cookie = request.cookies.get(COOKIE_NAME);

  if (!cookie?.value) {
    return false;
  }

  const expectedToken = createToken(password);

  const receivedBuffer = Buffer.from(
    cookie.value,
    'utf8'
  );

  const expectedBuffer = Buffer.from(
    expectedToken,
    'utf8'
  );

  if (
    receivedBuffer.length !== expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

// ------------------------------------
// LOGIN
// ------------------------------------

export async function POST(request) {
  try {
    const body = await request.json();

    const password = body?.password;

    const correctPassword =
      process.env.PAYMENT_HISTORY_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json(
        {
          error:
            'PAYMENT_HISTORY_PASSWORD is not configured',
        },
        { status: 500 }
      );
    }

    if (!password || password !== correctPassword) {
      return NextResponse.json(
        {
          error: 'Invalid password',
        },
        { status: 401 }
      );
    }

    const token = createToken(correctPassword);

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;

  } catch (error) {
    console.error(
      'Payment history login error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Login failed',
      },
      { status: 500 }
    );
  }
}

// ------------------------------------
// PAYMENT HISTORY
// ------------------------------------

export async function GET(request) {
  try {
    // Check login
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const keyId =
      process.env.RAZORPAY_KEY_ID;

    const keySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error: 'Razorpay keys are missing',
        },
        { status: 500 }
      );
    }

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString('base64');

    // Get latest 100 payments
    const razorpayResponse = await fetch(
      'https://api.razorpay.com/v1/payments?count=100',
      {
        method: 'GET',

        headers: {
          Authorization: `Basic ${auth}`,
        },

        cache: 'no-store',
      }
    );

    const data =
      await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      console.error(
        'Razorpay payment history error:',
        data
      );

      return NextResponse.json(
        {
          error:
            data?.error?.description ||
            'Unable to fetch payment history',
        },
        { status: 400 }
      );
    }

    const payments = (data.items || []).map(
      (payment) => ({
        id: payment.id,

        orderId:
          payment.order_id || '-',

        amount:
          payment.amount / 100,

        currency:
          payment.currency,

        status:
          payment.status,

        method:
          payment.method || '-',

        email:
          payment.email || '-',

        contact:
          payment.contact || '-',

        createdAt:
          payment.created_at,

      })
    );

    return NextResponse.json({
      success: true,
      count: payments.length,
      payments,
    });

  } catch (error) {
    console.error(
      'Payment history error:',
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

// ------------------------------------
// LOGOUT
// ------------------------------------

export async function DELETE(request) {
  const response = NextResponse.json({
    success: true,
  });

  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  return response;
}
