import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Use the Auth.js signout flow." }, { status: 410 });
}
