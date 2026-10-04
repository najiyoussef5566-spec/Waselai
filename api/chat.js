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

    /*
    ==========================================
    التحقق
    ==========================================
    */

    if (!text && !fileData) {
      return res.status(400).json({
        error: "اكتب رسالة أو أرفق ملفًا."
      });
    }

    /*
    ==========================================
    أنواع الملفات المسموحة
    ==========================================
    */

    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",

      // Video
      "video/mp4",
      "video/mpeg",
      "video/mov",
      "video/avi",
      "video/x-msvideo",
      "video/webm",

      // Audio
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/flac",

      // PDF
      "application/pdf"
    ];

    if (fileData && !allowedTypes.includes(mimeType)) {
      return res.status(400).json({
        error:
          "نوع الملف غير مدعوم: " +
          mimeType
      });
    }

    /*
    ==========================================
    معرفة هل الطلب يريد إنشاء صورة
    ==========================================
    */

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
      "إنشاء صورة",
      "generate image",
      "create image",
      "make an image",
      "draw an image"
    ];

    const lowerText = text.toLowerCase();

    const wantsImage =
      imageKeywords.some((keyword) =>
        lowerText.includes(
          keyword.toLowerCase()
        )
      );

    /*
    ==========================================
    إذا كان المستخدم يريد إنشاء / تعديل صورة
    ==========================================
    */

    if (wantsImage) {
      return await generateImage({
        res,
        apiKey,
        text,
        fileData,
        mimeType
      });
    }

    /*
    ==========================================
    تحليل نص / صورة / فيديو / صوت / PDF
    ==========================================
    */

    const parts = [];

    /*
    إضافة الملف إذا وجد
    */

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

    /*
    إضافة تعليمات المستخدم
    */

    parts.push({
      text:
        text ||
        getDefaultInstruction(mimeType)
    });

    /*
    ==========================================
    طلب Gemini
    ==========================================
    */

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

    /*
    ==========================================
    معالجة خطأ Gemini
    ==========================================
    */

    if (!response.ok) {
      console.error(
        "Gemini error:",
        data
      );

      return res.status(
        response.status
      ).json({
        error:
          data?.error?.message ||
          "حدث خطأ من Gemini."
      });
    }

    /*
    ==========================================
    استخراج الرد
    ==========================================
    */

    const reply =
      data?.candidates?.[0]
        ?.content?.parts
        ?.map((part) => part.text || "")
        .filter(Boolean)
        .join("\n")
        .trim();

    if (!reply) {
      return res.status(500).json({
        error:
          "Gemini لم يُرجع ردًا مفهومًا."
      });
    }

    return res.status(200).json({
      type: "text",
      reply
    });

  } catch (error) {
    console.error(
      "SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ غير متوقع."
    });
  }
}


/*
==================================================
تعليمات افتراضية حسب نوع الملف
==================================================
*/

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


/*
==================================================
إنشاء / تعديل الصور
==================================================
*/

async function generateImage({
  res,
  apiKey,
  text,
  fileData,
  mimeType
}) {

  try {

    const input = [];

    /*
    ==========================================
    إذا توجد صورة مرفقة
    ==========================================
    */

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

    /*
    ==========================================
    إضافة الطلب النصي
    ==========================================
    */

    input.push({
      type: "text",

      text:
        text ||
        "أنشئ صورة عالية الجودة."
    });

    /*
    ==========================================
    Gemini Image
    ==========================================
    */

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

    const data =
      await response.json();

    /*
    ==========================================
    فشل الطلب
    ==========================================
    */

    if (!response.ok) {

      console.error(
        "Image generation error:",
        data
      );

      return res.status(
        response.status
      ).json({

        error:
          data?.error?.message ||
          "تعذر إنشاء الصورة."

      });
    }

    /*
    ==========================================
    استخراج الصورة
    ==========================================
    */

    let image = null;

    let generatedText = "";

    /*
    convenience output_image
    */

    if (
      data?.output_image?.data
    ) {

      image =
        "data:image/png;base64," +
        data.output_image.data;

    }

    /*
    البحث داخل steps
    */

    if (!image && Array.isArray(data.steps)) {

      for (
        const step of data.steps
      ) {

        if (
          step?.type !==
          "model_output"
        ) {
          continue;
        }

        const content =
          step.content || [];

        for (
          const block of content
        ) {

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

    /*
    ==========================================
    إذا لم نجد صورة
    ==========================================
    */

    if (!image) {

      return res.status(500).json({
        error:
          "Gemini نجح في الاتصال لكنه لم يُرجع صورة."
      });
    }

    /*
    ==========================================
    إرسال الصورة
    ==========================================
    */

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

استخدمت هنا واجهة Interactions API لتوليد الصور لأنها الواجهة الحالية الموثقة لتوليد الصور، مع "gemini-3.1-flash-image".

---

2. استبدل "index.html" بالكامل

هذه النسخة تضيف زر 📎 للملفات، معاينة للصورة/الفيديو، وإرسال الملف مع السؤال إلى "api/chat".

:::writing{variant="document" id="74106" title="index.html الكامل"}

<!DOCTYPE html>

<html lang="ar" dir="rtl">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>واصل AI - Wasel AI</title>

  <!-- Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Font Awesome -->
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
  >

  <!-- Tajawal -->
  <link
    href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
    rel="stylesheet"
  >

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Tajawal", sans-serif;
      background:
        radial-gradient(
          circle at top,
          #172554 0%,
          #020617 45%,
          #020617 100%
        );
      color: white;
      min-height: 100vh;
    }

    #chatBox {
      scroll-behavior: smooth;
    }

    .message {
      animation: messageIn .25s ease;
    }

    @keyframes messageIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .file-preview img,
    .file-preview video {
      max-height: 260px;
      width: 100%;
      object-fit: contain;
      border-radius: 14px;
    }

    .loader {
      width: 18px;
      height: 18px;
      border: 3px solid rgba(255,255,255,.25);
      border-top-color: white;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    textarea {
      resize: none;
    }

  </style>

</head>


<body>

<div class="min-h-screen flex flex-col">


  <!-- ======================================
       HEADER
  ======================================= -->

  <header
    class="
      sticky
      top-0
      z-50
      border-b
      border-white/10
      bg-slate-950/80
      backdrop-blur-xl
    "
  >

    <div
      class="
        max-w-4xl
        mx-auto
        px-4
        py-4
        flex
        items-center
        justify-between
      "
    >

      <div class="flex items-center gap-3">

        <div
          class="
            w-11
            h-11
            rounded-2xl
            bg-indigo-600
            flex
            items-center
            justify-center
            shadow-lg
            shadow-indigo-600/30
          "
        >

          <i
            class="fa-solid fa-wand-magic-sparkles text-lg"
          ></i>

        </div>

        <div>

          <h1
            class="font-extrabold text-lg"
          >
            واصل AI
          </h1>

          <div
            class="
              text-xs
              text-slate-400
              flex
              items-center
              gap-2
            "
          >

            <span
              class="
                w-2
                h-2
                bg-emerald-400
                rounded-full
              "
            ></span>

            مساعد متعدد الوسائط

          </div>

        </div>

      </div>

    </div>

  </header>


  <!-- ======================================
       CHAT
  ======================================= -->

  <main
    id="chatBox"
    class="
      flex-1
      max-w-4xl
      w-full
      mx-auto
      px-4
      py-6
      pb-44
      space-y-5
      overflow-y-auto
    "
  >


    <!-- Welcome -->

    <div
      class="
        message
        flex
        gap-3
        items-start
      "
    >

      <div
        class="
          w-9
          h-9
          shrink-0
          rounded-xl
          bg-indigo-600/20
          text-indigo-400
          flex
          items-center
          justify-center
        "
      >

        <i
          class="fa-solid fa-robot"
        ></i>

      </div>


      <div
        class="
          bg-slate-900/80
          border
          border-white/10
          rounded-2xl
          rounded-tr-md
          px-4
          py-3
          max-w-[90%]
        "
      >

        <div
          class="font-bold mb-1"
        >
          واصل AI
        </div>

        <div
          class="
            text-slate-300
            leading-7
          "
        >

          أهلاً بك 👋

          <br>

          أرسل لي نصًا أو صورة أو فيديو أو صوتًا أو PDF،
          وسأحلله لك.

          <br><br>

          ويمكنك أيضًا طلب إنشاء صورة.

        </div>

      </div>

    </div>

  </main>


  <!-- ======================================
       INPUT AREA
  ======================================= -->

  <div
    class="
      fixed
      bottom-0
      left-0
      right-0
      z-40
      bg-slate-950/90
      backdrop-blur-xl
      border-t
      border-white/10
    "
  >

    <div
      class="
        max-w-4xl
        mx-auto
        px-4
        py-3
      "
    >


      <!-- File Preview -->

      <div
        id="filePreview"
        class="hidden mb-3"
      ></div>


      <!-- Form -->

      <form
        id="chatForm"
        class="
          flex
          items-end
          gap-2
          bg-slate-900
          border
          border-slate-700
          rounded-3xl
          p-2
        "
      >


        <!-- File button -->

        <label
          for="fileInput"
          class="
            w-11
            h-11
            shrink-0
            rounded-2xl
            bg-slate-800
            hover:bg-slate-700
            cursor-pointer
            flex
            items-center
            justify-center
            text-slate-300
            transition
          "
          title="إرفاق ملف"
        >

          <i
            class="fa-solid fa-paperclip"
          ></i>

        </label>


        <input
          id="fileInput"
          type="file"
          hidden
          accept="
            image/*,
            video/*,
            audio/*,
            application/pdf
          "
        >


        <!-- Text -->

        <textarea
          id="messageInput"
          rows="1"
          placeholder="اكتب رسالتك..."
          class="
            flex-1
            bg-transparent
            outline-none
            text-white
            placeholder-slate-500
            px-2
            py-3
            max-h-32
          "
        ></textarea>


        <!-- Send -->

        <button
          id="sendButton"
          type="submit"
          class="
            w-11
            h-11
            shrink-0
            rounded-2xl
            bg-indigo-600
            hover:bg-indigo-500
            active:scale-95
            transition
            flex
            items-center
            justify-center
          "
        >

          <i
            class="fa-solid fa-paper-plane"
          ></i>

        </button>

      </form>


      <div
        class="
          text-center
          text-[11px]
          text-slate-600
          mt-2
        "
      >
        واصل AI قد يخطئ، تحقق من المعلومات المهمة.
      </div>

    </div>

  </div>

</div>


<script>

/*
==================================================
العناصر
==================================================
*/

const chatBox =
  document.getElementById("chatBox");

const chatForm =
  document.getElementById("chatForm");

const messageInput =
  document.getElementById("messageInput");

const sendButton =
  document.getElementById("sendButton");

const fileInput =
  document.getElementById("fileInput");

const filePreview =
  document.getElementById("filePreview");


/*
==================================================
الملف الحالي
==================================================
*/

let selectedFile = null;


/*
==================================================
حجم الملف
==================================================
*/

const MAX_FILE_SIZE =
  3.5 * 1024 * 1024;


/*
==================================================
اختيار الملف
==================================================
*/

fileInput.addEventListener(
  "change",
  () => {

    const file =
      fileInput.files[0];

    if (!file) {
      return;
    }


    /*
    فحص الحجم
    */

    if (
      file.size >
      MAX_FILE_SIZE
    ) {

      alert(
        "الحد الحالي للملف 3.5 MB.\n\n" +
        "هذا بسبب حدود طلبات Vercel. " +
        "سنضيف لاحقًا رفع الملفات الكبيرة مباشرة إلى Gemini."
      );

      fileInput.value = "";

      selectedFile = null;

      filePreview.classList.add(
        "hidden"
      );

      return;
    }


    selectedFile = file;

    showFilePreview(file);

  }
);


/*
==================================================
عرض معاينة الملف
==================================================
*/

function showFilePreview(file) {

  filePreview.classList.remove(
    "hidden"
  );


  const size =
    formatFileSize(file.size);


  /*
  صورة
  */

  if (
    file.type.startsWith("image/")
  ) {

    const url =
      URL.createObjectURL(file);

    filePreview.innerHTML = `

      <div
        class="
          bg-slate-900
          border
          border-slate-700
          rounded-2xl
          p-3
          relative
        "
      >

        <button
          type="button"
          onclick="removeFile()"
          class="
            absolute
            top-2
            left-2
            z-10
            w-8
 
