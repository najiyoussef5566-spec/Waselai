import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // السماح فقط بطلبات POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const text = String(req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({
        error: "الرسالة فارغة."
      });
    }

    // قراءة مفتاح Gemini من Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في إعدادات Vercel."
      });
    }

    // الاتصال بـ Gemini
    const ai = new GoogleGenAI({
      apiKey: apiKey
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction:
          "أنت واصل AI، مساعد ذكاء اصطناعي عربي. أجب باللغة العربية بشكل واضح ومفيد. استخدم المصطلحات الإنجليزية عند الحاجة."
      }
    });

    const reply = response.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini لم يُرجع نصًا."
      });
    }

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console
