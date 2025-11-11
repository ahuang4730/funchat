import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { system, messages } = await request.json();

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",       // small & inexpensive model
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
        temperature: 0.9,
        max_tokens: 120,
      }),
    });

    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
