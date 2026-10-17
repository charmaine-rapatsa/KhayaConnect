import { loginWithCsrf } from "../api/auth";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import "../styles/ElderlyLogin.css";
import "../styles/login-feedback.css";

import elderlyUser from "../assets/elderly-user.png";
import elderlyVoice from "../assets/Elderly voice.m4a";
import { getLoginErrorMessage, getMissingLoginMessage, LOGIN_MESSAGES, speakLoginFeedback } from "./loginFeedback";

function ElderlyLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginFeedbackType, setLoginFeedbackType] = useState("error");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navigate = useNavigate();

  const voiceRef = useRef(null);

  const showLoginFeedback = (message, type = "error") => {
    voiceRef.current?.pause();
    if (voiceRef.current) voiceRef.current.currentTime = 0;
    setLoginFeedbackType(type);
    setLoginError(message);
    return speakLoginFeedback(message, "elderly");
  };

  const playInstructions = () => {
    if (!voiceRef.current) {
      voiceRef.current = new Audio(elderlyVoice);
    }

    voiceRef.current.currentTime = 0;

    voiceRef.current.play().catch((error) => {
      console.log("Audio playback error:", error);
    });
  };

  const handleLogin = async () => {
    setLoginError("");

    const missingMessage = getMissingLoginMessage(phone, password);
    if (missingMessage) {
      showLoginFeedback(missingMessage);
      return;
    }

    setIsLoggingIn(true);

    try {
      const data = await loginWithCsrf(phone.trim(), password, "elderly");
      if (data.role !== "elderly") throw Object.assign(new Error(), { status: 401 });

      localStorage.setItem(
        "khayaConnectUser",
        JSON.stringify(data)
      );

      const announcement = showLoginFeedback(LOGIN_MESSAGES.success, "success");
      await Promise.all([announcement, new Promise((resolve) => window.setTimeout(resolve, 700))]);
      navigate("/dashboard/elderly");
    } catch (error) {
      console.error("Login error:", error);

      showLoginFeedback(getLoginErrorMessage(error));
    }

    setIsLoggingIn(false);
  };

  return (
    <div className="elderly-login-page">

      {/* =========================
          BACK BUTTON
          ========================= */}

      <motion.button
        className="back-button"
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
          LEFT SIDE
          ========================= */}

      <section className="elderly-login-welcome">

        <p className="elderly-login-brand">
          KHAYACONNECT
        </p>

        <h1>
          Welcome back.
        </h1>

        <p className="elderly-login-message">
          Let's get you connected to your care,
          appointments and loved ones.
        </p>


        {/* ELDERLY CHARACTER */}

        <motion.div
          className="elderly-login-character"
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
            src={elderlyUser}
            alt="KhayaConnect elderly user"
          />
        </motion.div>

      </section>


      {/* =========================
          RIGHT SIDE
          ========================= */}

      <section className="elderly-login-form-section">

        <div className="elderly-login-card">

          {/* ROLE */}

          <p className="elderly-login-role">
            ELDERLY USER
          </p>


          {/* TITLE */}

          <h2>
            Sign in
          </h2>

          <p className="elderly-login-subtitle">
            Enter your details to continue.
          </p>


          {/* =========================
              PHONE NUMBER
              ========================= */}

          <div className="elderly-form-group">

            <label htmlFor="phone">
              Phone Number
            </label>

            <input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              autoComplete="tel"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
            />

          </div>


          {/* =========================
              PASSWORD
              ========================= */}

          <div className="elderly-form-group">

            <label htmlFor="password">
              Password
            </label>

            <div className="elderly-password-wrapper">

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />

              <button
                type="button"
                className="password-toggle"
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

          <button
            type="button"
            className="forgot-password"
            onClick={() => navigate("/forgot-password?role=elderly")}
          >
            Forgot your password?
          </button>


          {/* =========================
              LOGIN ERROR
              ========================= */}

          {loginError && (
            <p className={`login-feedback ${loginFeedbackType}`} role={loginFeedbackType === "error" ? "alert" : "status"} aria-live={loginFeedbackType === "error" ? "assertive" : "polite"}>
              {loginError}
            </p>
          )}


          {/* =========================
              LOGIN BUTTON
              ========================= */}

          <motion.button
            type="button"
            className="elderly-login-button"
            onClick={handleLogin}
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


          {/* =========================
              VOICE HELP
              ========================= */}

          <button
            type="button"
            className="voice-help-button"
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

export default ElderlyLogin;
