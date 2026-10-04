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
        error: "GEMINI_API_KEY غير موجود في Vercel."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: "أنت واصل AI، مساعد ذكاء اصطناعي عربي. أجب باللغة العربية بشكل واضح ومفيد."
              }
            ]
          },
          contents: [
            {
              parts: [
                {
                  text: text
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "حدث خطأ من Gemini."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini لم يُرجع ردًا."
      });
    }

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error: error?.message || "حدث خطأ في الخادم."
    });
  }
}
