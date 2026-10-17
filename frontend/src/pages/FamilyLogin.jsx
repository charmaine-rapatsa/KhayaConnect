import { loginWithCsrf } from "../api/auth";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import "../styles/FamilyLogin.css";
import "../styles/login-feedback.css";

import familyMember from "../assets/family-member.png";
import { getLoginErrorMessage, getMissingLoginMessage, LOGIN_MESSAGES, speakLoginFeedback } from "./loginFeedback";

function FamilyLogin() {
  const [showPassword, setShowPassword] = useState(false);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginFeedbackType, setLoginFeedbackType] = useState("error");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navigate = useNavigate();

  const showLoginFeedback = (message, type = "error") => {
    setLoginFeedbackType(type);
    setLoginError(message);
    return speakLoginFeedback(message, "family");
  };

  useEffect(() => {
  const instruction =
    "Welcome to KhayaConnect. Please enter your phone number and password, then press the Log In button.";

  const speakInstruction = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(instruction);

      speech.rate = 0.9;
      speech.pitch = 1;
      speech.volume = 1;

      window.speechSynthesis.speak(speech);
    }
  };

  const timer = setTimeout(() => {
    speakInstruction();
  }, 500);

  return () => {
    clearTimeout(timer);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };
}, []);

  const handleLogin = async () => {
    setLoginError("");

    const missingMessage = getMissingLoginMessage(phone, password);
    if (missingMessage) {
      showLoginFeedback(missingMessage);
      return;
    }

    setIsLoggingIn(true);

    try {
      const data = await loginWithCsrf(phone.trim(), password, "family");

      if (data.role !== "family") {
        throw Object.assign(new Error(), { status: 401 });
      }

      localStorage.setItem(
        "khayaConnectUser",
        JSON.stringify(data)
      );

      const announcement = showLoginFeedback(LOGIN_MESSAGES.success, "success");
      await Promise.all([announcement, new Promise((resolve) => window.setTimeout(resolve, 700))]);
      navigate("/dashboard/family");
    } catch (error) {
      console.error("Login error:", error);

      showLoginFeedback(getLoginErrorMessage(error));
    }

    setIsLoggingIn(false);
  };

  return (
    <div className="family-login-page">

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

      <section className="family-login-welcome">

        <p className="family-login-brand">
          KHAYACONNECT
        </p>

        <h1>
          Welcome back.
        </h1>

        <p className="family-login-message">
          Stay connected with your loved one's care,
          appointments and wellbeing.
        </p>


        {/* FAMILY CHARACTER */}

        <motion.div
          className="family-login-character"
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
            src={familyMember}
            alt="KhayaConnect family member"
          />
        </motion.div>

      </section>


      {/* =========================
          RIGHT SIDE
          ========================= */}

      <section className="family-login-form-section">

        <div className="family-login-card">

          {/* ROLE */}

          <p className="family-login-role">
            FAMILY MEMBER
          </p>


          {/* TITLE */}

          <h2>
            Sign in
          </h2>

          <p className="family-login-subtitle">
            Enter your details to continue.
          </p>


          {/* =========================
              PHONE NUMBER
              ========================= */}

          <div className="family-form-group">

            <label htmlFor="family-phone">
              Phone Number
            </label>

            <input
              id="family-phone"
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

          <div className="family-form-group">

            <label htmlFor="family-password">
              Password
            </label>

            <div className="family-password-wrapper">

              <input
                id="family-password"
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
            onClick={() => navigate("/forgot-password?role=family")}
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
            className="family-login-button"
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
          <button
            type="button"
            className="voice-help-button"
            onClick={() => {
              const instruction =
                "Welcome to KhayaConnect. Please enter your phone number and password, then press the Log In button.";

              if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const speech = new SpeechSynthesisUtterance(instruction);
                speech.rate = 0.9;
                speech.pitch = 1;
                speech.volume = 1;
                window.speechSynthesis.speak(speech);
              }
            }}
          >
            🔊 Hear instructions
          </button>

        </div>

      </section>

    </div>
  );
}

export default FamilyLogin;

