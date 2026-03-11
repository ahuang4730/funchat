export type Message = {
  sender: string;
  text: string;
  avatar: string;
  isUser: boolean;
  replyTo?: {
    sender: string;
    text: string;
    preview: string;
  };
};

export type Character = {
  name: string;
  avatar: string;
  system: string;
  delayRange: number[];
  onlineChance: number;
  responseChance: number;
  mentionBoost: number;
};