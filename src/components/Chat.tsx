"use client";

import { useState } from "react";

export type ChatMessage = {
  id: string;
  username: string;
  message: string;
  correct?: boolean;
};

type ChatProps = {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  disabled?: boolean;
};

export default function Chat({
  messages,
  onSend,
  disabled = false,
}: ChatProps) {
  const [message, setMessage] = useState("");

  function sendMessage() {
    const value = message.trim();

    if (!value || disabled) {
      return;
    }

    onSend(value);
    setMessage("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h2 className="font-bold text-gray-900">Guesses</h2>
        <p className="text-xs text-gray-400">Guess what is being drawn</p>
      </div>

      <div className="flex min-h-[250px] flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-gray-400">
            No guesses yet.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-xl border px-3 py-2 text-sm ${
                message.correct
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-100 bg-gray-50 text-gray-700"
              }`}
            >
              <span className="font-semibold text-gray-900">
                {message.username}
              </span>

              <span className="mx-1 text-gray-400">:</span>

              <span>{message.message}</span>

              {message.correct && (
                <span className="ml-2 font-bold text-green-600">✓</span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <div className="flex gap-2">
          <input
            value={message}
            disabled={disabled}
            maxLength={100}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? "You are drawing..." : "Enter your guess..."
            }
            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-gray-100"
          />

          <button
            onClick={sendMessage}
            disabled={disabled || !message.trim()}
            className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}