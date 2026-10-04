import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY is missing.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.post("/api/chat", async (req, res) => {
    try {
        const text = String(req.body?.text || "").trim();

        if (!text) {
            return res.status(400).json({
                error: "الرسالة فارغة."
            });
        }

        if (!ai) {
            return res.status(500).json({
                error: "مفتاح Gemini غير مضبوط في الخادم."
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: text,
            config: {
                systemInstruction:
                    "أنت واصل AI، مساعد ذكاء اصطناعي عربي. أجب باللغة العربية بشكل واضح ومفيد، ويمكنك استخدام المصطلحات الإنجليزية عند الحاجة."
            }
        });

        const reply = response.text || "لم يتم الحصول على رد.";

        res.json({ reply });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "حدث خطأ أثناء الاتصال بـ Gemini."
        });
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Wasel AI running on port ${PORT}`);
});
