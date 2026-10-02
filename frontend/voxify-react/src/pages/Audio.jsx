import React, { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config";

import {
  Mic,
  Square,
  Upload,
  Play,
  Languages,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Volume2,
  Mic2,
} from "lucide-react";


const LANGUAGES = [
  { code: "en-IN", name: "English" },
  { code: "hi-IN", name: "Hindi" },
  { code: "gu-IN", name: "Gujarati" },
  { code: "mr-IN", name: "Marathi" },
  { code: "ta-IN", name: "Tamil" },
];

function Audio() {
  const [mode, setMode] = useState("audio-to-audio");

  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en-IN");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [transcribedText, setTranscribedText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [outputAudioUrl, setOutputAudioUrl] = useState("");

  const [microphones, setMicrophones] = useState([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState("");
  const [micLevel, setMicLevel] = useState(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const audioPreviewRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // ---------------------------------------------------------
  // MODE
  // ---------------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentMode = params.get("mode");

    if (currentMode === "audio-to-text") {
      setMode("audio-to-text");
    } else {
      setMode("audio-to-audio");
    }

    loadMicrophones();

    return () => {
      stopMediaTracks();
      stopAudioMonitoring();

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      if (outputAudioUrl) {
        URL.revokeObjectURL(outputAudioUrl);
      }
    };
  }, []);

  // ---------------------------------------------------------
  // MICROPHONES
  // ---------------------------------------------------------

  const loadMicrophones = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );

      setMicrophones(audioInputs);

      if (audioInputs.length > 0 && !selectedMicrophone) {
        const defaultDevice =
          audioInputs.find(
            (device) => device.deviceId === "default"
          ) || audioInputs[0];

        setSelectedMicrophone(defaultDevice.deviceId);
      }

      console.log("Available microphones:", audioInputs);
    } catch (err) {
      console.error("Could not load microphones:", err);
    }
  };

  // ---------------------------------------------------------
  // STOP STREAM
  // ---------------------------------------------------------

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn("Could not stop track:", err);
        }
      });

      mediaStreamRef.current = null;
    }
  };

  // ---------------------------------------------------------
  // AUDIO MONITOR
  // ---------------------------------------------------------

  const startAudioMonitoring = (stream) => {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioContext = new AudioContextClass();

      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);

      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);

      const updateLevel = () => {
        if (!analyserRef.current) {
          return;
        }

        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const normalized =
            (dataArray[i] - 128) / 128;

          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / dataArray.length);

        const level = Math.min(
          100,
          Math.round(rms * 500)
        );

        setMicLevel(level);

        animationFrameRef.current =
          requestAnimationFrame(updateLevel);
      };

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }

      updateLevel();
    } catch (err) {
      console.warn(
        "Could not start microphone monitoring:",
        err
      );
    }
  };

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setMicLevel(0);
  };

  // ---------------------------------------------------------
  // CLEAR RESULTS
  // ---------------------------------------------------------

  const clearResults = () => {
    setStatus("");
    setError("");
    setDetectedLanguage("");
    setTranscribedText("");
    setTranslatedText("");

    if (outputAudioUrl) {
      URL.revokeObjectURL(outputAudioUrl);
      setOutputAudioUrl("");
    }
  };

  const resetAudioUrl = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl("");
  };

  // ---------------------------------------------------------
  // FILE UPLOAD
  // ---------------------------------------------------------

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearResults();
    resetAudioUrl();

    setSelectedFile(file);

    const url = URL.createObjectURL(file);

    setAudioUrl(url);

    setStatus("Audio file selected.");
  };

  // ---------------------------------------------------------
  // MIME TYPE
  // ---------------------------------------------------------

  const getSupportedMimeType = () => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];

    for (const type of types) {
      if (
        window.MediaRecorder &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    }

    return "";
  };

  // ---------------------------------------------------------
  // START RECORDING
  // ---------------------------------------------------------

  const startRecording = async () => {
    clearResults();
    resetAudioUrl();

    setSelectedFile(null);
    setRecordingTime(0);
    setMicLevel(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Your browser does not support microphone recording."
        );
      }

      if (!window.MediaRecorder) {
        throw new Error(
          "Your browser does not support audio recording."
        );
      }

      // Stop previous stream if any
      stopMediaTracks();
      stopAudioMonitoring();

      const audioConstraints = {
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      if (selectedMicrophone) {
        audioConstraints.deviceId = {
          exact: selectedMicrophone,
        };
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

      const audioTracks = stream.getAudioTracks();

      if (!audioTracks || audioTracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop());

        throw new Error(
          "No microphone audio track was found."
        );
      }

      const audioTrack = audioTracks[0];

      console.log("========== VOXIFY MICROPHONE ==========");
      console.log("Label:", audioTrack.label);
      console.log("Enabled:", audioTrack.enabled);
      console.log("Muted:", audioTrack.muted);
      console.log("Ready State:", audioTrack.readyState);
      console.log("Settings:", audioTrack.getSettings());
      console.log("=======================================");

      if (audioTrack.readyState !== "live") {
        stream.getTracks().forEach((track) => track.stop());

        throw new Error(
          "Microphone is not active. Please check Windows microphone settings."
        );
      }

      if (!audioTrack.enabled) {
        audioTrack.enabled = true;
      }

      mediaStreamRef.current = stream;

      // Start microphone level monitoring
      startAudioMonitoring(stream);

      const mimeType = getSupportedMimeType();

      const recorderOptions = mimeType
        ? {
            mimeType,
            audioBitsPerSecond: 128000,
          }
        : {
            audioBitsPerSecond: 128000,
          };

      const recorder = new MediaRecorder(
        stream,
        recorderOptions
      );

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          console.log(
            "Audio chunk:",
            event.data.size,
            "bytes"
          );

          audioChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onerror = (event) => {
        console.error(
          "MediaRecorder error:",
          event
        );

        setError(
          "Microphone recording failed."
        );
      };

      recorder.onstop = () => {
        const actualType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const blob = new Blob(
          audioChunksRef.current,
          {
            type: actualType,
          }
        );

        console.log(
          "========== FINAL RECORDING =========="
        );

        console.log("Size:", blob.size);
        console.log("Type:", blob.type);

        console.log(
          "====================================="
        );

        stopMediaTracks();
        stopAudioMonitoring();

        if (blob.size === 0) {
          setError(
            "Recording is empty. Please check your microphone."
          );
          return;
        }

        if (blob.size === 0) {
            setError(
                "Recording is empty. Please check your microphone and try again."
            );
            return;
        }

        const extension =
          blob.type.includes("ogg")
            ? "ogg"
            : "webm";

        const recordedFile = new File(
          [blob],
          `voxify-recording-${Date.now()}.${extension}`,
          {
            type: blob.type,
          }
        );

        setSelectedFile(recordedFile);

        const url =
          URL.createObjectURL(blob);

        setAudioUrl(url);

        setStatus(
          `Recording completed successfully (${(
            blob.size / 1024
          ).toFixed(1)} KB).`
        );
      };

      // Request data every 250ms.
      // This makes recording more reliable.
      recorder.start(250);

      setIsRecording(true);

      setStatus(
        "Recording... Speak now."
      );

      timerRef.current = setInterval(() => {
        setRecordingTime(
          (previous) => previous + 1
        );
      }, 1000);
    } catch (err) {
      console.error(
        "Microphone error:",
        err
      );

      stopMediaTracks();
      stopAudioMonitoring();

      if (err?.name === "NotAllowedError") {
        setError(
          "Microphone permission was denied. Allow microphone access for localhost."
        );
      } else if (
        err?.name === "NotFoundError"
      ) {
        setError(
          "No microphone was found."
        );
      } else if (
        err?.name === "NotReadableError"
      ) {
        setError(
          "The microphone is being used by another application. Close other apps using the microphone."
        );
      } else if (
        err?.name === "OverconstrainedError"
      ) {
        setError(
          "The selected microphone is unavailable. Select another microphone."
        );
      } else {
        setError(
          err?.message ||
            "Unable to access the microphone."
        );
      }
    }
  };

  // ---------------------------------------------------------
  // STOP RECORDING
  // ---------------------------------------------------------

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);

    const recorder =
      mediaRecorderRef.current;

    if (
      recorder &&
      recorder.state !== "inactive"
    ) {
      recorder.stop();
    } else {
      stopMediaTracks();
      stopAudioMonitoring();
    }
  };

  // ---------------------------------------------------------
  // FORMAT TIME
  // ---------------------------------------------------------

  const formatTime = (seconds) => {
    const minutes = Math.floor(
      seconds / 60
    )
      .toString()
      .padStart(2, "0");

    const remainingSeconds = (
      seconds % 60
    )
      .toString()
      .padStart(2, "0");

    return `${minutes}:${remainingSeconds}`;
  };

  // ---------------------------------------------------------
  // PROCESS AUDIO
  // ---------------------------------------------------------

  const processAudio = async () => {
    if (!selectedFile) {
      setError(
        "Please upload an audio file or record your voice first."
      );
      return;
    }

    clearResults();

    setStatus(
      "Uploading and detecting speech..."
    );

    setError("");

    try {
      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

      // Save the original uploaded/recorded audio in Supabase Storage.
      const authToken =
        localStorage.getItem("access_token") ||
        localStorage.getItem("voxify_access_token");

      if (authToken) {
        try {
          const storageForm = new FormData();
          storageForm.append("file", selectedFile);

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
              "Audio source storage upload failed:",
              await storageResponse.text()
            );
          }
        } catch (storageError) {
          console.warn(
            "Audio source storage upload error:",
            storageError
          );
        }
      }

      const transcriptionResponse =
        await fetch(
          `${API_BASE_URL}/audio/transcribe`,
          {
            method: "POST",
            body: formData,
          }
        );

      const transcriptionData =
        await transcriptionResponse.json();

      if (!transcriptionResponse.ok) {
        throw new Error(
          transcriptionData?.detail ||
            transcriptionData?.error
              ?.message ||
            "Audio transcription failed."
        );
      }

      const detected =
        transcriptionData.detected_language;

      const detectedName =
        transcriptionData.detected_language_name;

      const text =
        transcriptionData.transcribed_text;

      setDetectedLanguage(
        `${detectedName} (${detected})`
      );

      setTranscribedText(text);

      setStatus(
        "Speech detected successfully."
      );

      // Audio → Text
      if (mode === "audio-to-text") {
        return;
      }

      // Audio → Audio
      setStatus(
        "Translating audio..."
      );

      const translationResponse =
        await fetch(
          `${API_BASE_URL}/translation/text`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              text,
              source_language: detected,
              target_language:
                targetLanguage,
            }),
          }
        );

      const translationData =
        await translationResponse.json();

      if (!translationResponse.ok) {
        throw new Error(
          translationData?.detail ||
            translationData?.error
              ?.message ||
            "Translation failed."
        );
      }

      const translated =
        translationData.translated_text ||
        text;

      setTranslatedText(
        translated
      );

      // Save Audio translation to history.
      if (authToken) {
        try {
          const historyResponse = await fetch(
            `${API_BASE_URL}/history`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                content_type: "audio",
                source_language: detected,
                target_language: targetLanguage,
                original_text: text,
                translated_text: translated,
              }),
            }
          );

          if (!historyResponse.ok) {
            console.warn(
              "Audio history save failed:",
              await historyResponse.text()
            );
          }
        } catch (historyError) {
          console.warn(
            "Audio history save error:",
            historyError
          );
        }
      }

      // Generate target-language audio
      setStatus(
        "Generating translated audio..."
      );

      const audioResponse =
        await fetch(
          `${API_BASE_URL}/text-to-audio/generate-speech`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              text: translated,
              language:
                targetLanguage,
            }),
          }
        );

      if (!audioResponse.ok) {
        let message =
          "Audio generation failed.";

        try {
          const data =
            await audioResponse.json();

          message =
            data?.detail ||
            data?.error?.message ||
            message;
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      const audioBuffer =
        await audioResponse.arrayBuffer();

      if (!audioBuffer.byteLength) {
        throw new Error(
          "Backend returned empty audio."
        );
      }

      const outputBlob =
        new Blob(
          [audioBuffer],
          {
            type: "audio/mpeg",
          }
        );

      const outputUrl =
        URL.createObjectURL(
          outputBlob
        );

      setOutputAudioUrl(
        outputUrl
      );

      // Save generated translated audio in Supabase Storage.
      if (authToken) {
        try {
          const outputFile = new File(
            [outputBlob],
            `voxify-translated-audio-${Date.now()}.mp3`,
            { type: "audio/mpeg" }
          );

          const storageForm = new FormData();
          storageForm.append("file", outputFile);

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
              "Generated audio storage upload failed:",
              await storageResponse.text()
            );
          }
        } catch (storageError) {
          console.warn(
            "Generated audio storage upload error:",
            storageError
          );
        }
      }

      setStatus(
        "Audio translated successfully."
      );
    } catch (err) {
      console.error(
        "Audio processing error:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong while processing the audio."
      );
    }
  };

  // ---------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------

  const goDashboard = () => {
    window.location.href = "/";
  };

  const title =
    mode === "audio-to-text"
      ? "Audio → Text"
      : "Audio → Audio";

  const description =
    mode === "audio-to-text"
      ? "Upload an audio file or record your voice. Voxify automatically detects the spoken language and converts speech into text."
      : "Upload an audio file or record your voice. Voxify automatically detects the spoken language and translates it into your selected language.";

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logo}>
            V
          </div>

          <div>
            <div style={styles.brandName}>
              Voxify
            </div>

            <div
              style={
                styles.brandSubtitle
              }
            >
              AI CONTENT PLATFORM
            </div>
          </div>
        </div>

        <button
          onClick={goDashboard}
          style={styles.dashboardButton}
        >
          <ArrowLeft size={19} />
          Dashboard
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.headingArea}>
          <h1 style={styles.title}>
            {title}
          </h1>

          <p style={styles.description}>
            {description}
          </p>
        </div>

        <section style={styles.card}>
          {/* UPLOAD */}
          <div style={styles.uploadBox}>
            <Upload
              size={38}
              color="#2f6fed"
            />

            <h2
              style={
                styles.uploadTitle
              }
            >
              Upload your audio
            </h2>

            <p
              style={
                styles.uploadText
              }
            >
              MP3, WAV, M4A, OGG, WEBM,
              FLAC or AAC
            </p>

            <label
              style={
                styles.uploadButton
              }
            >
              <Upload size={19} />
              Choose Audio File

              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
                onChange={
                  handleFileChange
                }
                style={{
                  display: "none",
                }}
              />
            </label>

            <div
              style={styles.orText}
            >
              OR
            </div>

            {/* MICROPHONE SELECTOR */}
            {microphones.length > 0 && (
              <div
                style={
                  styles.microphoneArea
                }
              >
                <label
                  style={
                    styles.microphoneLabel
                  }
                >
                  <Mic2 size={18} />
                  Microphone
                </label>

                <select
                  value={
                    selectedMicrophone
                  }
                  onChange={(event) =>
                    setSelectedMicrophone(
                      event.target.value
                    )
                  }
                  disabled={
                    isRecording
                  }
                  style={
                    styles.microphoneSelect
                  }
                >
                  {microphones.map(
                    (device, index) => (
                      <option
                        key={
                          device.deviceId
                        }
                        value={
                          device.deviceId
                        }
                      >
                        {device.label ||
                          `Microphone ${
                            index + 1
                          }`}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            {/* RECORD BUTTON */}
            {!isRecording ? (
              <button
                onClick={
                  startRecording
                }
                style={
                  styles.recordButton
                }
              >
                <Mic size={21} />
                Start Recording
              </button>
            ) : (
              <button
                onClick={
                  stopRecording
                }
                style={
                  styles.stopButton
                }
              >
                <Square
                  size={19}
                  fill="white"
                />
                Stop Recording
              </button>
            )}

            {/* LIVE LEVEL */}
            {isRecording && (
              <div
                style={
                  styles.levelContainer
                }
              >
                <div
                  style={
                    styles.levelHeader
                  }
                >
                  <span>
                    Microphone input
                  </span>

                  <strong>
                    {micLevel}%
                  </strong>
                </div>

                <div
                  style={
                    styles.levelTrack
                  }
                >
                  <div
                    style={{
                      ...styles.levelFill,
                      width: `${Math.max(
                        2,
                        micLevel
                      )}%`,
                    }}
                  />
                </div>

                {micLevel < 3 ? (
                  <div
                    style={
                      styles.levelWarning
                    }
                  >
                    Speak into the
                    microphone. If the
                    meter stays at 0%,
                    select another
                    microphone above.
                  </div>
                ) : (
                  <div
                    style={
                      styles.levelSuccess
                    }
                  >
                    ✓ Microphone signal
                    detected
                  </div>
                )}
              </div>
            )}

            {isRecording && (
              <div
                style={
                  styles.recordingStatus
                }
              >
                <span
                  style={
                    styles.recordingDot
                  }
                />

                Recording...

                <strong>
                  {formatTime(
                    recordingTime
                  )}
                </strong>
              </div>
            )}
          </div>

          {/* SELECTED AUDIO */}
          {selectedFile && audioUrl && (
            <div
              style={
                styles.audioSection
              }
            >
              <div
                style={
                  styles.fileBox
                }
              >
                <div
                  style={
                    styles.fileIcon
                  }
                >
                  <Volume2
                    size={24}
                  />
                </div>

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <div
                    style={
                      styles.fileName
                    }
                  >
                    {selectedFile.name}
                  </div>

                  <div
                    style={
                      styles.fileSize
                    }
                  >
                    {(
                      selectedFile.size /
                      1024
                    ).toFixed(1)}{" "}
                    KB
                  </div>
                </div>

                <CheckCircle
                  size={24}
                  color="#16a34a"
                />
              </div>

              <audio
                ref={
                  audioPreviewRef
                }
                src={audioUrl}
                controls
                style={
                  styles.audioPlayer
                }
              />

              <div
                style={
                  styles.playHint
                }
              >
                <Play size={16} />
                Play the recording
                above and confirm
                that your voice is
                audible before
                processing.
              </div>
            </div>
          )}

          {/* TARGET LANGUAGE */}
          <div
            style={
              styles.languageSection
            }
          >
            <label
              style={styles.label}
            >
              <Languages
                size={20}
              />
              Translate to
            </label>

            <select
              value={targetLanguage}
              onChange={(event) =>
                setTargetLanguage(
                  event.target.value
                )
              }
              style={styles.select}
            >
              {LANGUAGES.map(
                (language) => (
                  <option
                    key={
                      language.code
                    }
                    value={
                      language.code
                    }
                  >
                    {language.name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* PROCESS */}
          <button
            onClick={
              processAudio
            }
            disabled={
              !selectedFile ||
              isRecording
            }
            style={{
              ...styles.processButton,
              opacity:
                !selectedFile ||
                isRecording
                  ? 0.55
                  : 1,
              cursor:
                !selectedFile ||
                isRecording
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            <Languages
              size={21}
            />

            {mode ===
            "audio-to-text"
              ? "Transcribe & Translate"
              : "Translate Audio"}
          </button>

          {/* STATUS */}
          {status && (
            <div
              style={
                styles.successBox
              }
            >
              <CheckCircle
                size={21}
              />
              {status}
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div
              style={
                styles.errorBox
              }
            >
              <AlertCircle
                size={21}
              />
              {error}
            </div>
          )}

          {/* DETECTED */}
          {detectedLanguage && (
            <div
              style={
                styles.resultBox
              }
            >
              <div
                style={
                  styles.resultLabel
                }
              >
                DETECTED LANGUAGE
              </div>

              <div
                style={
                  styles.resultValue
                }
              >
                {detectedLanguage}
              </div>
            </div>
          )}

          {/* TRANSCRIBED */}
          {transcribedText && (
            <div
              style={
                styles.resultBox
              }
            >
              <div
                style={
                  styles.resultLabel
                }
              >
                TRANSCRIBED TEXT
              </div>

              <div
                style={
                  styles.resultText
                }
              >
                {transcribedText}
              </div>
            </div>
          )}

          {/* TRANSLATED */}
          {translatedText && (
            <div
              style={
                styles.resultBox
              }
            >
              <div
                style={
                  styles.resultLabel
                }
              >
                TRANSLATED TEXT
              </div>

              <div
                style={
                  styles.resultText
                }
              >
                {translatedText}
              </div>
            </div>
          )}

          {/* OUTPUT AUDIO */}
          {outputAudioUrl && (
            <div
              style={
                styles.resultBox
              }
            >
              <div
                style={
                  styles.resultLabel
                }
              >
                GENERATED AUDIO
              </div>

              <audio
                src={
                  outputAudioUrl
                }
                controls
                style={
                  styles.audioPlayer
                }
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f8ff",
    color: "#14213d",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
  },

  header: {
    height: "118px",
    background: "#ffffff",
    borderBottom:
      "1px solid #e5eaf2",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 54px",
    boxSizing: "border-box",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },

  logo: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    background: "#2f6fed",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "38px",
    fontWeight: 800,
  },

  brandName: {
    fontSize: "30px",
    fontWeight: 800,
    lineHeight: 1,
  },

  brandSubtitle: {
    marginTop: "8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "3px",
  },

  dashboardButton: {
    border: "none",
    background: "#eef4ff",
    color: "#2867df",
    borderRadius: "15px",
    padding: "18px 26px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "18px",
    fontWeight: 700,
    cursor: "pointer",
  },

  main: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "58px 40px 80px",
  },

  headingArea: {
    marginBottom: "38px",
  },

  title: {
    margin: 0,
    fontSize: "44px",
    fontWeight: 800,
    letterSpacing: "-1px",
  },

  description: {
    marginTop: "16px",
    marginBottom: 0,
    color: "#64748b",
    fontSize: "20px",
    lineHeight: 1.6,
  },

  card: {
    background: "#ffffff",
    border:
      "1px solid #e1e8f2",
    borderRadius: "24px",
    padding: "48px",
    boxShadow:
      "0 15px 45px rgba(30, 64, 175, 0.08)",
  },

  uploadBox: {
    border:
      "2px dashed #c9d8ee",
    borderRadius: "22px",
    padding: "48px 30px",
    textAlign: "center",
    background: "#fbfdff",
  },

  uploadTitle: {
    margin: "18px 0 8px",
    fontSize: "24px",
    fontWeight: 800,
  },

  uploadText: {
    margin: "0 0 28px",
    color: "#64748b",
    fontSize: "17px",
  },

  uploadButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "15px 25px",
    background: "#eef4ff",
    color: "#2f6fed",
    borderRadius: "12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "16px",
  },

  orText: {
    margin: "20px 0",
    color: "#94a3b8",
    fontWeight: 700,
  },

  microphoneArea: {
    maxWidth: "620px",
    margin: "0 auto 22px",
    textAlign: "left",
  },

  microphoneLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    color: "#334155",
    fontSize: "15px",
    fontWeight: 700,
  },

  microphoneSelect: {
    width: "100%",
    padding: "13px 15px",
    border:
      "1px solid #d5dfec",
    borderRadius: "12px",
    background: "#ffffff",
    fontSize: "15px",
    color: "#14213d",
    outline: "none",
  },

  recordButton: {
    border: "none",
    background: "#2f6fed",
    color: "#ffffff",
    borderRadius: "13px",
    padding: "16px 28px",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "17px",
    fontWeight: 800,
    cursor: "pointer",
  },

  stopButton: {
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: "13px",
    padding: "16px 28px",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "17px",
    fontWeight: 800,
    cursor: "pointer",
  },

  levelContainer: {
    maxWidth: "620px",
    margin: "24px auto 0",
    textAlign: "left",
  },

  levelHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    color: "#475569",
    fontSize: "14px",
    fontWeight: 700,
  },

  levelTrack: {
    height: "12px",
    background: "#e2e8f0",
    borderRadius: "20px",
    overflow: "hidden",
  },

  levelFill: {
    height: "100%",
    background: "#2f6fed",
    borderRadius: "20px",
    transition: "width 80ms linear",
  },

  levelWarning: {
    marginTop: "9px",
    color: "#b45309",
    fontSize: "13px",
  },

  levelSuccess: {
    marginTop: "9px",
    color: "#15803d",
    fontSize: "13px",
  },

  recordingStatus: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "9px",
    color: "#dc2626",
    fontSize: "16px",
  },

  recordingDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#dc2626",
    display: "inline-block",
  },

  audioSection: {
    marginTop: "30px",
  },

  fileBox: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    padding: "18px 20px",
    border:
      "1px solid #dce5f0",
    borderRadius: "16px",
    background: "#f8fafc",
  },

  fileIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#eef4ff",
    color: "#2f6fed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  fileName: {
    fontSize: "17px",
    fontWeight: 700,
    wordBreak: "break-word",
  },

  fileSize: {
    marginTop: "5px",
    color: "#64748b",
    fontSize: "14px",
  },

  audioPlayer: {
    width: "100%",
    marginTop: "18px",
  },

  playHint: {
    marginTop: "12px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: "#64748b",
    fontSize: "15px",
  },

  languageSection: {
    marginTop: "35px",
  },

  label: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginBottom: "12px",
    fontSize: "18px",
    fontWeight: 800,
  },

  select: {
    width: "100%",
    padding: "17px 18px",
    border:
      "1px solid #d5dfec",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#14213d",
    fontSize: "17px",
    outline: "none",
  },

  processButton: {
    width: "100%",
    marginTop: "30px",
    border: "none",
    background: "#2f6fed",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontSize: "19px",
    fontWeight: 800,
  },

  successBox: {
    marginTop: "22px",
    padding: "18px 20px",
    borderRadius: "14px",
    background: "#ecfdf5",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "16px",
    fontWeight: 600,
  },

  errorBox: {
    marginTop: "22px",
    padding: "18px 20px",
    borderRadius: "14px",
    background: "#fef2f2",
    color: "#b91c1c",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "16px",
    fontWeight: 600,
  },

  resultBox: {
    marginTop: "22px",
    padding: "22px",
    border:
      "1px solid #dce5f0",
    borderRadius: "16px",
    background: "#fbfdff",
  },

  resultLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "1px",
    marginBottom: "8px",
  },

  resultValue: {
    fontSize: "18px",
    fontWeight: 700,
  },

  resultText: {
    fontSize: "18px",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },
};

export default Audio;