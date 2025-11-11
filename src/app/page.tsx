"use client";
import { useState } from "react";

// import all character profiles
import { Chenjin } from "../characters/chenjin";
import { Ibi } from "../characters/ibi";
import { Lingjue } from "../characters/lingjue";
import { Ruoan } from "../characters/ruoan";
import { Yunfei } from "../characters/yunfei";
import { Zihan } from "../characters/zihan";

type Message = {
  sender: string;
  text: string;
  avatar: string;
  isUser: boolean;
};

type Character = {
  name: string;
  avatar: string;
  system: string;
  delayRange: number[];
  onlineChance: number;
};


export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // list of all characters
  const characters: Character[] = [Chenjin, Ibi, Lingjue, Ruoan, Yunfei, Zihan];


  async function sendMessage() {
    if (!input.trim()) return;

    // user message
    const userMessage: Message = {
      sender: "You",
      text: input,
      avatar: "/avatars/user.png",
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userText = input;
    setInput("");

    // pick a random character for now
    const char = characters[Math.floor(Math.random() * characters.length)];

    try {
      // recent chat history
      const chatHistory = messages
        .slice(-10)
        .map((m) => ({
          role: m.isUser ? "user" : "assistant",
          content: m.text,
        }));
      chatHistory.push({ role: "user", content: userText });

      // send to AI
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: char.system,
          messages: chatHistory,
        }),
      });

      const data = await res.json();
      const aiText =
        data.choices?.[0]?.message?.content?.trim() ||
        `(${char.name} is silent...)`;

      // AI message
      const aiMessage: Message = {
        sender: char.name,
        text: aiText,
        avatar: char.avatar,
        isUser: false,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        sender: "System",
        text: "⚠️ Something went wrong talking to the AI.",
        avatar: "/avatars/chenjin.jpg",
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-100 text-gray-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${
              m.isUser ? "justify-end" : "justify-start"
            }`}
          >
            {!m.isUser && (
              <img
                src={m.avatar}
                alt={m.sender}
                className="w-10 h-10 rounded-full border border-gray-300"
              />
            )}
            <div
              className={`p-2 rounded-lg shadow-sm max-w-[70%] ${
                m.isUser ? "bg-blue-500 text-white" : "bg-white text-gray-800"
              }`}
            >
              {!m.isUser && (
                <div className="font-semibold text-sm mb-1">{m.sender}</div>
              )}
              <div>{m.text}</div>
            </div>
            {m.isUser && (
              <img
                src={m.avatar}
                alt="You"
                className="w-10 h-10 rounded-full border border-gray-300"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex p-4 bg-white border-t border-gray-300">
        <input
          className="flex-1 border border-gray-400 rounded px-3 py-2 mr-2"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </main>
  );
}
