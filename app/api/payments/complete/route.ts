import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_qKymij0Xv8Nr@ep-restless-sea-a1g120hh-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DB_URL);
const PI_API_KEY = process.env.PI_API_KEY || "5bgasd6qkquvljhzyenudcuxuy1rflpavnafhyykynbegecosyuwuziseh2u2peb";

// Server-side payment completion — called by Pi SDK onReadyForServerCompletion
export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();
    if (!paymentId || !txid) {
      return NextResponse.json({ error: "Missing paymentId or txid" }, { status: 400 });
    }

    // Complete payment via Pi Platform API
    const piResponse = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    if (!piResponse.ok) {
      const err = await piResponse.text();
      console.error("[PiCity] Pi API complete failed:", err);
    }

    // Record the completed payment in DB (create table if needed)
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_id TEXT UNIQUE NOT NULL,
        txid TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      INSERT INTO payments (payment_id, txid)
      VALUES (${paymentId}, ${txid})
      ON CONFLICT (payment_id) DO UPDATE SET txid = ${txid}
    `;

    console.log("[PiCity] Payment completed:", paymentId, txid);
    return NextResponse.json({ completed: true, paymentId, txid });
  } catch (err) {
    console.error("[PiCity] Payment completion error:", err);
    return NextResponse.json({ error: "Completion failed" }, { status: 500 });
  }
}
