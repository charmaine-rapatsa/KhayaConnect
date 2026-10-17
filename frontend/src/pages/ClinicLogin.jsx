import { loginWithCsrf } from "../api/auth";
import { useRef, useState } from "react"; 
import { useNavigate } from "react-router-dom"; 
import { motion } from "framer-motion"; 
 
import "../styles/ClinicLogin.css"; 
import "../styles/login-feedback.css";
 
import clinicStaff from "../assets/clinic-staff.png"; 
import elderlyVoice from "../assets/Elderly voice.m4a"; 
import { getLoginErrorMessage, getMissingLoginMessage, LOGIN_MESSAGES, speakLoginFeedback } from "./loginFeedback";
 
function ClinicLogin() { 
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
    return speakLoginFeedback(message, "clinic");
  };
 
  const playInstructions = () => { 
    if (!voiceRef.current) voiceRef.current = new Audio(elderlyVoice);
    voiceRef.current.currentTime = 0;
    voiceRef.current.play().catch((error) => { 
      console.log("Audio playback error:", error); 
    }); 
  }; 
 
  /* ========================================================= 
     LOGIN 
     ========================================================= */ 
 
  const handleLogin = async () => {
    setLoginError("");

    const missingMessage = getMissingLoginMessage(phone, password);
    if (missingMessage) {
      showLoginFeedback(missingMessage);
      return;
    }

    try {
      setIsLoggingIn(true);
      const data = await loginWithCsrf(phone.trim(), password, "clinic");

      if (data.role !== "clinic") throw Object.assign(new Error(), { status: 401 });

      localStorage.setItem("khayaConnectUser", JSON.stringify(data));
      const announcement = showLoginFeedback(LOGIN_MESSAGES.success, "success");
      await Promise.all([announcement, new Promise((resolve) => window.setTimeout(resolve, 700))]);
      navigate("/dashboard/clinic");
    } catch (error) {
      console.error("Clinic login error:", error);
      showLoginFeedback(getLoginErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  }; 
 
  return ( 
    <div className="clinic-login-page"> 
 
      {/* ===================================================== 
          BACK BUTTON 
      ===================================================== */} 
 
      <motion.button 
        className="clinic-back-button" 
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
 
 
      {/* ===================================================== 
          LEFT STUDIO SECTION 
      ===================================================== */} 
 
      <section className="clinic-login-welcome"> 
 
        <div className="clinic-login-content"> 
 
          <p className="clinic-login-brand"> 
            KHAYACONNECT 
          </p> 
 
          <h1> 
            Welcome back. 
          </h1> 
 
          <p className="clinic-login-message"> 
            Manage patients, appointments and 
            important care alerts. 
          </p> 
 
        </div> 
 
 
        {/* CLINIC STAFF CHARACTER */} 
 
        <motion.div 
          className="clinic-login-character" 
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
            src={clinicStaff} 
            alt="KhayaConnect clinic staff" 
          /> 
 
        </motion.div> 
 
      </section> 
 
 
      {/* ===================================================== 
          RIGHT FORM SECTION 
      ===================================================== */} 
 
      <section className="clinic-login-form-section"> 
 
        <div className="clinic-login-card"> 
 
          {/* ROLE */} 
 
          <p className="clinic-login-role"> 
            CLINIC STAFF 
          </p> 
 
 
          {/* TITLE */} 
 
          <h2> 
            Sign in 
          </h2> 
 
          <p className="clinic-login-subtitle"> 
            Enter your details to continue. 
          </p> 
 
 
          {/* ================================================= 
              PHONE NUMBER 
          ================================================= */} 
 
          <div className="clinic-form-group"> 
 
            <label htmlFor="clinic-phone"> 
              Phone Number 
            </label> 
 
            <input 
              id="clinic-phone" 
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)} 
              placeholder="Enter your phone number" 
              autoComplete="tel" 
            /> 
 
          </div> 
 
 
          {/* ================================================= 
              PASSWORD 
          ================================================= */} 
 
          <div className="clinic-form-group"> 
 
            <label htmlFor="clinic-password"> 
              Password 
            </label> 
 
            <div className="clinic-password-wrapper"> 
 
              <input 
                id="clinic-password" 
                type={ 
                  showPassword 
                    ? "text" 
                    : "password" 
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)} 
                placeholder="Enter your password" 
                autoComplete="current-password" 
              /> 
 
              <button 
                type="button" 
                className="clinic-password-toggle" 
                onClick={() => 
                  setShowPassword(!showPassword) 
                } 
                aria-label={ 
                  showPassword 
                    ? "Hide password" 
                    : "Show password" 
                } 
              > 
                {showPassword 
                  ? "Hide" 
                  : "Show"} 
              </button> 
 
            </div> 
 
          </div> 
 
 
          {/* ================================================= 
              FORGOT PASSWORD 
          ================================================= */} 
 
          <button 
            type="button" 
            className="clinic-forgot-password" 
            onClick={() => navigate("/forgot-password?role=clinic")}
          > 
            Forgot your password? 
          </button> 
 
 
          {/* ================================================= 
              LOGIN BUTTON 
          ================================================= */} 
 
                    {loginError && (
            <p className={`login-feedback ${loginFeedbackType}`} role={loginFeedbackType === "error" ? "alert" : "status"} aria-live={loginFeedbackType === "error" ? "assertive" : "polite"}>
              {loginError}
            </p>
          )}

<motion.button 
            type="button" 
            className="clinic-login-button" 
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
 
 
          {/* ================================================= 
              VOICE HELP 
          ================================================= */} 
 
          <button 
            type="button" 
            className="clinic-help-button" 
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
 
export default ClinicLogin;
