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

    /*
     * الكلمات التي تدل على أن المستخدم يريد إنشاء صورة
     */
    const imageKeywords = [
      "انشئ صورة",
      "أنشئ صورة",
      "انشاء صورة",
      "إنشاء صورة",
      "اصنع صورة",
      "أصنع صورة",
      "اعمل صورة",
      "أعمل صورة",
      "صورة ل",
      "صوره ل",
      "ارسم لي",
      "أرسم لي",
      "ارسم",
      "أرسم",
      "صمم لي صورة",
      "صمّم لي صورة",
      "صمم صورة",
      "صمّم صورة",
      "ولّد صورة",
      "ولد صورة",
      "توليد صورة",
      "generate image",
      "create image",
      "make an image",
      "draw"
    ];

    const wantsImage = imageKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    /*
     * ==========================================
     * إنشاء صورة
     * ==========================================
     */

    if (wantsImage) {
      const imageResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
        {
          method: "POST",

          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      "Create the requested image. " +
                      "Follow the user's description accurately. " +
                      "Generate a high-quality image. " +
                      "User request: " +
                      text
                  }
                ]
              }
            ],

            generationConfig: {
              responseModalities: ["IMAGE"]
            }
          })
        }
      );

      const imageData = await imageResponse.json();

      if (!imageResponse.ok) {
        console.error("Gemini Image Error:", imageData);

        return res.status(imageResponse.status).json({
          error:
            imageData?.error?.message ||
            "حدث خطأ أثناء إنشاء الصورة."
        });
      }

      const parts =
        imageData?.candidates?.[0]?.content?.parts || [];

      const imagePart = parts.find(
        (part) => part?.inlineData?.data
      );

      if (!imagePart) {
        return res.status(500).json({
          error: "Gemini لم يُرجع صورة."
        });
      }

      const mimeType =
        imagePart.inlineData.mimeType ||
        "image/png";

      const base64Image =
        imagePart.inlineData.data;

      return res.status(200).json({
        type: "image",
        image: `data:${mimeType};base64,${base64Image}`
      });
    }

    /*
     * ==========================================
     * المحادثة النصية العادية
     * ==========================================
     */

    const model = "gemini-3.8-flash";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
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
                  "أجب باللغة العربية بشكل واضح ومفيد. " +
                  "يمكنك استخدام المصطلحات الإنجليزية عند الحاجة."
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
      type: "text",
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
