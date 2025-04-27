import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Tylko POST dozwolone
  }

  const { message } = req.body;

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4", // lub gpt-3.5-turbo jeśli wolisz
      messages: [{ role: "user", content: message }]
    });

    res.status(200).json({ reply: 
completion.data.choices[0].message.content });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Coś poszło nie tak." });
  }
}

