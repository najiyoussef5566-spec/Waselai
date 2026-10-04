export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Vercel."
      });
    }

    const body = req.body || {};

    const text = String(body.text || "").trim();

    const fileData = body.fileData || null;
    const fileName = String(body.fileName || "");
    const mimeType = String(body.mimeType || "");

    if (!text && !fileData) {
      return res.status(400).json({
        error: "اكتب رسالة أو أرفق ملفًا."
      });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",

      "video/mp4",
      "video/mpeg",
      "video/mov",
      "video/avi",
      "video/x-msvideo",
      "video/webm",

      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/flac",

      "application/pdf"
    ];

    if (fileData && !allowedTypes.includes(mimeType)) {
      return res.status(400).json({
        error: "نوع الملف غير مدعوم: " + mimeType
      });
    }

    const imageKeywords = [
      "انشئ صورة",
      "أنشئ صورة",
      "إنشاء صورة",
      "انشاء صورة",
      "اصنع صورة",
      "أصنع صورة",
      "اعمل صورة",
      "أعمل صورة",
      "ارسم لي",
      "أرسم لي",
      "ارسم",
      "أرسم",
      "صمم لي صورة",
      "صمّم لي صورة",
      "صمم صورة",
      "صمّم صورة",
      "ولد صورة",
      "ولّد صورة",
      "توليد صورة",
      "generate image",
      "create image",
      "make an image",
      "draw an image"
    ];

    const lowerText = text.toLowerCase();

    const wantsImage =
      imageKeywords.some((keyword) =>
        lowerText.includes(keyword.toLowerCase())
      );

    if (wantsImage) {
      return await generateImage({
        res,
        apiKey,
        text,
        fileData,
        mimeType
      });
    }

    const parts = [];

    if (fileData) {
      const cleanBase64 =
        fileData.includes(",")
          ? fileData.split(",")[1]
          : fileData;

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanBase64
        }
      });
    }

    parts.push({
      text:
        text ||
        getDefaultInstruction(mimeType)
    });

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
                  "أنت واصل AI، مساعد ذكاء اصطناعي عربي متعدد الوسائط. " +
                  "حلل الملفات المرفقة بدقة وأجب باللغة العربية. " +
                  "إذا كانت صورة فحلل محتواها واقرأ النصوص الظاهرة فيها. " +
                  "إذا كان فيديو فحلل مشاهده ومحتواه وأجب عن الأسئلة المتعلقة به. " +
                  "إذا كان صوتًا فحلل الكلام والمحتوى الصوتي. " +
                  "إذا كان PDF فاقرأ محتواه واشرحه ولخصه حسب طلب المستخدم. " +
                  "لا تدّع أنك رأيت أو سمعت شيئًا غير موجود في الملف. " +
                  "إذا كان السؤال يحتاج معلومات غير واضحة، وضح ذلك."
              }
            ]
          },

          contents: [
            {
              role: "user",
              parts
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "حدث خطأ من Gemini."
      });
    }

    const reply =
      data?.candidates?.[0]
        ?.content?.parts
        ?.map((part) => part.text || "")
        .filter(Boolean)
        .join("\n")
        .trim();

    if (!reply) {
      return res.status(500).json({
        error: "Gemini لم يُرجع ردًا مفهومًا."
      });
    }

    return res.status(200).json({
      type: "text",
      reply
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ غير متوقع."
    });
  }
}


function getDefaultInstruction(mimeType) {

  if (mimeType.startsWith("image/")) {
    return "حلل هذه الصورة بالتفصيل واشرح لي ما يظهر فيها.";
  }

  if (mimeType.startsWith("video/")) {
    return "حلل هذا الفيديو واشرح أهم ما يحدث فيه بالتفصيل.";
  }

  if (mimeType.startsWith("audio/")) {
    return "حلل هذا الملف الصوتي واذكر محتواه والكلام المهم فيه.";
  }

  if (mimeType === "application/pdf") {
    return "اقرأ هذا الملف PDF واشرح محتواه وأهم المعلومات الموجودة فيه.";
  }

  return "حلل الملف المرفق.";
}


async function generateImage({
  res,
  apiKey,
  text,
  fileData,
  mimeType
}) {

  try {

    const input = [];

    if (
      fileData &&
      mimeType.startsWith("image/")
    ) {

      const cleanBase64 =
        fileData.includes(",")
          ? fileData.split(",")[1]
          : fileData;

      input.push({
        type: "image",
        data: cleanBase64,
        mime_type: mimeType
      });
    }

    input.push({
      type: "text",
      text:
        text ||
        "أنشئ صورة عالية الجودة."
    });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          model:
            "gemini-3.1-flash-image",

          input,

          response_format: {
            type: "image",
            aspect_ratio: "1:1",
            image_size: "1K"
          }

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.error(
        "Image generation error:",
        data
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "تعذر إنشاء الصورة."
      });
    }

    let image = null;
    let generatedText = "";

    if (data?.output_image?.data) {

      image =
        "data:image/png;base64," +
        data.output_image.data;
    }

    if (!image && Array.isArray(data.steps)) {

      for (const step of data.steps) {

        if (step?.type !== "model_output") {
          continue;
        }

        const content =
          step.content || [];

        for (const block of content) {

          if (
            block?.type === "image" &&
            block?.data
          ) {

            const mime =
              block.mime_type ||
              "image/png";

            image =
              `data:${mime};base64,${block.data}`;
          }

          if (
            block?.type === "text" &&
            block?.text
          ) {

            generatedText +=
              block.text;
          }
        }
      }
    }

    if (!image) {

      return res.status(500).json({
        error:
          "Gemini لم يُرجع صورة."
      });
    }

    return res.status(200).json({

      type: "image",

      image,

      reply:
        generatedText || ""

    });

  } catch (error) {

    console.error(
      "IMAGE ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ أثناء إنشاء الصورة."
    });
  }
}

بعد اللصق اضغط Commit changes.

لا تعدّل "index.html" الآن.
لما تخلص من "chat.js" قل لي تم، وأعطيك الملف الثاني "index.html" كامل.
