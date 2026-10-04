import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "مفتاح Gemini غير موجود في Vercel."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: text,
      config: {
        systemInstruction:
          "أنت واصل AI، مساعد ذكاء اصطناعي عربي. أجب باللغة العربية بشكل واضح ومفيد، ويمكنك استخدام المصطلحات الإنجليزية عند الحاجة."
      }
    });

    return res.status(200).json({
      reply: response.text || "لم يتم الحصول على رد."
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "حدث خطأ أثناء الاتصال بـ Gemini."
    });
  }
  }
