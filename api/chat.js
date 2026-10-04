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

    // قراءة مفتاح Gemini من متغيرات Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Vercel."
      });
    }

    // إرسال الطلب إلى Gemini
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
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
                text:
                  "أنت واصل AI، مساعد ذكاء اصطناعي عربي. " +
                  "أجب باللغة العربية بشكل واضح ومفيد، " +
                  "ويمكنك استخدام المصطلحات الإنجليزية عند الحاجة."
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

    // إذا Gemini أعاد خطأ
    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "حدث خطأ من Gemini."
      });
    }

    // استخراج الرد
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini لم يُرجع ردًا."
      });
    }

    // إرسال الرد إلى واجهة واصل AI
    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ في الخادم."
    });
  }
}
