export default async function handler(req, res) {
try {
if (req.method !== "POST") {
return res.status(405).json({ error: "Method Not Allowed" });
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  return res.status(500).json({
    error: "GEMINI_API_KEY غير موجود في Vercel."
  });
}

const body = req.body || {};
const text = String(body.text || "").trim();
const fileData = body.fileData || null;
const mimeType = String(body.mimeType || "");

if (!text && !fileData) {
  return res.status(400).json({
    error: "اكتب رسالة أو أرفق ملفًا."
  });
}

const imageKeywords = [
  "جيب لي صورة",
  "جيب صورة",
  "هات لي صورة",
  "هات صورة",
  "اعمل لي صورة",
  "اعمل صورة",
  "أعمل لي صورة",
  "أعمل صورة",
  "انشئ صورة",
  "أنشئ صورة",
  "إنشاء صورة",
  "انشاء صورة",
  "اصنع صورة",
  "أصنع صورة",
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
  imageKeywords.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

if (wantsImage) {
  return await generateImage(
    res,
    apiKey,
    text,
    fileData,
    mimeType
  );
}

const parts = [];

if (fileData) {
  const cleanBase64 = fileData.includes(",")
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
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },

    body: JSON.stringify({
      system_instruction: {
        parts: [
          {
            text:
              "أنت واصل AI، مساعد ذكاء اصطناعي عربي متعدد الوسائط. " +
              "أجب باللغة العربية بوضوح ودقة. " +
              "إذا أرسل المستخدم صورة فحللها واقرأ النصوص الظاهرة فيها. " +
              "إذا أرسل فيديو فحلل محتواه ومشاهده. " +
              "إذا أرسل ملفًا صوتيًا فحلل محتواه والكلام الموجود فيه. " +
              "إذا أرسل PDF فاقرأ محتواه واشرحه ولخصه حسب طلبه. " +
              "لا تدّع أنك رأيت أو سمعت شيئًا غير موجود في الملف."
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

const raw = await response.text();

let data;

try {
  data = JSON.parse(raw);
} catch {
  return res.status(502).json({
    error: "Gemini أعاد استجابة غير مفهومة."
  });
}

if (!response.ok) {
  return res.status(response.status).json({
    error:
      data?.error?.message ||
      "حدث خطأ من Gemini."
  });
}

const reply =
  data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
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
return "حلل هذه الصورة بالتفصيل.";
}

if (mimeType.startsWith("video/")) {
return "حلل هذا الفيديو واشرح أهم ما يحدث فيه.";
}

if (mimeType.startsWith("audio/")) {
return "حلل هذا الملف الصوتي واشرح محتواه.";
}

if (mimeType === "application/pdf") {
return "اقرأ هذا الملف PDF واشرح محتواه وأهم المعلومات فيه.";
}

return "حلل الملف المرفق.";
}

async function generateImage(
res,
apiKey,
text,
fileData,
mimeType
) {
try {
const input = [];

if (
  fileData &&
  mimeType &&
  mimeType.startsWith("image/")
) {
  const cleanBase64 = fileData.includes(",")
    ? fileData.split(",")[1]
    : fileData;

  input.push({
    type: "image",
    mime_type: mimeType,
    data: cleanBase64
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
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },

    body: JSON.stringify({
      model: "gemini-3.1-flash-image",

      input,

      response_format: {
        type: "image",
        aspect_ratio: "1:1",
        image_size: "1K"
      }
    })
  }
);

const raw = await response.text();

let data;

try {
  data = JSON.parse(raw);
} catch {
  return res.status(502).json({
    error: "خدمة توليد الصور أعادت استجابة غير مفهومة."
  });
}

if (!response.ok) {
  return res.status(response.status).json({
    error:
      data?.error?.message ||
      "تعذر إنشاء الصورة."
  });
}

let image = null;
let generatedText = "";

if (data?.output_image?.data) {
  const imageMime =
    data.output_image.mime_type ||
    "image/png";

  image =
    `data:${imageMime};base64,${data.output_image.data}`;
}

if (!image && Array.isArray(data?.steps)) {
  for (const step of data.steps) {
    if (step?.type !== "model_output") {
      continue;
    }

    for (const block of step.content || []) {
      if (
        block?.type === "image" &&
        block?.data
      ) {
        const imageMime =
          block.mime_type ||
          "image/png";

        image =
          `data:${imageMime};base64,${block.data}`;
      }

      if (
        block?.type === "text" &&
        block?.text
      ) {
        generatedText += block.text;
      }
    }
  }
}

if (!image) {
  return res.status(500).json({
    error: "Gemini لم يُرجع صورة."
  });
}

return res.status(200).json({
  type: "image",
  image,
  reply: generatedText
});

} catch (error) {
console.error("IMAGE ERROR:", error);

return res.status(500).json({
  error:
    error?.message ||
    "حدث خطأ أثناء إنشاء الصورة."
});

}
    }
