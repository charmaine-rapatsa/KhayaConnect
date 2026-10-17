import { loginWithCsrf } from "../api/auth";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import "../styles/CHWLogin.css";
import "../styles/login-feedback.css";

import chwStaff from "../assets/chw.png";
import elderlyVoice from "../assets/Elderly voice.m4a";
import { getLoginErrorMessage, getMissingLoginMessage, LOGIN_MESSAGES, speakLoginFeedback } from "./loginFeedback";

function CHWLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginFeedbackType, setLoginFeedbackType] = useState("error");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const voiceRef = useRef(null);

  const navigate = useNavigate();

  const showLoginFeedback = (message, type = "error") => {
    voiceRef.current?.pause();
    if (voiceRef.current) voiceRef.current.currentTime = 0;
    setLoginFeedbackType(type);
    setLoginError(message);
    return speakLoginFeedback(message, "chw");
  };

  const playInstructions = () => {
    if (!voiceRef.current) voiceRef.current = new Audio(elderlyVoice);
    voiceRef.current.currentTime = 0;
    voiceRef.current.play().catch((error) => {
      console.log("Audio playback error:", error);
    });
  };

  // =========================
  // LOGIN
  // =========================

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");

    const missingMessage = getMissingLoginMessage(phone, password);
    if (missingMessage) {
      showLoginFeedback(missingMessage);
      return;
    }

    try {
      setIsLoggingIn(true);
      const data = await loginWithCsrf(phone.trim(), password, "chw");

      if (data.role !== "chw") {
        throw Object.assign(new Error(), { status: 401 });
      }

      localStorage.setItem("khayaConnectUser", JSON.stringify(data));
      const announcement = showLoginFeedback(LOGIN_MESSAGES.success, "success");
      await Promise.all([announcement, new Promise((resolve) => window.setTimeout(resolve, 700))]);
      navigate("/dashboard/chw");
    } catch (error) {
      console.error("CHW login error:", error);
      showLoginFeedback(getLoginErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="chw-login-page">

      {/* =========================
          BACK BUTTON
          ========================= */}

      <motion.button
        className="chw-back-button"
        onClick={() => navigate("/")}
        whileHover={{
          x: -3,
        }}
        whileTap={{
          scale: 0.97,
        }}
      >
        ← Back to role selection
      </motion.button>


      {/* =========================
          LEFT STUDIO SECTION
          ========================= */}

      <section className="chw-login-welcome">

        <div className="chw-login-content">

          <p className="chw-login-brand">
            KHAYACONNECT
          </p>

          <h1>
            Welcome back.
          </h1>

          <p className="chw-login-message">
            Manage your visits, tasks and
            community support.
          </p>

        </div>


        {/* =========================
            CHW CHARACTER
            ========================= */}

        <motion.div
          className="chw-login-character"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
          }}
        >

          <img
            src={chwStaff}
            alt="KhayaConnect community health worker"
          />

        </motion.div>

      </section>


      {/* =========================
          RIGHT FORM SECTION
          ========================= */}

      <section className="chw-login-form-section">

        <div className="chw-login-card">

          {/* =========================
              ROLE
              ========================= */}

          <p className="chw-login-role">
            COMMUNITY HEALTH WORKER
          </p>


          {/* =========================
              TITLE
              ========================= */}

          <h2>
            Sign in
          </h2>

          <p className="chw-login-subtitle">
            Enter your details to continue.
          </p>


          {/* =========================
              PHONE NUMBER
              ========================= */}

          <form onSubmit={handleLogin}>

      <div className="chw-form-group">

            <label htmlFor="chw-phone">
              Phone Number
            </label>

            <input
              id="chw-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter your phone number"
              autoComplete="tel"
            />

          </div>


          {/* =========================
              PASSWORD
              ========================= */}

          

      <div className="chw-form-group">

            <label htmlFor="chw-password">
              Password
            </label>

            <div className="chw-password-wrapper">

              <input
                id="chw-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="chw-password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>

            </div>

          </div>


          {/* =========================
              FORGOT PASSWORD
              ========================= */}

          {loginError && <p className={`login-feedback ${loginFeedbackType}`} role={loginFeedbackType === "error" ? "alert" : "status"} aria-live={loginFeedbackType === "error" ? "assertive" : "polite"}>{loginError}</p>}

          <button
            type="button"
            className="chw-forgot-password"
            onClick={() => navigate("/forgot-password?role=chw")}
          >
            Forgot your password?
          </button>


          {/* =========================
              LOGIN BUTTON
              ========================= */}

          <motion.button
            type="submit"
            className="chw-login-button"
            disabled={isLoggingIn}
            whileHover={{
              scale: 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
          >
            {isLoggingIn ? "Signing in..." : "Log In"}
          </motion.button>


      </form>

          {/* =========================
              VOICE HELP
              ========================= */}

          <button
            type="button"
            className="chw-help-button"
            onClick={playInstructions}
            aria-label="Hear login instructions"
          >
            🔊 Hear instructions
          </button>

        </div>

      </section>

    </div>
  );
}

export default CHWLogin;

