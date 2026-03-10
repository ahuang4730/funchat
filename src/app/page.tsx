"use client";
import { useState, useEffect, useRef } from "react";

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
  replyTo?: { sender: string; text: string };
};

type Character = {
  name: string;
  avatar: string;
  system: string;
  delayRange: number[];
  onlineChance: number;
  responseChance: number;
  mentionBoost: number;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typingChars, setTypingChars] = useState<string[]>([]);
  const [onlineStatuses, setOnlineStatuses] = useState<{ [key: string]: string }>({});
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [lastBotReply, setLastBotReply] = useState(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const characters: Character[] = [Chenjin, Ibi, Lingjue, Ruoan, Yunfei, Zihan];

  // --- assign online statuses once ---
  if (Object.keys(onlineStatuses).length === 0) {
    const newStatuses: { [key: string]: string } = {};
    characters.forEach((char) => {
      newStatuses[char.name] =
        Math.random() < char.onlineChance ? "online" : "offline";
    });
    setOnlineStatuses(newStatuses);
  }

  function refreshActivity() {
    setLastActivity(Date.now());
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }

  // --- USER sends message ---
  async function sendMessage() {
    if (!input.trim()) return;

    refreshActivity();

    const userMessage: Message = {
      sender: "You",
      text: input,
      avatar: "/avatars/user.png",
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userText = input;
    setInput("");

    // 🟢 only ONE bot will directly respond to user
    await triggerSingleBotReply(userMessage);
  }

  // --- main: only one bot replies directly to user ---
  async function triggerSingleBotReply(targetMessage: Message) {
    const onlineChars = characters.filter(
      (c) => onlineStatuses[c.name] === "online"
    );
    if (onlineChars.length === 0) return;

    const chosenChar =
      onlineChars[Math.floor(Math.random() * onlineChars.length)];

    await triggerBotReply(chosenChar, targetMessage, true);
  }

  // --- helper: one bot generates a reply ---
  async function triggerBotReply(char: Character, targetMessage: Message, fromUser = false) {
    const now = Date.now();
    if (!fromUser && now - lastBotReply < 10000 + Math.random() * 10000) return;

    const mentioned = targetMessage.text
      .toLowerCase()
      .includes(char.name.toLowerCase());

    let chance = char.responseChance;
    if (mentioned) chance = Math.min(1, chance * char.mentionBoost);
    if (fromUser) chance += 0.2;

    if (Math.random() > chance && !fromUser) return;

    const delay =
      Math.floor(Math.random() * (char.delayRange[1] - char.delayRange[0])) +
      char.delayRange[0];

    // add 1–3s grace before typing indicator
    const typingDelay = Math.floor(Math.random() * 2000) + 1000;

    setTimeout(() => {
      setTypingChars((prev) =>
        prev.includes(char.name) ? prev : [...prev, char.name]
      );
    }, typingDelay);

    await new Promise((r) => setTimeout(r, delay * 1000));

    try {
      const chatHistory = messages.slice(-10).map((m) => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text,
      }));
      chatHistory.push({
        role: targetMessage.isUser ? "user" : "assistant",
        content: targetMessage.text,
      });

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
        `(${char.name} stays silent...)`;

      const aiMessage: Message = {
        sender: char.name,
        text: aiText,
        avatar: char.avatar,
        isUser: false,
        replyTo: { sender: targetMessage.sender, text: targetMessage.text },
      };

      setMessages((prev) => [...prev, aiMessage]);
      setLastBotReply(Date.now());
    } catch (err) {
      console.error(err);
    } finally {
      setTypingChars((prev) => prev.filter((n) => n !== char.name));
    }
  }

  // --- effect: bots respond to other bots slowly ---
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg.isUser) {
      // other bots may respond (but staggered)
      const others = characters.filter(
        (c) =>
          c.name !== lastMsg.sender && onlineStatuses[c.name] === "online"
      );
      if (others.length === 0) return;

      const responder =
        others[Math.floor(Math.random() * others.length)];

      triggerBotReply(responder, lastMsg);
    }
  }, [messages]);

  // --- idle chatter after silence ---
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      triggerIdleMessage();
    }, Math.random() * 60000 + 30000);
  }, [lastActivity]);

  async function triggerIdleMessage() {
    const onlineChars = characters.filter(
      (c) => onlineStatuses[c.name] === "online"
    );
    if (onlineChars.length === 0) return;

    const randomChar =
      onlineChars[Math.floor(Math.random() * onlineChars.length)];

    try {
      const chatHistory = messages.slice(-10).map((m) => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text,
      }));

      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: randomChar.system,
          messages: chatHistory,
        }),
      });

      const data = await res.json();
      const aiText =
        data.choices?.[0]?.message?.content?.trim() ||
        `(${randomChar.name} hums idly...)`;

      const idleMessage: Message = {
        sender: randomChar.name,
        text: aiText,
        avatar: randomChar.avatar,
        isUser: false,
      };

      setMessages((prev) => [...prev, idleMessage]);
      setLastBotReply(Date.now());
      refreshActivity();
    } catch (err) {
      console.error(err);
    }
  }

  // --- layout ---
  return (
    <main className="h-screen w-screen flex bg-gray-100 text-gray-800 overflow-hidden">
      {/* Left: Chat Section */}
      <div className="flex flex-col flex-1 h-full">
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
                {m.replyTo && (
                  <div className="text-xs text-gray-500 border-l-2 border-gray-300 pl-2 mb-1 italic">
                    Replying to {m.replyTo.sender}: "
                    {m.replyTo.text.slice(0, 60)}"
                  </div>
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

          {typingChars.length > 0 && (
            <div className="text-gray-500 italic text-sm pl-4">
              {typingChars.length === 1
                ? `${typingChars[0]} is typing...`
                : typingChars.length === 2
                ? `${typingChars[0]} and ${typingChars[1]} are typing...`
                : `Multiple people are typing...`}
            </div>
          )}
        </div>

        <div className="flex-none p-4 bg-white border-t border-gray-300">
          <div className="flex">
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
        </div>
      </div>

      {/* Right: Sidebar */}
      <div className="w-56 flex-none border-l border-gray-300 bg-white h-full overflow-y-auto">
        <div className="font-semibold mb-2 text-gray-700 p-2">Online</div>
        {characters.map((char) => (
          <div
            key={char.name}
            className="flex items-center gap-2 mb-2 text-sm text-gray-700 px-2"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                onlineStatuses[char.name] === "online"
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
            ></div>
            <img
              src={char.avatar}
              alt={char.name}
              className="w-6 h-6 rounded-full border border-gray-300"
            />
            <span>{char.name}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
