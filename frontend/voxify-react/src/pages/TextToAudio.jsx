import { useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const languages = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "Hindi" },
  { value: "gu-IN", label: "Gujarati" },
  { value: "mr-IN", label: "Marathi" },
  { value: "ta-IN", label: "Tamil" },
];

function TextToAudio() {
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en-IN");

  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const getLanguageName = (languageCode) => {
    return (
      languages.find(
        (language) => language.value === languageCode
      )?.label || languageCode
    );
  };

  /*
   * Detect the source language from the Unicode script.
   *
   * English -> Latin
   * Hindi   -> Devanagari
   * Marathi -> Devanagari
   * Gujarati -> Gujarati script
   * Tamil   -> Tamil script
   *
   * Note:
   * Hindi and Marathi both use Devanagari, so plain Unicode
   * cannot reliably distinguish them. For those two, Hindi is
   * used as the default for Devanagari input.
   */
  const detectSourceLanguage = (value) => {
    const input = value.trim();

    if (!input) {
      return "en-IN";
    }

    // Gujarati
    if (/[\u0A80-\u0AFF]/.test(input)) {
      return "gu-IN";
    }

    // Tamil
    if (/[\u0B80-\u0BFF]/.test(input)) {
      return "ta-IN";
    }

    // Devanagari
    if (/[\u0900-\u097F]/.test(input)) {
      return "hi-IN";
    }

    // Default Latin text -> English
    return "en-IN";
  };

  const generateAudio = async () => {
    const cleanText = text.trim();

    if (!cleanText) {
      setError("Please enter some text.");
      return;
    }

    if (cleanText.length > 5000) {
      setError("Text cannot be longer than 5000 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setDetectedLanguage("");
    setTranslatedText("");

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }

    try {
      // ---------------------------------------------------------
      // STEP 1: Detect source language
      // ---------------------------------------------------------

      const sourceLanguage =
        detectSourceLanguage(cleanText);

      setDetectedLanguage(
        getLanguageName(sourceLanguage)
      );

      console.log(
        "Detected source language:",
        sourceLanguage
      );

      console.log(
        "Target language:",
        targetLanguage
      );

      // ---------------------------------------------------------
      // STEP 2: Translate text
      // ---------------------------------------------------------

      let translated = cleanText;

      /*
       * If source and target are the same, translation is not
       * necessary. We can directly send the original text
       * to the audio endpoint.
       */
      if (sourceLanguage !== targetLanguage) {
        const translationResponse = await fetch(
          `${API_BASE_URL}/translation/text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              text: cleanText,
              source_language: sourceLanguage,
              target_language: targetLanguage,
            }),
          }
        );

        const translationData =
          await translationResponse.json();

        console.log(
          "Translation response:",
          translationData
        );

        if (
          !translationResponse.ok ||
          translationData?.success === false
        ) {
          throw new Error(
            translationData?.error?.message ||
              translationData?.detail ||
              "Text translation failed."
          );
        }

        if (!translationData?.translated_text) {
          throw new Error(
            "No translated text was returned."
          );
        }

        translated =
          translationData.translated_text;

        setTranslatedText(translated);

        if (translationData?.source_language) {
          setDetectedLanguage(
            translationData.source_language_name ||
              getLanguageName(
                translationData.source_language
              )
          );
        }
      } else {
        // Same source and target language
        setTranslatedText(cleanText);
        translated = cleanText;
      }

      // ---------------------------------------------------------
      // STEP 3: Save translated text to Supabase Storage
      // ---------------------------------------------------------

      const authToken =
        localStorage.getItem("access_token") ||
        localStorage.getItem("voxify_access_token");

      if (authToken) {
        const textBlob = new Blob(
          [translated],
          { type: "text/plain" }
        );

        const textFile = new File(
          [textBlob],
          `voxify-${Date.now()}.txt`,
          { type: "text/plain" }
        );

        const storageForm = new FormData();
        storageForm.append("file", textFile);

        try {
          const storageResponse = await fetch(
            `${API_BASE_URL}/storage/upload`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
              body: storageForm,
            }
          );

          if (!storageResponse.ok) {
            console.warn(
              "Supabase Storage upload failed:",
              await storageResponse.text()
            );
          }
        } catch (storageError) {
          console.warn(
            "Supabase Storage upload error:",
            storageError
          );
        }
      }

      // ---------------------------------------------------------
      // STEP 4: Generate audio
      // ---------------------------------------------------------

      const audioResponse = await fetch(
        `${API_BASE_URL}/text-to-audio/generate`,
        {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: translated,
            language: targetLanguage,
          }),
        }
      );

      const contentType =
        audioResponse.headers.get("content-type") || "";

      console.log(
        "Audio response status:",
        audioResponse.status
      );

      console.log(
        "Audio response content-type:",
        contentType
      );

      if (audioResponse.status === 204) {
        throw new Error(
          "Backend returned 204 No Content. No audio was generated."
        );
      }

      if (!audioResponse.ok) {
        let message = `Audio generation failed (${audioResponse.status}).`;

        if (
          contentType
            .toLowerCase()
            .includes("application/json")
        ) {
          try {
            const data =
              await audioResponse.json();

            console.log(
              "Audio error response:",
              data
            );

            message =
              data?.error?.message ||
              data?.detail ||
              data?.message ||
              message;
          } catch {
            // Keep default error message.
          }
        }

        throw new Error(message);
      }

      if (
        !contentType
          .toLowerCase()
          .includes("audio")
      ) {
        /*
         * Sometimes the backend may return an MP3 with a
         * generic content type. We still check the bytes below.
         */
        console.warn(
          "Backend content-type is not explicitly audio:",
          contentType
        );
      }

      const buffer =
        await audioResponse.arrayBuffer();

      if (!buffer.byteLength) {
        throw new Error(
          "The backend returned an empty audio file."
        );
      }

      const audioBlob = new Blob(
        [buffer],
        {
          type: "audio/mpeg",
        }
      );

      const url =
        URL.createObjectURL(audioBlob);

      setAudioUrl(url);
      setError("");

      console.log(
        "Text -> Translation -> Audio completed successfully."
      );

      console.log(
        "Detected language:",
        sourceLanguage
      );

      console.log(
        "Target language:",
        targetLanguage
      );

      console.log(
        "Translated text:",
        translated
      );

      console.log(
        "Audio bytes:",
        buffer.byteLength
      );
    } catch (err) {
      console.error(
        "Text -> Audio error:",
        err
      );

      if (err instanceof TypeError) {
        setError(
          "Cannot connect to Voxify backend. Please make sure FastAPI is running on http://127.0.0.1:8000."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Text to Audio generation failed."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) {
      return;
    }

    const link =
      document.createElement("a");

    link.href = audioUrl;
    link.download =
      "voxify-text-to-audio.mp3";

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const selectedLanguageLabel =
    languages.find(
      (item) => item.value === targetLanguage
    )?.label || "selected language";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* TOP HEADER */}

      <div
        style={{
          width: "100%",
          background: "#ffffff",
          borderBottom:
            "1px solid #e2e8f0",
          padding: "18px 40px",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "14px",
              background: "#2563eb",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              fontWeight: 800,
            }}
          >
            V
          </div>

          <div
            style={{
              color: "#172033",
              fontSize: "26px",
              fontWeight: 700,
            }}
          >
            Voxify
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            border: "none",
            borderRadius: "12px",
            padding: "12px 20px",
            background: "#eff6ff",
            color: "#2563eb",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Dashboard
        </button>
      </div>

      {/* MAIN */}

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px",
          boxSizing: "border-box",
        }}
      >
        {/* TITLE */}

        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#2563eb",
              letterSpacing: "0.08em",
              marginBottom: "10px",
            }}
          >
            Voxify / Text to Audio
          </div>

          <h1
            style={{
              margin: 0,
              color: "#172554",
              fontSize: "34px",
            }}
          >
            Text to Audio
          </h1>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#64748b",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            Enter text in a supported language,
            translate it, and generate audio.
          </p>
        </div>

        {/* MAIN CARD */}

        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "28px",
            boxShadow:
              "0 8px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          {/* TARGET LANGUAGE */}

          <div
            style={{
              marginBottom: "28px",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#64748b",
                letterSpacing: "0.04em",
              }}
            >
              OUTPUT LANGUAGE
            </label>

            <select
              value={targetLanguage}
              onChange={(e) => {
                setTargetLanguage(
                  e.target.value
                );
                setError("");
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "15px",
                border:
                  "1px solid #dbe2ea",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#172033",
                fontSize: "16px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {languages.map(
                (language) => (
                  <option
                    key={language.value}
                    value={language.value}
                  >
                    {language.label}
                  </option>
                )
              )}
            </select>

            <div
              style={{
                marginTop: "10px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              Source language is detected
              automatically. Audio will be
              generated in{" "}
              <strong>
                {selectedLanguageLabel}
              </strong>
              .
            </div>
          </div>

          {/* TEXT INPUT */}

          <div
            style={{
              border:
                "1px solid #dbe2ea",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                borderBottom:
                  "1px solid #e2e8f0",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
              }}
            >
              <strong
                style={{
                  color: "#172033",
                  fontSize: "18px",
                }}
              >
                Enter Text
              </strong>

              <span
                style={{
                  color: text
                    ? "#2563eb"
                    : "#94a3b8",
                  fontSize: "13px",
                }}
              >
                {text.length} / 5000
              </span>
            </div>

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              maxLength={5000}
              placeholder="Type or paste text here..."
              style={{
                width: "100%",
                minHeight: "300px",
                boxSizing: "border-box",
                border: "none",
                outline: "none",
                resize: "vertical",
                padding: "20px",
                fontSize: "17px",
                lineHeight: 1.6,
                color: "#172033",
              }}
            />
          </div>

          {/* DETECTED LANGUAGE */}

          {detectedLanguage && (
            <div
              style={{
                marginTop: "18px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Detected language:{" "}
              {detectedLanguage}
            </div>
          )}

          {/* TRANSLATED TEXT */}

          {translatedText && (
            <div
              style={{
                marginTop: "20px",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "14px",
                overflow: "hidden",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  padding: "15px 18px",
                  borderBottom:
                    "1px solid #e2e8f0",
                  background: "#ffffff",
                  fontWeight: 700,
                  color: "#172033",
                }}
              >
                Voxify Result
              </div>

              <div
                style={{
                  padding: "20px",
                  color: "#172033",
                  fontSize: "17px",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {translatedText}
              </div>
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div
              style={{
                marginTop: "20px",
                padding: "14px 16px",
                borderRadius: "10px",
                background: "#fef2f2",
                border:
                  "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* GENERATE BUTTON */}

          <button
            type="button"
            onClick={generateAudio}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "24px",
              padding: "16px",
              border: "none",
              borderRadius: "12px",
              background: loading
                ? "#93c5fd"
                : "#2563eb",
              color: "#ffffff",
              fontSize: "17px",
              fontWeight: 700,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Translating & Generating Audio..."
              : "Translate & Generate Audio"}
          </button>

          {/* AUDIO RESULT */}

          {audioUrl && (
            <div
              style={{
                marginTop: "24px",
                padding: "20px",
                borderRadius: "14px",
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#172033",
                  marginBottom: "14px",
                }}
              >
                Generated Audio
              </div>

              <audio
                controls
                src={audioUrl}
                style={{
                  width: "100%",
                }}
              >
                Your browser does not support
                audio playback.
              </audio>

              <button
                type="button"
                onClick={downloadAudio}
                style={{
                  marginTop: "15px",
                  width: "100%",
                  padding: "13px",
                  border: "none",
                  borderRadius: "10px",
                  background: "#172554",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Download Audio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TextToAudio;