import { loginWithCsrf } from "../api/auth";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import "../styles/AdminLogin.css";
import "../styles/login-feedback.css";

import administrator from "../assets/administrator.png";
import elderlyVoice from "../assets/Elderly voice.m4a";
import { getLoginErrorMessage, getMissingLoginMessage, LOGIN_MESSAGES, speakLoginFeedback } from "./loginFeedback";

function AdminLogin() {
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
    return speakLoginFeedback(message, "admin");
  };

  const playInstructions = () => {
    if (!voiceRef.current) voiceRef.current = new Audio(elderlyVoice);
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
      const data = await loginWithCsrf(phone.trim(), password, "admin");
      if (data.role !== "admin") throw Object.assign(new Error(), { status: 401 });
      localStorage.setItem("khayaConnectUser", JSON.stringify(data));
      const announcement = showLoginFeedback(LOGIN_MESSAGES.success, "success");
      await Promise.all([announcement, new Promise((resolve) => window.setTimeout(resolve, 700))]);
      navigate("/dashboard/admin");
    } catch (error) {
      showLoginFeedback(getLoginErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="admin-login-page">

      {/* BACK BUTTON */}

      <motion.button
        type="button"
        className="admin-back-button"
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


      {/* LEFT SECTION */}

      <section className="admin-login-welcome">

        <div className="admin-login-content">

          <p className="admin-login-brand">
            KHAYACONNECT
          </p>

          <h1>
            Welcome back.
          </h1>

          <p className="admin-login-message">
            Manage users, services and
            the KhayaConnect system.
          </p>

        </div>


        <motion.div
          className="admin-login-character"
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
            src={administrator}
            alt="KhayaConnect administrator"
          />
        </motion.div>

      </section>


      {/* RIGHT FORM SECTION */}

      <section className="admin-login-form-section">

        <div className="admin-login-card">

          <p className="admin-login-role">
            ADMINISTRATOR
          </p>

          <h2>
            Sign in
          </h2>

          <p className="admin-login-subtitle">
            Enter your details to continue.
          </p>
          {loginError && <p className={`login-feedback ${loginFeedbackType}`} role={loginFeedbackType === "error" ? "alert" : "status"} aria-live={loginFeedbackType === "error" ? "assertive" : "polite"}>{loginError}</p>}


          {/* PHONE */}

          <div className="admin-form-group">

            <label htmlFor="admin-phone">
              Phone Number
            </label>

            <input
              id="admin-phone"
              type="tel"
              placeholder="Enter your phone number"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />

          </div>


          {/* PASSWORD */}

          <div className="admin-form-group">

            <label htmlFor="admin-password">
              Password
            </label>

            <div className="admin-password-wrapper">

              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>

            </div>

          </div>


          {/* FORGOT PASSWORD */}

          <button
            type="button"
            className="admin-forgot-password"
            onClick={() => navigate("/forgot-password?role=admin")}
          >
            Forgot your password?
          </button>


          {/* LOGIN */}

          <motion.button
            type="button"
            className="admin-login-button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            whileHover={{
              scale: 1.02,
            }}
            whileTap={{
              scale: 0.98,
            }}
          >
            {isLoggingIn ? "Signing in…" : "Log In"}
          </motion.button>


          {/* VOICE */}

          <button
            type="button"
            className="admin-help-button"
            onClick={playInstructions}
          >
            🔊 Hear instructions
          </button>

        </div>

      </section>

    </div>
  );
}

export default AdminLogin;
