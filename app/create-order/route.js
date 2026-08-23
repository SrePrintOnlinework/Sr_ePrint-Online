import { NextResponse } from "next/server";

export async function POST() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  return NextResponse.json({
    keyIdPresent: !!keyId,
    keySecretPresent: !!keySecret,
    keyIdLength: keyId ? keyId.length : 0,
    keySecretLength: keySecret ? keySecret.length : 0,
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
