export default async function handler(req, res) {
try {
if (req.method !== "POST") {
return res.status(405).json({
error: "Method Not Allowed"
});
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  return res.status(500).json({
    error: "GEMINI_API_KEY غير موجود في Vercel."
  });
}

const body = req.body || {};
const text = String(body.text || "").trim();

if (!text) {
  return res.status(400).json({
    error: "اكتب رسالة."
  });
}

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
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

const raw = await response.text();

let data;

try {
  data = JSON.parse(raw);
} catch {
  console.error("Gemini returned non-JSON:", raw);

  return res.status(502).json({
    error: "Gemini أعاد استجابة غير مفهومة.",
    details: raw.substring(0, 500)
  });
}

if (!response.ok) {
  console.error("Gemini API error:", data);

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
  console.error("Empty Gemini response:", data);

  return res.status(500).json({
    error: "Gemini لم يُرجع نصًا."
  });
}

return res.status(200).json({
  type: "text",
  reply: reply
});

} catch (error) {
console.error("SERVER ERROR:", error);

return res.status(500).json({
  error: error?.message || "حدث خطأ في الخادم."
});

}
  }
