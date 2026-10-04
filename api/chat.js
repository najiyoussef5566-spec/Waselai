
export default async function handler(req, res) {
  // السماح بطلبات POST فقط
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const text = String(req.body?.text || "").trim();

    // التحقق من الرسالة
    if (!text) {
      return res.status(400).json({
        error: "الرسالة فارغة."
      });
    }

    // قراءة مفتاح Gemini من Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Vercel."
      });
    }

    // الموديل المستخدم
    const model = "gemini-3.8-flash";

    // عدد المحاولات عند وجود ضغط مؤقت
    const maxAttempts = 3;

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      try {
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
                      "كن دقيقًا ومختصرًا عند الحاجة، " +
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

        // إذا نجح الطلب
        if (response.ok) {

          const reply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (reply) {
            return res.status(200).json({
              reply: reply
            });
          }

          return res.status(500).json({
            error: "Gemini لم يُرجع ردًا."
          });
        }

        // حفظ الخطأ
        lastError =
          data?.error?.message ||
          "حدث خطأ من Gemini.";

        console.error(
          `Gemini attempt ${attempt}:`,
          lastError
        );

        /*
         * إذا كان الخطأ بسبب الضغط أو تجاوز الحد،
         * ننتظر قليلًا ثم نحاول مرة أخرى.
         */
        const errorText = lastError.toLowerCase();

        const temporaryError =
          response.status === 429 ||
          response.status === 500 ||
          response.status === 503 ||
          errorText.includes("high demand") ||
          errorText.includes("temporarily") ||
          errorText.includes("overloaded") ||
          errorText.includes("unavailable");

        // إذا لم يكن الخطأ مؤقتًا، نوقف المحاولات
        if (!temporaryError) {
          return res.status(response.status).json({
            error: lastError
          });
        }

        // إذا بقيت محاولات، انتظر قبل المحاولة التالية
        if (attempt < maxAttempts) {

          const waitTime = attempt * 2000;

          await new Promise((resolve) =>
            setTimeout(resolve, waitTime)
          );
        }

      } catch (error) {

        lastError =
          error?.message ||
          "حدث خطأ أثناء الاتصال بـ Gemini.";

        console.error(
          `Connection attempt ${attempt}:`,
          lastError
        );

        // إعادة المحاولة إذا بقيت محاولات
        if (attempt < maxAttempts) {

          const waitTime = attempt * 2000;

          await new Promise((resolve) =>
            setTimeout(resolve, waitTime)
          );
        }
      }
    }

    // فشلت جميع المحاولات
    return res.status(503).json({
      error:
        "Gemini مشغول حاليًا بسبب ارتفاع الطلب. " +
        "حاول مرة أخرى بعد قليل.\n\n" +
        lastError
    });

  } catch (error) {

    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ غير متوقع في الخادم."
    });
  }
        }
