import { useEffect, useState } from "react";
import {
  History as HistoryIcon,
  Languages,
  FileText,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Clock3,
} from "lucide-react";

import "../App.css";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const historyType = (item) => {
    const name = (item?.file_name || item?.original_file_name || "").toLowerCase();
    const text = (item?.original_text || "").toLowerCase();

    if (item?.content_type === "pdf" || name.endsWith(".pdf")) return "PDF";
    if (item?.content_type === "audio" || name.match(/\.(mp3|wav|m4a|ogg|webm|flac|aac)$/)) return "Audio";
    if (item?.content_type === "text" || name.endsWith(".txt") || text) return "Text";
    return "Translation";
  };

  const getToken = () => {
    return localStorage.getItem("access_token");
  };

  const loadHistory = async () => {
    const token = getToken();

    if (!token) {
      window.location.replace("/pages/login.html");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/history`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data?.error?.message || "Failed to load history."
        );
      }

      setHistory(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("HISTORY LOAD ERROR:", err);
      setError(err.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const syncLatestTranslation = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    const latestText =
      localStorage.getItem("voxify_latest_translation");

    if (!latestText) {
      return;
    }

    try {
      const payload = JSON.parse(latestText);

      if (
        !payload?.original_text ||
        !payload?.translated_text ||
        !payload?.source_language ||
        !payload?.target_language
      ) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/history`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        localStorage.removeItem("voxify_latest_translation");
        await loadHistory();
      }
    } catch (syncError) {
      console.warn(
        "HISTORY SYNC ERROR:",
        syncError
      );
    }
  };

  const deleteHistory = async (historyId) => {
    const token = getToken();

    if (!token) {
      window.location.replace("/pages/login.html");
      return;
    }

    setDeletingId(historyId);

    try {
      const response = await fetch(
        `${API_BASE_URL}/history/${historyId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data?.error?.message || "Failed to delete history."
        );
      }

      setHistory((previous) =>
        previous.filter((item) => item.id !== historyId)
      );
    } catch (err) {
      console.error("HISTORY DELETE ERROR:", err);
      setError(err.message || "Failed to delete history.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "Unknown date";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const languageName = (language) => {
    const languages = {
      "en-IN": "English",
      "hi-IN": "Hindi",
      "gu-IN": "Gujarati",
      "mr-IN": "Marathi",
      "ta-IN": "Tamil",
      en: "English",
      hi: "Hindi",
      gu: "Gujarati",
      mr: "Marathi",
      ta: "Tamil",
    };

    return languages[language] || language || "Unknown";
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">V</div>

          <div>
            <div className="brand-name">Voxify</div>
            <div className="brand-subtitle">
              AI CONTENT PLATFORM
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-title">WORKSPACE</div>

            <button
              className="nav-item"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              <Languages size={20} />
              <span>Dashboard</span>
            </button>

            <button
              className="nav-item"
              onClick={() => {
                window.location.href =
                  "/pages/text-translation.html";
              }}
            >
              <FileText size={20} />
              <span>Translation</span>
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-title">LIBRARY</div>

            <button className="nav-item active">
              <HistoryIcon size={20} />
              <span>History</span>
            </button>

            <button
              className="nav-item"
              onClick={() => {
                window.location.href =
                  "/pages/downloads.html";
              }}
            >
              <FileText size={20} />
              <span>Downloads</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => {
              window.location.href = "/pages/settings.html";
            }}
          >
            <Languages size={20} />
            <span>Settings</span>
          </button>

          <div className="account-card">
            <div className="avatar">V</div>

            <div className="account-info">
              <strong>
                {localStorage.getItem("user_email") ||
                  "User Account"}
              </strong>

              <span>Free Plan</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Library</span>
            <span>›</span>
            <strong>History</strong>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              onClick={loadHistory}
              disabled={loading}
            >
              <RefreshCw size={17} />
              Refresh
            </button>

            <div className="profile-avatar">V</div>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="eyebrow">
            <HistoryIcon size={16} />
            LIBRARY / HISTORY
          </div>

          <section className="hero-section">
            <div className="hero-copy">
              <h1>
                Translation
                <br />
                <span>History.</span>
              </h1>

              <p>
                View your previous translations and processed
                content.
              </p>
            </div>

            <div className="language-card">
              <div className="language-icon">
                <HistoryIcon size={30} />
              </div>

              <h2>{history.length}</h2>

              <p>
                {history.length === 1
                  ? "Saved translation"
                  : "Saved translations"}
              </p>
            </div>
          </section>

          <section className="section-block">
            <div className="section-header">
              <div>
                <h2>Recent translations</h2>
                <p>Your saved translation activity</p>
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: "14px 16px",
                  marginBottom: "18px",
                  borderRadius: "12px",
                  background: "#fff1f2",
                  color: "#be123c",
                  border: "1px solid #fecdd3",
                }}
              >
                {error}
              </div>
            )}

            {loading ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <RefreshCw size={26} />
                </div>

                <h3>Loading history...</h3>

                <p>
                  Fetching your saved translations from Voxify.
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <HistoryIcon size={26} />
                </div>

                <h3>No history yet</h3>

                <p>
                  Your completed translations will appear here.
                </p>

                <button
                  className="secondary-button"
                  onClick={() => {
                    window.location.href =
                      "/text-translation";
                  }}
                >
                  Start translating
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {history.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e8ebf2",
                      borderRadius: "16px",
                      padding: "20px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "20px",
                      boxShadow:
                        "0 4px 18px rgba(20, 25, 45, 0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div className="empty-icon">
                        <Languages size={22} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong>
                            {languageName(
                              item.source_language
                            )}
                          </strong>

                          <span>→</span>

                          <strong>
                            {languageName(
                              item.target_language
                            )}
                          </strong>

                          <span
                            style={{
                              fontSize: "11px",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "#f1f5f9",
                              color: "#334155",
                              fontWeight: 700,
                            }}
                          >
                            {historyType(item)}
                          </span>

                          <span
                            style={{
                              fontSize: "12px",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "#eef2ff",
                              color: "#4f46e5",
                            }}
                          >
                            {item.status || "completed"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <small
                              style={{
                                display: "block",
                                color: "#8a91a4",
                                marginBottom: "5px",
                              }}
                            >
                              Original
                            </small>

                            <div
                              style={{
                                color: "#303747",
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                              }}
                            >
                              {item.original_text || "—"}
                            </div>
                          </div>

                          <div>
                            <small
                              style={{
                                display: "block",
                                color: "#8a91a4",
                                marginBottom: "5px",
                              }}
                            >
                              Translation
                            </small>

                            <div
                              style={{
                                color: "#303747",
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                              }}
                            >
                              {item.translated_text || "—"}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginTop: "12px",
                            color: "#8a91a4",
                            fontSize: "12px",
                          }}
                        >
                          <Clock3 size={14} />

                          {formatDate(item.created_at)}
                        </div>
                      </div>
                    </div>

                    <button
                      className="icon-button"
                      title="Delete history"
                      onClick={() =>
                        deleteHistory(item.id)
                      }
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <RefreshCw size={18} />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button
            className="secondary-button"
            style={{ marginTop: "20px" }}
            onClick={() => {
              window.location.href = "/";
            }}
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}

export default History;