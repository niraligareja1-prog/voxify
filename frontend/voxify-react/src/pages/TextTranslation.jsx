import { useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const languages = [
  {
    value: "en-IN",
    labels: {
      "en-IN": "English",
      "gu-IN": "ગુજરાતી",
      "hi-IN": "हिन्दी",
      "mr-IN": "मराठी",
      "ta-IN": "தமிழ்",
    },
  },
  {
    value: "gu-IN",
    labels: {
      "en-IN": "Gujarati",
      "gu-IN": "ગુજરાતી",
      "hi-IN": "गुजराती",
      "mr-IN": "गुजराती",
      "ta-IN": "குஜராத்தி",
    },
  },
  {
    value: "hi-IN",
    labels: {
      "en-IN": "Hindi",
      "gu-IN": "હિન્દી",
      "hi-IN": "हिन्दी",
      "mr-IN": "हिंदी",
      "ta-IN": "இந்தி",
    },
  },
  {
    value: "mr-IN",
    labels: {
      "en-IN": "Marathi",
      "gu-IN": "મરાઠી",
      "hi-IN": "मराठी",
      "mr-IN": "मराठी",
      "ta-IN": "மராத்தி",
    },
  },
  {
    value: "ta-IN",
    labels: {
      "en-IN": "Tamil",
      "gu-IN": "તમિલ",
      "hi-IN": "तमिल",
      "mr-IN": "तमिळ",
      "ta-IN": "தமிழ்",
    },
  },
];

const uiTranslations = {
  "en-IN": {
    dashboard: "Dashboard",
    breadcrumb: "Voxify / Text Translation",
    title: "Text Translation",
    description:
      "Enter text in any supported language and let Voxify automatically detect it.",
    outputLanguage: "OUTPUT LANGUAGE",
    sourceDetected: "Source language is detected automatically.",
    yourText: "Your Text",
    result: "Voxify Result",
    detected: "Detected",
    inputPlaceholder:
      "Type or paste text in English, Hindi, Gujarati, Marathi, or Tamil...",
    resultPlaceholder: "Your translated text will appear here...",
    translateTo: "Translate to",
    translating: "Translating...",
    pleaseEnter: "Please enter some text to translate.",
    tooLong: "Text cannot be longer than 5000 characters.",
    translationFailed: "Translation failed.",
    noTranslatedText: "No translated text was returned.",
    backDashboard: "← Dashboard",
  },

  "gu-IN": {
    dashboard: "ડેશબોર્ડ",
    breadcrumb: "Voxify / ટેક્સ્ટ અનુવાદ",
    title: "ટેક્સ્ટ અનુવાદ",
    description:
      "કોઈપણ સપોર્ટેડ ભાષામાં લખાણ દાખલ કરો અને Voxify તેને આપમેળે ઓળખશે.",
    outputLanguage: "આઉટપુટ ભાષા",
    sourceDetected: "સ્રોત ભાષા આપમેળે ઓળખવામાં આવશે.",
    yourText: "તમારું લખાણ",
    result: "Voxify પરિણામ",
    detected: "ઓળખાયેલી ભાષા",
    inputPlaceholder:
      "અંગ્રેજી, હિન્દી, ગુજરાતી, મરાઠી અથવા તમિલમાં લખાણ લખો અથવા પેસ્ટ કરો...",
    resultPlaceholder: "તમારો અનુવાદ અહીં દેખાશે...",
    translateTo: "માં અનુવાદ કરો",
    translating: "અનુવાદ થઈ રહ્યો છે...",
    pleaseEnter: "કૃપા કરીને અનુવાદ કરવા માટે થોડું લખાણ દાખલ કરો.",
    tooLong: "લખાણ 5000 અક્ષરથી વધુ ન હોવું જોઈએ.",
    translationFailed: "અનુવાદ નિષ્ફળ ગયો.",
    noTranslatedText: "કોઈ અનુવાદિત લખાણ મળ્યું નથી.",
    backDashboard: "← ડેશબોર્ડ",
  },

  "hi-IN": {
    dashboard: "डैशबोर्ड",
    breadcrumb: "Voxify / टेक्स्ट अनुवाद",
    title: "टेक्स्ट अनुवाद",
    description:
      "किसी भी समर्थित भाषा में टेक्स्ट दर्ज करें और Voxify उसे अपने आप पहचान लेगा।",
    outputLanguage: "आउटपुट भाषा",
    sourceDetected: "स्रोत भाषा अपने आप पहचानी जाएगी।",
    yourText: "आपका टेक्स्ट",
    result: "Voxify परिणाम",
    detected: "पहचानी गई भाषा",
    inputPlaceholder:
      "अंग्रेज़ी, हिंदी, गुजराती, मराठी या तमिल में टेक्स्ट लिखें या पेस्ट करें...",
    resultPlaceholder: "आपका अनुवाद यहाँ दिखाई देगा...",
    translateTo: "में अनुवाद करें",
    translating: "अनुवाद हो रहा है...",
    pleaseEnter: "कृपया अनुवाद करने के लिए कुछ टेक्स्ट दर्ज करें।",
    tooLong: "टेक्स्ट 5000 अक्षरों से अधिक नहीं होना चाहिए।",
    translationFailed: "अनुवाद विफल रहा।",
    noTranslatedText: "कोई अनुवादित टेक्स्ट प्राप्त नहीं हुआ।",
    backDashboard: "← डैशबोर्ड",
  },

  "mr-IN": {
    dashboard: "डॅशबोर्ड",
    breadcrumb: "Voxify / मजकूर भाषांतर",
    title: "मजकूर भाषांतर",
    description:
      "कोणत्याही समर्थित भाषेत मजकूर प्रविष्ट करा आणि Voxify तो आपोआप ओळखेल.",
    outputLanguage: "आउटपुट भाषा",
    sourceDetected: "स्रोत भाषा आपोआप ओळखली जाईल.",
    yourText: "तुमचा मजकूर",
    result: "Voxify निकाल",
    detected: "ओळखलेली भाषा",
    inputPlaceholder:
      "इंग्रजी, हिंदी, गुजराती, मराठी किंवा तमिळमध्ये मजकूर लिहा किंवा पेस्ट करा...",
    resultPlaceholder: "तुमचे भाषांतर येथे दिसेल...",
    translateTo: "मध्ये भाषांतर करा",
    translating: "भाषांतर सुरू आहे...",
    pleaseEnter: "कृपया भाषांतर करण्यासाठी काही मजकूर प्रविष्ट करा.",
    tooLong: "मजकूर 5000 अक्षरांपेक्षा जास्त नसावा.",
    translationFailed: "भाषांतर अयशस्वी झाले.",
    noTranslatedText: "भाषांतरित मजकूर मिळाला नाही.",
    backDashboard: "← डॅशबोर्ड",
  },

  "ta-IN": {
    dashboard: "டாஷ்போர்டு",
    breadcrumb: "Voxify / உரை மொழிபெயர்ப்பு",
    title: "உரை மொழிபெயர்ப்பு",
    description:
      "ஆதரிக்கப்படும் எந்த மொழியிலும் உரையை உள்ளிடுங்கள். Voxify அதை தானாகக் கண்டறியும்.",
    outputLanguage: "வெளியீட்டு மொழி",
    sourceDetected: "மூல மொழி தானாகக் கண்டறியப்படும்.",
    yourText: "உங்கள் உரை",
    result: "Voxify முடிவு",
    detected: "கண்டறியப்பட்ட மொழி",
    inputPlaceholder:
      "ஆங்கிலம், இந்தி, குஜராத்தி, மராத்தி அல்லது தமிழில் உரையை எழுதவும் அல்லது ஒட்டவும்...",
    resultPlaceholder: "உங்கள் மொழிபெயர்ப்பு இங்கே தோன்றும்...",
    translateTo: "மொழிக்கு மொழிபெயர்க்கவும்",
    translating: "மொழிபெயர்க்கப்படுகிறது...",
    pleaseEnter: "மொழிபெயர்க்க சில உரையை உள்ளிடவும்.",
    tooLong: "உரை 5000 எழுத்துகளுக்கு மேல் இருக்கக்கூடாது.",
    translationFailed: "மொழிபெயர்ப்பு தோல்வியடைந்தது.",
    noTranslatedText: "மொழிபெயர்க்கப்பட்ட உரை கிடைக்கவில்லை.",
    backDashboard: "← டாஷ்போர்டு",
  },
};

function TextTranslation() {
  const [appLanguage, setAppLanguage] = useState(
    localStorage.getItem("preferred_language") || "en-IN"
  );

  const [targetLanguage, setTargetLanguage] = useState("gu-IN");
  const [text, setText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const t =
    uiTranslations[appLanguage] || uiTranslations["en-IN"];

  useEffect(() => {
    const handleLanguageChange = () => {
      const savedLanguage =
        localStorage.getItem("preferred_language") || "en-IN";

      setAppLanguage(savedLanguage);
    };

    handleLanguageChange();

    window.addEventListener(
      "voxify-language-changed",
      handleLanguageChange
    );

    window.addEventListener("storage", handleLanguageChange);

    return () => {
      window.removeEventListener(
        "voxify-language-changed",
        handleLanguageChange
      );

      window.removeEventListener("storage", handleLanguageChange);
    };
  }, []);

  const getLanguageLabel = (language) => {
    return (
      language?.labels?.[appLanguage] ||
      language?.labels?.["en-IN"] ||
      language?.value ||
      ""
    );
  };

  const translateText = async () => {
    const cleanText = text.trim();

    if (!cleanText) {
      setError(t.pleaseEnter);
      return;
    }

    if (cleanText.length > 5000) {
      setError(t.tooLong);
      return;
    }

    setLoading(true);
    setError("");
    setTranslatedText("");
    setDetectedLanguage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/translation/text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            text: cleanText,
            source_language: "en-IN",
            target_language: targetLanguage,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error?.message ||
            data?.detail ||
            t.translationFailed
        );
      }

      if (!data?.translated_text) {
        throw new Error(t.noTranslatedText);
      }

      setTranslatedText(data.translated_text);

      if (data?.source_language_name) {
        setDetectedLanguage(data.source_language_name);
      } else if (data?.source_language) {
        const detected = languages.find(
          (language) =>
            language.value === data.source_language
        );

        setDetectedLanguage(
          detected
            ? getLanguageLabel(detected)
            : data.source_language
        );
      }
    } catch (err) {
      console.error("Translation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : t.translationFailed
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedTarget = languages.find(
    (language) => language.value === targetLanguage
  );

  const selectedTargetLabel =
    getLanguageLabel(selectedTarget);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
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
              boxShadow:
                "0 4px 12px rgba(37, 99, 235, 0.20)",
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
          {t.backDashboard}
        </button>
      </div>

      <div
        style={{
          maxWidth: "1200px",
          padding: "40px",
          boxSizing: "border-box",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "30px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#2563eb",
              letterSpacing: "0.08em",
              marginBottom: "10px",
            }}
          >
            {t.breadcrumb}
          </div>

          <h1
            style={{
              margin: 0,
              color: "#172554",
              fontSize: "34px",
            }}
          >
            {t.title}
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
            {t.description}
          </p>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "28px",
            boxShadow:
              "0 8px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div>
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
              {t.outputLanguage}
            </label>

            <select
              value={targetLanguage}
              onChange={(e) => {
                setTargetLanguage(e.target.value);
                setError("");
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "15px",
                border: "1px solid #dbe2ea",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#172033",
                fontSize: "16px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {languages.map((language) => (
                <option
                  key={language.value}
                  value={language.value}
                >
                  {getLanguageLabel(language)}
                </option>
              ))}
            </select>

            <div
              style={{
                marginTop: "10px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              {t.sourceDetected}
            </div>
          </div>

          <div
            className="voxify-text-translation-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "22px",
              marginTop: "28px",
            }}
          >
            <div
              style={{
                border: "1px solid #e2e8f0",
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
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong
                  style={{
                    color: "#172033",
                    fontSize: "16px",
                  }}
                >
                  ✎ {t.yourText}
                </strong>

                <span
                  style={{
                    color: text
                      ? "#2563eb"
                      : "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  {text.length}/5000
                </span>
              </div>

              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError("");
                }}
                maxLength={5000}
                placeholder={t.inputPlaceholder}
                style={{
                  width: "100%",
                  minHeight: "280px",
                  boxSizing: "border-box",
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  padding: "20px",
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: "#172033",
                }}
              />
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                overflow: "hidden",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom:
                    "1px solid #e2e8f0",
                  background: "#ffffff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <strong
                  style={{
                    color: "#172033",
                    fontSize: "16px",
                  }}
                >
                  ✦ {t.result}
                </strong>

                {detectedLanguage && (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      fontSize: "12px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.detected}: {detectedLanguage}
                  </span>
                )}
              </div>

              <div
                style={{
                  minHeight: "280px",
                  padding: "20px",
                  boxSizing: "border-box",
                  color: translatedText
                    ? "#172033"
                    : "#94a3b8",
                  fontSize: "16px",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {translatedText ||
                  t.resultPlaceholder}
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: "20px",
                padding: "13px 16px",
                borderRadius: "10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={translateText}
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
              ? t.translating
              : `${t.translateTo} ${selectedTargetLabel}`}
          </button>
        </div>
      </div>

      <style>
        {`
          @media (max-width: 800px) {
            .voxify-text-translation-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}

export default TextTranslation;
