import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Languages,
  FileText,
  Mic2,
  Image,
  History,
  Download,
  Settings,
  Bell,
  Search,
  ArrowUpRight,
  Globe2,
  FileCheck2,
  Clock3,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Volume2,
  FileAudio,
  FileSearch,
  ScanText,
} from "lucide-react";

import TextToAudio from "./pages/TextToAudio";
import TextTranslation from "./pages/TextTranslation";
import Audio from "./pages/Audio";
import HistoryPage from "./pages/History";
import Profile from "./pages/Profile";

import { getTranslations } from "./i18n";

import "./App.css";


/* =========================================================
   API
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";


/* =========================================================
   GREETING
========================================================= */

function getGreetingKey() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "goodMorning";
  }

  if (hour >= 12 && hour < 17) {
    return "goodAfternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "goodEvening";
  }

  return "goodNight";
}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function goToPage(page, mode = "") {
  if (mode === "text-to-text") {
    window.location.href = "/text-translation";
    return;
  }

  if (mode === "text-to-audio") {
    window.location.href = "/text-to-audio";
    return;
  }

  if (mode === "audio-to-audio") {
    window.location.href = "/audio-to-audio";
    return;
  }

  const url = mode
    ? `/pages/${page}?mode=${encodeURIComponent(mode)}`
    : `/pages/${page}`;

  window.location.href = url;
}


/* =========================================================
   APP
========================================================= */

function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [translationOpen, setTranslationOpen] = useState(true);

  const [language, setLanguage] = useState(
    localStorage.getItem("preferred_language") || "en-IN"
  );

  const [greetingKey, setGreetingKey] = useState(
    getGreetingKey()
  );


  /* =======================================================
     TRANSLATIONS
  ======================================================= */

  const t = getTranslations(language);


  /* =======================================================
     AUTH + PROFILE LANGUAGE
  ======================================================= */

  useEffect(() => {
    const accessToken =
      localStorage.getItem("access_token");

    if (!accessToken) {
      window.location.replace("/pages/login.html");
      return;
    }

    setCheckingAuth(false);


    /*
     * First use the language already stored locally.
     * This makes the UI load immediately.
     */

    const savedLanguage =
      localStorage.getItem("preferred_language");

    if (savedLanguage) {
      setLanguage(savedLanguage);
    }


    /*
     * Then fetch the real preference from Supabase
     * through the Voxify backend.
     */

    const loadProfileLanguage = async () => {
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

        if (!response.ok) {
          return;
        }

        const result = await response.json();

        const profile =
          result?.data || null;

        const preferredLanguage =
          profile?.preferred_language;

        if (preferredLanguage) {
          localStorage.setItem(
            "preferred_language",
            preferredLanguage
          );

          setLanguage(preferredLanguage);
        }
      } catch (error) {
        console.error(
          "PROFILE LANGUAGE LOAD ERROR:",
          error
        );
      }
    };


    loadProfileLanguage();


    /*
     * Greeting refresh.
     */

    const updateGreeting = () => {
      setGreetingKey(getGreetingKey());
    };

    updateGreeting();

    const timer = setInterval(
      updateGreeting,
      60000
    );

    return () => clearInterval(timer);
  }, []);


  /* =======================================================
     AUTH LOADING
  ======================================================= */

  if (checkingAuth) {
    return null;
  }


  /* =======================================================
     REACT PAGES
  ======================================================= */

  if (window.location.pathname === "/text-to-audio") {
    return <TextToAudio />;
  }

  if (window.location.pathname === "/text-translation") {
    return <TextTranslation />;
  }

  if (window.location.pathname === "/audio-to-audio") {
    return <Audio />;
  }

  if (window.location.pathname === "/history") {
    return <HistoryPage />;
  }

  if (window.location.pathname === "/profile") {
    return <Profile />;
  }


  /* =======================================================
     DASHBOARD STATS
  ======================================================= */

  const stats = [
    {
      label: t.totalTranslations,
      value: "0",
      note: t.allTime,
      icon: Languages,
      type: "purple",
    },
    {
      label: t.filesProcessed,
      value: "0",
      note: t.thisMonth,
      icon: FileCheck2,
      type: "violet",
    },
    {
      label: t.processingTime,
      value: "0m",
      note: t.totalUsage,
      icon: Clock3,
      type: "green",
    },
    {
      label: t.languages,
      value: "5",
      note: t.supported,
      icon: Globe2,
      type: "orange",
    },
  ];


  /* =======================================================
     TRANSLATION SIDEBAR
  ======================================================= */

  const translationOptions = [
    {
      name: t.textTranslation,
      icon: FileText,
      page: "text-translation.html",
      mode: "text-to-text",
    },
    {
      name: t.audioTranslation,
      icon: Mic2,
      page: "audio.html",
    },
    {
      name: t.pdfTranslation,
      icon: FileText,
      page: "pdf.html",
    },
    {
      name: t.imageTranslation,
      icon: Image,
      page: "image.html",
    },
  ];


  /* =======================================================
     ALL VOXIFY FEATURES
  ======================================================= */

  const features = [
    {
      name: t.textToText,
      icon: Languages,
      description:
        "Translate written text between supported languages.",
      page: "text-translation.html",
      mode: "text-to-text",
    },
    {
      name: t.textToAudio,
      icon: Volume2,
      description:
        "Translate text and convert the translated result into audio.",
      page: "text-translation.html",
      mode: "text-to-audio",
    },
    {
      name: t.audioToText,
      icon: FileAudio,
      description:
        "Convert spoken audio into translated text.",
      page: "audio.html",
      mode: "audio-to-text",
    },
    {
      name: t.audioToAudio,
      icon: Mic2,
      description:
        "Translate spoken audio into another language's audio.",
      page: "audio.html",
      mode: "audio-to-audio",
    },
    {
      name: t.pdfTranslation,
      icon: FileText,
      description:
        "Upload a PDF and translate its content.",
      page: "pdf.html",
      mode: "pdf-translation",
    },
    {
      name: t.pdfSummarise,
      icon: FileSearch,
      description:
        "Upload a PDF and generate a concise summary.",
      page: "pdf-summarise.html",
      mode: "",
    },
    {
      name: t.imageTranslation,
      icon: ScanText,
      description:
        "Extract text from an image and translate it.",
      page: "image.html",
      mode: "image-translation",
    },
    {
      name: t.imageSummarise,
      icon: Image,
      description:
        "Process an image and generate a useful summary.",
      page: "image.html",
      mode: "image-summarise",
    },
  ];


  /* =======================================================
     USER
  ======================================================= */

  const userEmail =
    localStorage.getItem("user_email") ||
    "User Account";


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app-shell">

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside className="sidebar">

        {/* BRAND */}

        <div className="brand">

          <div className="brand-logo">
            V
          </div>

          <div>
            <div className="brand-name">
              Voxify
            </div>

            <div className="brand-subtitle">
              AI CONTENT PLATFORM
            </div>
          </div>

        </div>


        {/* NAVIGATION */}

        <nav className="sidebar-nav">

          {/* WORKSPACE */}

          <div className="nav-section">

            <div className="nav-title">
              {t.workspace}
            </div>


            {/* DASHBOARD */}

            <button
              className="nav-item active"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              <LayoutDashboard size={20} />

              <span>
                {t.dashboard}
              </span>
            </button>


            {/* TRANSLATION */}

            <button
              className="nav-item"
              onClick={() => {
                setTranslationOpen(
                  (previous) => !previous
                );
              }}
            >
              <Languages size={20} />

              <span>
                {t.translation}
              </span>

              <ChevronDown
                size={17}
                style={{
                  marginLeft: "auto",
                  transform: translationOpen
                    ? "rotate(0deg)"
                    : "rotate(-90deg)",
                  transition:
                    "transform 0.2s ease",
                }}
              />
            </button>


            {/* TRANSLATION SUBMENU */}

            {translationOpen && (
              <div className="translation-submenu">

                {translationOptions.map(
                  (option) => {

                    const Icon =
                      option.icon;

                    return (
                      <button
                        key={option.name}
                        className="translation-subitem"
                        onClick={() =>
                          goToPage(
                            option.page,
                            option.mode || ""
                          )
                        }
                      >

                        <Icon size={17} />

                        <span>
                          {option.name}
                        </span>

                      </button>
                    );
                  }
                )}

              </div>
            )}

          </div>


          {/* LIBRARY */}

          <div className="nav-section">

            <div className="nav-title">
              {t.library}
            </div>


            {/* HISTORY */}

            <button
              className="nav-item"
              onClick={() => {
                window.location.href =
                  "/history";
              }}
            >
              <History size={20} />

              <span>
                {t.history}
              </span>

            </button>


            {/* DOWNLOADS */}

            <button
              className="nav-item"
              onClick={() =>
                goToPage("downloads.html")
              }
            >
              <Download size={20} />

              <span>
                {t.downloads}
              </span>

            </button>

          </div>

        </nav>


        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          {/* SETTINGS */}

          <button
            className="nav-item"
            onClick={() =>
              goToPage("settings.html")
            }
          >
            <Settings size={20} />

            <span>
              {t.settings}
            </span>

          </button>


          {/* PROFILE */}

          <button
            type="button"
            className="account-card"
            onClick={() => {
              window.location.href =
                "/profile";
            }}
            style={{
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
            title={t.profile}
          >

            <div className="avatar">
              V
            </div>

            <div className="account-info">

              <strong>
                {userEmail}
              </strong>

              <span>
                Free Plan
              </span>

            </div>

            <ChevronRight size={18} />

          </button>

        </div>

      </aside>


      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">

          <div className="breadcrumb">

            <span>
              {t.workspace}
            </span>

            <ChevronRight size={16} />

            <strong>
              {t.dashboard}
            </strong>

          </div>


          <div className="topbar-actions">

            {/* SEARCH */}

            <div className="search-box">

              <Search size={19} />

              <input
                placeholder="Search anything..."
              />

              <span className="shortcut">
                ⌘ K
              </span>

            </div>


            {/* NOTIFICATION */}

            <button className="icon-button">

              <Bell size={20} />

              <span className="notification-dot" />

            </button>


            {/* PROFILE */}

            <button
              type="button"
              className="profile-avatar"
              onClick={() => {
                window.location.href =
                  "/profile";
              }}
              style={{
                cursor: "pointer",
              }}
              title={t.profile}
            >
              V
            </button>

          </div>

        </header>


        {/* DASHBOARD */}

        <div className="dashboard-content">

          {/* EYEBROW */}

          <div className="eyebrow">

            <Sparkles size={16} />

            {t.dashboard} / {t.overview}

          </div>


          {/* HERO */}

          <section className="hero-section">

            <div className="hero-copy">

              <h1>

                {t[greetingKey]}

                <br />

                <span>
                  Welcome to Voxify.
                </span>

              </h1>

              <p>
                Everything you need to translate
                and process
                <br />
                multilingual content in one
                powerful workspace.
              </p>


              <button
                className="primary-button"
                onClick={() =>
                  goToPage(
                    "text-translation.html",
                    "text-to-text"
                  )
                }
              >

                {t.startTranslation}

                <ArrowUpRight size={19} />

              </button>

            </div>


            {/* LANGUAGE CARD */}

            <div className="language-card">

              <div className="language-icon">

                <Globe2 size={30} />

              </div>

              <h2>
                {t.multilingualAI}
              </h2>

              <p>
                {t.translateContent}
              </p>

              <div className="language-list">

                <span>EN</span>
                <span>GU</span>
                <span>HI</span>
                <span>MR</span>
                <span>TA</span>

              </div>

            </div>

          </section>


          {/* STATS */}

          <section className="stats-grid">

            {stats.map((stat) => {

              const Icon = stat.icon;

              return (
                <div
                  className="stat-card"
                  key={stat.label}
                >

                  <div
                    className={`stat-icon ${stat.type}`}
                  >
                    <Icon size={21} />
                  </div>

                  <div className="stat-info">

                    <span>
                      {stat.label}
                    </span>

                    <strong>
                      {stat.value}
                    </strong>

                    <small>
                      {stat.note}
                    </small>

                  </div>

                </div>
              );
            })}

          </section>


          {/* FEATURES */}

          <section className="section-block">

            <div className="section-header">

              <div>

                <h2>
                  {t.voxifyFeatures}
                </h2>

                <p>
                  {t.chooseProcess}
                </p>

              </div>


              <button
                className="view-all"
                onClick={() =>
                  goToPage(
                    "text-translation.html",
                    "text-to-text"
                  )
                }
              >

                {t.startTranslating}

                <ArrowUpRight size={16} />

              </button>

            </div>


            {/* FEATURE CARDS */}

            <div className="tools-grid">

              {features.map((feature) => {

                const Icon = feature.icon;

                return (
                  <button
                    className="tool-card"
                    key={feature.name}
                    onClick={() => {

                      if (
                        feature.name ===
                        t.pdfSummarise
                      ) {
                        window.location.href =
                          "/pages/pdf-summarise.html";

                        return;
                      }

                      goToPage(
                        feature.page,
                        feature.mode || ""
                      );

                    }}
                  >

                    <div className="tool-icon">

                      <Icon size={23} />

                    </div>


                    <div className="tool-content">

                      <h3>
                        {feature.name}
                      </h3>

                      <p>
                        {feature.description}
                      </p>

                    </div>


                    <ArrowUpRight
                      className="tool-arrow"
                      size={18}
                    />

                  </button>
                );

              })}

            </div>

          </section>


          {/* RECENT ACTIVITY */}

          <section className="section-block">

            <div className="section-header">

              <div>

                <h2>
                  {t.recentActivity}
                </h2>

                <p>
                  {t.latestTranslations}
                </p>

              </div>

            </div>


            <div className="empty-state">

              <div className="empty-icon">

                <History size={26} />

              </div>

              <h3>
                {t.noActivity}
              </h3>

              <p>
                {t.startFirstTranslation}
              </p>


              <button
                className="secondary-button"
                onClick={() =>
                  goToPage(
                    "text-translation.html",
                    "text-to-text"
                  )
                }
              >

                {t.startTranslating}

                <ArrowUpRight size={17} />

              </button>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

export default App;