export interface Message {
    role: "user" | "assistant";
    content: string;
}

export interface AIConfig {
    introduction: string;
    tone: string;
    creativity: number; // 0 (Precise) to 1 (Creative)
}

export interface GeneratedFile {
    file_id: string;
    filename: string;
}

export interface ChatSession {
    id: string;
    title: string;
    date: string;
}

export interface Persona {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
}
