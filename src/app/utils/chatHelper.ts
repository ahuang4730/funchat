import { Character, Message } from "../types/chat";

/* short preview for the reply box */
export function makePreview(text: string) {
  const clean = text.trim();

  if (clean.length <= 35) return clean;

  return clean.slice(0, 35) + "...";
}

/* clean weird AI formatting before showing it */
export function cleanAiText(text: string, charName: string) {
  let cleaned = text.trim();

  const ownNameAtStart = new RegExp(`^${charName}\\s*:\\s*`, "i");
  cleaned = cleaned.replace(ownNameAtStart, "");

  cleaned = cleaned.replace(/\*[^*]+\*/g, "").trim();

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length > 0) {
    cleaned = lines[0];
  }

  cleaned = cleaned.replace(/^[A-Za-z0-9_ -]+\s*:\s*/i, "").trim();

  return cleaned;
}

/* check if a character name is mentioned */
export function isMentioned(charName: string, text: string) {
  return text.toLowerCase().includes(charName.toLowerCase());
}

/* get all online characters who were mentioned */
export function getMentionedCharacters(
  onlineChars: Character[],
  target: Message
) {
  return onlineChars.filter((char) => isMentioned(char.name, target.text));
}

/* simple fallback score */
export function getCharacterReplyScore(
  char: Character,
  lastSpeaker: string | null
) {
  let score = char.responseChance * 10;

  if (lastSpeaker === char.name) {
    score -= 5;
  }

  return score;
}

/* send only recent background chat */
export function getRecentHistory(messages: Message[]) {
  const recentMessages = messages.slice(-6);

  return recentMessages.map((m) => ({
    role: "user",
    content:
      `Background chat message\n` +
      `Speaker: ${m.sender}\n` +
      `Type: ${m.isUser ? "user" : "character"}\n` +
      `Message: ${m.text}`,
  }));
}