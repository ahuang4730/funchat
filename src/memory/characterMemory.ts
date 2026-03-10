// src/memory/characterMemory.ts

export type CharacterMemory = {
  self: string[];
  others: Record<string, string[]>;
  user: string[];
};

// --- initialize memory for each character ---
export function initMemories(characterNames: string[]): Record<string, CharacterMemory> {
  const initial: Record<string, CharacterMemory> = {};
  characterNames.forEach((name) => {
    initial[name] = { self: [], others: {}, user: [] };
  });
  return initial;
}

// --- load memories from localStorage ---
export function loadMemories(characterNames: string[]): Record<string, CharacterMemory> {
  try {
    const saved = localStorage.getItem("characterMemories");
    if (saved) {
      return JSON.parse(saved);
    } else {
      const initial = initMemories(characterNames);
      localStorage.setItem("characterMemories", JSON.stringify(initial));
      return initial;
    }
  } catch {
    return initMemories(characterNames);
  }
}

// --- save updated memories ---
export function saveMemories(memories: Record<string, CharacterMemory>) {
  localStorage.setItem("characterMemories", JSON.stringify(memories));
}

// --- add a memory snippet ---
export function addMemory(
  memories: Record<string, CharacterMemory>,
  charName: string,
  snippet: string,
  type: "self" | "user" = "self"
): Record<string, CharacterMemory> {
  const updated = { ...memories };
  const charMemory = { ...(memories[charName] || { self: [], others: {}, user: [] }) };

  if (type === "self") {
    charMemory.self.push(snippet);
  } else {
    charMemory.user.push(snippet);
  }

  updated[charName] = charMemory;
  saveMemories(updated);
  return updated;
}
