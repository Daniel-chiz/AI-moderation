const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { marked } = require("marked");
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const AI_MODEL = "mistralai/mistral-7b-instruct";

const BLOCKED_TERMS = ["kill", "murder", "hack", "bomb", "attack"];

function hasBannedWord(text) {
  return BLOCKED_TERMS.some((word) => text.toLowerCase().includes(word));
}

function redactBannedWords(text) {
  let moderated = text;
  BLOCKED_TERMS.forEach((word) => {
    const regex = new RegExp(word, "gi");
    moderated = moderated.replace(regex, "[REDACTED]");
  });
  return moderated;
}

let chatHistory = [];

app.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }

    if (hasBannedWord(prompt)) {
      return res.json({
        reply: "Your input violated the moderation policy.",
      });
    }

    chatHistory.push({ role: "user", content: prompt });

    const SYSTEM_MESSAGE = `You are a safe and helpful AI assistant.
Always be polite, avoid any harmful, violent, or illegal content.`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: AI_MODEL,
        messages: [{ role: "system", content: SYSTEM_MESSAGE }, ...chatHistory],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let aiReply = response.data.choices[0].message.content;

    if (hasBannedWord(aiReply)) {
      aiReply = redactBannedWords(aiReply);
    }

    const formattedReply = marked(aiReply);

    chatHistory.push({ role: "assistant", content: aiReply });

    res.json({ reply: formattedReply });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      error: "Server error or failed API request",
      details: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});