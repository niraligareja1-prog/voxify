import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import {
  User,
  Mail,
  Globe2,
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import "../App.css";


const LANGUAGE_OPTIONS = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "Hindi" },
  { value: "gu-IN", label: "Gujarati" },
  { value: "mr-IN", label: "Marathi" },
  { value: "ta-IN", label: "Tamil" },
];

function Profile() {
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    preferred_language: "en-IN",
    avatar_url: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const getAccessToken = () => {
    return localStorage.getItem("access_token");
  };

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    const accessToken = getAccessToken();

    if (!accessToken) {
      window.location.replace("/pages/login.html");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/profile`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.replace("/pages/login.html");
          return;
        }

        throw new Error(
          result.detail || "Failed to load profile."
        );
      }

      const data = result.data || {};

      setProfile({
        full_name: data.full_name || "",
        email: data.email || "",
        preferred_language:
          data.preferred_language || "en-IN",
        avatar_url: data.avatar_url || "",
      });

      if (data.email) {
        localStorage.setItem("user_email", data.email);
      }

    } catch (err) {
      console.error("PROFILE LOAD ERROR:", err);
      setError(
        err.message || "Failed to load profile."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const accessToken = getAccessToken();

    if (!accessToken) {
      window.location.replace("/pages/login.html");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/profile`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            full_name: profile.full_name.trim(),
            avatar_url: profile.avatar_url.trim(),
            preferred_language:
              profile.preferred_language,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.replace("/pages/login.html");
          return;
        }

        throw new Error(
          result.detail || "Failed to update profile."
        );
      }

      const data = result.data || {};

      setProfile((previous) => ({
        ...previous,
        full_name:
          data.full_name ?? previous.full_name,
        email:
          data.email ?? previous.email,
        avatar_url:
          data.avatar_url ?? previous.avatar_url,
        preferred_language:
          data.preferred_language ??
          previous.preferred_language,
      }));

      if (profile.full_name.trim()) {
        localStorage.setItem(
          "user_name",
          profile.full_name.trim()
        );
      }

      setMessage(
        "Profile updated successfully."
      );

    } catch (err) {
      console.error("PROFILE UPDATE ERROR:", err);

      setError(
        err.message || "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    window.location.href = "/";
  };

  const displayInitial =
    profile.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    profile.email?.charAt(0)?.toUpperCase() ||
    "V";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f8fc",
        color: "#123d6b",
        fontFamily:
          "Inter, Arial, Helvetica, sans-serif",
      }}
    >

      {/* TOPBAR */}

      <header
        style={{
          height: "76px",
          background: "#ffffff",
          borderBottom: "1px solid #e3ebf5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 42px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <button
            type="button"
            onClick={goBack}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              border: "1px solid #dbe7f3",
              background: "#ffffff",
              color: "#176fc4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <div
              style={{
                fontSize: "13px",
                color: "#7d99b7",
                marginBottom: "3px",
              }}
            >
              Account
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 750,
                color: "#123d6b",
              }}
            >
              Profile
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={loadProfile}
          disabled={loading}
          style={{
            border: "1px solid #dbe7f3",
            background: "#ffffff",
            color: "#176fc4",
            borderRadius: "12px",
            padding: "11px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: loading
              ? "default"
              : "pointer",
            fontWeight: 650,
          }}
        >
          <RefreshCw
            size={17}
            style={{
              animation: loading
                ? "profileSpin 1s linear infinite"
                : "none",
            }}
          />
          Refresh
        </button>

      </header>


      {/* CONTENT */}

      <main
        style={{
          maxWidth: "1050px",
          margin: "0 auto",
          padding: "42px 28px 70px",
        }}
      >

        {/* HERO */}

        <section
          style={{
            background:
              "linear-gradient(135deg, #eaf4ff 0%, #ffffff 70%)",
            border: "1px solid #dceaf7",
            borderRadius: "24px",
            padding: "34px",
            marginBottom: "26px",
            display: "flex",
            alignItems: "center",
            gap: "26px",
          }}
        >

          <div
            style={{
              width: "86px",
              height: "86px",
              flexShrink: 0,
              borderRadius: "24px",
              background: "#ffffff",
              border: "1px solid #cfe2f4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#176fc4",
              fontSize: "34px",
              fontWeight: 800,
              boxShadow:
                "0 10px 25px rgba(36, 105, 166, 0.08)",
            }}
          >
            {displayInitial}
          </div>

          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "1.4px",
                color: "#1975c9",
                textTransform: "uppercase",
                marginBottom: "7px",
              }}
            >
              Voxify Account
            </div>

            <h2
              style={{
                margin: "0 0 7px",
                fontSize: "30px",
                color: "#123d6b",
              }}
            >
              {profile.full_name ||
                "Complete your profile"}
            </h2>

            <p
              style={{
                margin: 0,
                color: "#7592af",
                fontSize: "15px",
              }}
            >
              Manage your personal information
              and language preference.
            </p>
          </div>

        </section>


        {/* STATUS */}

        {message && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 17px",
              borderRadius: "13px",
              background: "#ecfbf3",
              border: "1px solid #c8efd9",
              color: "#16804b",
              display: "flex",
              alignItems: "center",
              gap: "9px",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={19} />
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 17px",
              borderRadius: "13px",
              background: "#fff1f1",
              border: "1px solid #ffd0d0",
              color: "#d52c3f",
              display: "flex",
              alignItems: "center",
              gap: "9px",
              fontWeight: 600,
            }}
          >
            <AlertCircle size={19} />
            {error}
          </div>
        )}


        {/* PROFILE CARD */}

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #dfeaf4",
            borderRadius: "22px",
            padding: "32px",
            boxShadow:
              "0 12px 35px rgba(38, 89, 135, 0.06)",
          }}
        >

          <div
            style={{
              marginBottom: "28px",
            }}
          >
            <h2
              style={{
                margin: "0 0 7px",
                fontSize: "21px",
                color: "#123d6b",
              }}
            >
              Personal information
            </h2>

            <p
              style={{
                margin: 0,
                color: "#7895b1",
                fontSize: "14px",
              }}
            >
              Update the information associated
              with your Voxify account.
            </p>
          </div>


          {loading ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#7895b1",
              }}
            >
              Loading profile...
            </div>
          ) : (
            <form onSubmit={handleSave}>

              {/* FULL NAME */}

              <div
                style={{
                  marginBottom: "23px",
                }}
              >
                <label
                  htmlFor="full_name"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#31587c",
                    marginBottom: "9px",
                  }}
                >
                  Full name
                </label>

                <div
                  style={{
                    position: "relative",
                  }}
                >
                  <User
                    size={19}
                    style={{
                      position: "absolute",
                      left: "15px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color: "#7da1c2",
                    }}
                  />

                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={profile.full_name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    maxLength={120}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      height: "50px",
                      borderRadius: "12px",
                      border:
                        "1px solid #d7e4ef",
                      padding:
                        "0 15px 0 45px",
                      outline: "none",
                      fontSize: "15px",
                      color: "#173f65",
                      background: "#fbfdff",
                    }}
                  />
                </div>
              </div>


              {/* EMAIL */}

              <div
                style={{
                  marginBottom: "23px",
                }}
              >
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#31587c",
                    marginBottom: "9px",
                  }}
                >
                  Email address
                </label>

                <div
                  style={{
                    position: "relative",
                  }}
                >
                  <Mail
                    size={19}
                    style={{
                      position: "absolute",
                      left: "15px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color: "#7da1c2",
                    }}
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={profile.email}
                    disabled
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      height: "50px",
                      borderRadius: "12px",
                      border:
                        "1px solid #d7e4ef",
                      padding:
                        "0 15px 0 45px",
                      outline: "none",
                      fontSize: "15px",
                      color: "#6685a2",
                      background: "#f2f6fa",
                      cursor: "not-allowed",
                    }}
                  />
                </div>

                <small
                  style={{
                    display: "block",
                    marginTop: "7px",
                    color: "#8ba2b8",
                    fontSize: "12px",
                  }}
                >
                  Email is managed by your
                  authentication account.
                </small>
              </div>


              {/* LANGUAGE */}

              <div
                style={{
                  marginBottom: "23px",
                }}
              >
                <label
                  htmlFor="preferred_language"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#31587c",
                    marginBottom: "9px",
                  }}
                >
                  Preferred language
                </label>

                <div
                  style={{
                    position: "relative",
                  }}
                >
                  <Globe2
                    size={19}
                    style={{
                      position: "absolute",
                      left: "15px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color: "#7da1c2",
                      pointerEvents: "none",
                    }}
                  />

                  <select
                    id="preferred_language"
                    name="preferred_language"
                    value={
                      profile.preferred_language
                    }
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      height: "50px",
                      borderRadius: "12px",
                      border:
                        "1px solid #d7e4ef",
                      padding:
                        "0 40px 0 45px",
                      outline: "none",
                      fontSize: "15px",
                      color: "#173f65",
                      background: "#fbfdff",
                      cursor: "pointer",
                    }}
                  >
                    {LANGUAGE_OPTIONS.map(
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
                </div>
              </div>


              {/* AVATAR URL */}

              <div
                style={{
                  marginBottom: "30px",
                }}
              >
                <label
                  htmlFor="avatar_url"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#31587c",
                    marginBottom: "9px",
                  }}
                >
                  Avatar URL
                </label>

                <input
                  id="avatar_url"
                  name="avatar_url"
                  type="url"
                  value={profile.avatar_url}
                  onChange={handleChange}
                  placeholder="https://example.com/avatar.jpg"
                  maxLength={1000}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "50px",
                    borderRadius: "12px",
                    border:
                      "1px solid #d7e4ef",
                    padding: "0 15px",
                    outline: "none",
                    fontSize: "15px",
                    color: "#173f65",
                    background: "#fbfdff",
                  }}
                />
              </div>


              {/* ACTIONS */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  borderTop:
                    "1px solid #edf2f7",
                  paddingTop: "24px",
                }}
              >

                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    height: "46px",
                    padding: "0 20px",
                    borderRadius: "11px",
                    border:
                      "1px solid #d6e3ee",
                    background: "#ffffff",
                    color: "#557695",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    height: "46px",
                    padding: "0 22px",
                    borderRadius: "11px",
                    border: "none",
                    background: saving
                      ? "#8bbce8"
                      : "#1976d2",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: saving
                      ? "default"
                      : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                  }}
                >
                  <Save size={18} />

                  {saving
                    ? "Saving..."
                    : "Save changes"}
                </button>

              </div>

            </form>
          )}

        </section>

      </main>


      {/* SMALL ANIMATION */}

      <style>
        {`
          @keyframes profileSpin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 700px) {
            header {
              padding-left: 18px !important;
              padding-right: 18px !important;
            }

            main {
              padding-left: 16px !important;
              padding-right: 16px !important;
            }
          }
        `}
      </style>

    </div>
  );
}

export default Profile;
