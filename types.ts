
export interface VideoData {
  url: string;
  name: string;
  type: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
