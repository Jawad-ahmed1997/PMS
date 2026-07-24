import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Use the Auth.js credentials callback." }, { status: 410 });
}
