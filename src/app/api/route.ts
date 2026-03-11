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
        ? `Important: You are ${characterName}.
You are not replying to a visible user message.
Use the recent chat as background context and continue the current conversation naturally.
If there is an active topic, stay on that topic.
Only introduce a new topic if the conversation clearly feels finished.
Do not continue as if you are replying to your own previous message.
Do not act like you are having a conversation with yourself.
If your own earlier message appears in the background, treat it as context only, not as something to answer directly.
Write only ${characterName}'s next single chat reply.
Do not include your name at the start.
Do not write dialogue for anyone else.
Do not narrate actions.`
        : `Important: You are ${characterName}.
You are replying specifically to this message:
Speaker: ${replyTarget.sender}
Type: ${replyTarget.isUser ? "user" : "character"}
Message: ${replyTarget.text}

Treat earlier messages as background context only.
Do not assume unrelated background messages were directed at you.
Reply mainly to the target message above.
Write only ${characterName}'s next single chat reply.
Do not include your name at the start.
Do not write dialogue for anyone else.
Do not narrate actions.`;

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