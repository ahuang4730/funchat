import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { system, messages, characterName, replyTarget } = body;

    if (
      !system ||
      !Array.isArray(messages) ||
      !characterName ||
      !replyTarget ||
      !replyTarget.sender ||
      typeof replyTarget.text !== "string" ||
      typeof replyTarget.isUser !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid request data" },
        { status: 400 }
      );
    }

    const finalInstruction =
      replyTarget.sender === "System"
        ? `Important: You are ${characterName}.\n` +
          `You are not replying to a visible user message.\n` +
          `Use the recent chat as context and continue the current conversation naturally.\n` +
          `If there is an active topic, stay on that topic.\n` +
          `Only introduce a new topic if the conversation clearly feels finished.\n` +
          `Write only ${characterName}'s next single chat reply.\n` +
          `Do not include your name at the start.\n` +
          `Do not write dialogue for anyone else.\n` +
          `Do not narrate actions.`
        : `Important: You are ${characterName}.\n` +
          `You are replying specifically to this message:\n` +
          `Speaker: ${replyTarget.sender}\n` +
          `Type: ${replyTarget.isUser ? "user" : "character"}\n` +
          `Message: ${replyTarget.text}\n\n` +
          `Treat earlier messages as background context only.\n` +
          `Do not assume unrelated background messages were directed at you.\n` +
          `Reply mainly to the target message above.\n` +
          `Write only ${characterName}'s next single chat reply.\n` +
          `Do not include your name at the start.\n` +
          `Do not write dialogue for anyone else.\n` +
          `Do not narrate actions.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          ...messages,
          {
            role: "user",
            content: finalInstruction,
          },
        ],
        temperature: 0.5,
        max_tokens: 120,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("OpenAI API error:", data);
      return NextResponse.json(
        {
          error: data?.error?.message || "OpenAI request failed",
          details: data,
        },
        { status: r.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Route error:", err);
    return NextResponse.json(
      { error: "Server request failed" },
      { status: 500 }
    );
  }
}