import { NextResponse } from "next/server";
import { pdfs } from "../../pdfs";

export async function POST(request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          error: "Razorpay keys are missing",
          keyIdPresent: !!keyId,
          keySecretPresent: !!keySecret,
        },
        { status: 500 }
      );
    }

    // Get selected PDF
    const body = await request.json();
    const { pdfId } = body;

    if (!pdfId) {
      return NextResponse.json(
        {
          error: "PDF ID is required",
        },
        { status: 400 }
      );
    }

    // Find PDF from server-side list
    const selectedPdf = pdfs.find(
      (pdf) => pdf.id === pdfId
    );

    if (!selectedPdf) {
      return NextResponse.json(
        {
          error: "Invalid PDF selected",
        },
        { status: 400 }
      );
    }

    // Fixed price: ₹99
    const amount = 9900;

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

    const response = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },

        body: JSON.stringify({
          amount: amount,
          currency: "INR",
          receipt: `receipt_${Date.now()}`,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Razorpay Order API error",
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      pdfId: selectedPdf.id,
      pdfName: selectedPdf.name,
    });

  } catch (error) {
    console.error("Create order error:", error);

    return NextResponse.json(
      {
        error: "Server error",
        details:
          error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
