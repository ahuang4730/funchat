"use client";

import { useState, useEffect, useRef } from "react";

import { characters } from "./data/characters";
import { Character, Message } from "./types/chat";
import {
  makePreview,
  cleanAiText,
  getRecentHistory,
  getMentionedCharacters,
  getCharacterReplyScore,
} from "./utils/chatHelper";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typingChars, setTypingChars] = useState<string[]>([]);
  const [onlineStatuses, setOnlineStatuses] = useState<{
    [key: string]: string;
  }>({});
  const [lastActivity, setLastActivity] = useState(Date.now());

  /* Keeps the conversation going for a few extra replies after someone talks */
  const energyRef = useRef(0);

  /* Stores who spoke last so the same character is less likely to go again */
  const lastSpeakerRef = useRef<string | null>(null);

  /* Timer used for idle chatter when the room is quiet */
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Holds the latest messages so delayed replies still read fresh chat history */
  const messagesRef = useRef<Message[]>([]);

  /* Used to auto-scroll to the bottom of the chat */
  const bottomRef = useRef<HTMLDivElement | null>(null);

  /* Keep the ref updated with the newest messages */
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* Auto-scroll whenever messages or typing text changes */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingChars]);

  /* Decide who starts online or offline when the page loads */
  useEffect(() => {
    const statuses: { [key: string]: string } = {};

    characters.forEach((c) => {
      statuses[c.name] = Math.random() < c.onlineChance ? "online" : "offline";
    });

    /* Make sure at least one character is online */
    const onlineCount = Object.values(statuses).filter(
      (status) => status === "online"
    ).length;

    if (onlineCount === 0) {
      const randomChar =
        characters[Math.floor(Math.random() * characters.length)];
      statuses[randomChar.name] = "online";
    }

    setOnlineStatuses(statuses);
  }, []);

  /* Sends the user's message into the room */
  function sendMessage() {
    if (!input.trim()) return;

    const msg: Message = {
      sender: "You",
      text: input.trim(),
      avatar: "/avatars/user.png",
      isUser: true,
    };

    setMessages((prev) => [...prev, msg]);
    setInput("");
    setLastActivity(Date.now());

    /* Give the room momentum so more than one reply can happen */
    energyRef.current = 3;

    triggerBotConversation(msg);
  }

  /* Picks which character should reply next */
  function triggerBotConversation(targetMessage: Message) {
    if (energyRef.current <= 0) return;

    const online = characters.filter(
      (c) => onlineStatuses[c.name] === "online"
    );

    if (online.length === 0) return;

    /* If any online character is named directly, prioritize them */
    const mentioned = getMentionedCharacters(online, targetMessage);

    if (mentioned.length === 1) {
      scheduleReply(mentioned[0], targetMessage);
      return;
    }

    if (mentioned.length > 1) {
      const chosen =
        mentioned[Math.floor(Math.random() * mentioned.length)];
      scheduleReply(chosen, targetMessage);
      return;
    }

    /* Otherwise score characters and pick from the best few */
    const scoredCharacters = online.map((char) => ({
      char,
      score: getCharacterReplyScore(char, lastSpeakerRef.current),
    }));

    scoredCharacters.sort((a, b) => b.score - a.score);

    const topChoices = scoredCharacters.slice(
      0,
      Math.min(3, scoredCharacters.length)
    );

    const totalScore = topChoices.reduce(
      (sum, item) => sum + Math.max(item.score, 1),
      0
    );

    let roll = Math.random() * totalScore;
    let chosenChar = topChoices[0].char;

    for (const item of topChoices) {
      roll -= Math.max(item.score, 1);

      if (roll <= 0) {
        chosenChar = item.char;
        break;
      }
    }

    scheduleReply(chosenChar, targetMessage);
  }

  /* Makes one chosen character reply after their delay time */
  function scheduleReply(char: Character, target: Message) {
    const minDelay = char.delayRange[0];
    const maxDelay = char.delayRange[1];

    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    /* Show typing a little before the actual message appears */
    const typingStartDelay = Math.min(1200, delay * 500);

    setTimeout(() => {
      setTypingChars((prev) =>
        prev.includes(char.name) ? prev : [...prev, char.name]
      );
    }, typingStartDelay);

    setTimeout(async () => {
      try {
        /* Send recent background context only */
        const history = getRecentHistory(messagesRef.current);

        const res = await fetch("/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: char.system,
            messages: history,
            characterName: char.name,
            replyTarget: {
              sender: target.sender,
              text: target.text,
              isUser: target.isUser,
            },
          }),
        });

        const raw = await res.text();

        if (!res.ok) {
          console.error("API error:", raw);
          return;
        }

        let data: any = {};

        try {
          data = JSON.parse(raw);
        } catch (error) {
          console.error("Could not read API response:", raw);
          return;
        }

        /* Try a few possible places the reply text could be stored */
        const rawAiText =
          data.choices?.[0]?.message?.content?.trim() ||
          data.message?.content?.trim() ||
          data.reply?.trim() ||
          data.text?.trim() ||
          "";

        if (!rawAiText) {
          console.error("No reply text found:", data);
          return;
        }

        /* Clean weird formatting like "Ruoan:" or action text */
        const aiText = cleanAiText(rawAiText, char.name);

        if (!aiText) {
          console.error("Reply became empty after cleanup:", rawAiText);
          return;
        }

        const aiMessage: Message = {
          sender: char.name,
          text: aiText,
          avatar: char.avatar,
          isUser: false,
          replyTo:
            target.sender === "System"
              ? undefined
              : {
                  sender: target.sender,
                  text: target.text,
                  preview: makePreview(target.text),
                },
        };

        setMessages((prev) => [...prev, aiMessage]);
        lastSpeakerRef.current = char.name;
        setLastActivity(Date.now());

        /* Spend one point of conversation momentum */
        energyRef.current--;

        /* Let the room continue naturally for a bit */
        if (energyRef.current > 0) {
          setTimeout(() => triggerBotConversation(aiMessage), 2500);
        }
      } catch (error) {
        console.error("Reply failed:", error);
      } finally {
        setTypingChars((prev) => prev.filter((name) => name !== char.name));
      }
    }, delay * 1000);
  }

  /* If nobody talks for a while, let a character continue the current topic */
  useEffect(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      const online = characters.filter(
        (c) => onlineStatuses[c.name] === "online"
      );

      if (online.length === 0) return;

      const char = online[Math.floor(Math.random() * online.length)];

      const idlePrompt: Message = {
        sender: "System",
        text: "Continue the current conversation naturally. If there is an active topic, stay on it. Only introduce something new if the conversation has clearly gone quiet or run out of steam.",
        avatar: "",
        isUser: false,
      };

      scheduleReply(char, idlePrompt);
    }, Math.random() * 45000 + 30000);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [lastActivity, onlineStatuses]);

  return (
    <main className="h-screen w-screen flex bg-gray-100 overflow-hidden">
      <div className="flex flex-col flex-1">
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
                  className="w-10 h-10 rounded-full border"
                />
              )}

              <div
                className={`p-2 rounded-lg shadow max-w-[70%] ${
                  m.isUser ? "bg-blue-500 text-white" : "bg-white text-black"
                }`}
              >
                {!m.isUser && (
                  <div className="font-semibold text-sm mb-1">{m.sender}</div>
                )}

                {m.replyTo && (
                  <div className="text-xs text-gray-500 border-l pl-2 mb-1 truncate">
                    Replying to {m.replyTo.sender}: {m.replyTo.preview}
                  </div>
                )}

                <div>{m.text}</div>
              </div>

              {m.isUser && (
                <img
                  src={m.avatar}
                  alt="You"
                  className="w-10 h-10 rounded-full border"
                />
              )}
            </div>
          ))}

          {typingChars.length > 0 && (
            <div className="text-gray-500 italic text-sm">
              {typingChars.length === 1
                ? `${typingChars[0]} is typing...`
                : typingChars.length === 2
                ? `${typingChars[0]} and ${typingChars[1]} are typing...`
                : "Multiple people are typing..."}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t bg-white text-black">
          <div className="flex">
            <input
              className="flex-1 border rounded px-3 py-2 mr-2 text-black placeholder-gray-500 bg-white"
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

      <div className="w-56 border-l bg-white text-black overflow-y-auto">
        <div className="font-semibold p-2 text-black">Characters</div>

        {characters.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-2 px-2 py-1 text-sm text-black"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                onlineStatuses[c.name] === "online"
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
            />

            <img
              src={c.avatar}
              alt={c.name}
              className="w-6 h-6 rounded-full border"
            />

            {c.name}
          </div>
        ))}
      </div>
    </main>
  );
}