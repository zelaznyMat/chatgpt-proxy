import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Brak parametru message" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",    // <-- tu zmiana
      messages: [{ role: "user", content: message }]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });
  } catch (e) {
    console.error("OpenAI error:", e);
    return res.status(500).json({ error: "Błąd podczas kontaktu z OpenAI" });
  }
}
