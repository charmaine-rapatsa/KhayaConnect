import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import "../styles/RoleSelection.css";

import elderlyVideo from "../assets/Elder.mp4";
import familyVideo from "../assets/family.mp4";
import chwVideo from "../assets/chw staff.mp4";
import clinicVideo from "../assets/clinic Staff.mp4";
import adminVideo from "../assets/Admin.mp4";

const roles = [
  {
    name: "Elderly User",
    video: elderlyVideo,
    path: "/login/elderly",
    description:
      "Manage your medication, appointments and daily wellbeing.",
  },
  {
    name: "Family Member",
    video: familyVideo,
    path: "/login/family",
    description:
      "Stay connected and keep up with your loved one's wellbeing.",
  },
  {
    name: "Community Health Worker",
    video: chwVideo,
    path: "/login/chw",
    description:
      "Manage visits, tasks and support for the community.",
  },
  {
    name: "Clinic Staff",
    video: clinicVideo,
    path: "/login/clinic",
    description:
      "Manage patients, appointments and important alerts.",
  },
  {
    name: "Administrator",
    video: adminVideo,
    path: "/login/admin",
    description:
      "Manage users, services and the KhayaConnect system.",
  },
];

function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isGreeting, setIsGreeting] = useState(false);

  const videoRef = useRef(null);

  const navigate = useNavigate();

  // Previous role
  const previousRole = () => {
    setDirection(-1);
    setIsGreeting(false);

    setSelectedRole((current) => {
      return (current - 1 + roles.length) % roles.length;
    });
  };

  // Next role
  const nextRole = () => {
    setDirection(1);
    setIsGreeting(false);

    setSelectedRole((current) => {
      return (current + 1) % roles.length;
    });
  };

  // Select role using dots
  const selectRole = (index) => {
    if (index === selectedRole) {
      return;
    }

    setDirection(index > selectedRole ? 1 : -1);
    setIsGreeting(false);
    setSelectedRole(index);
  };

  // Click character:
  // play video with voice, then go to login
  const handleCharacterClick = () => {
    if (!videoRef.current || isGreeting) {
      return;
    }

    const video = videoRef.current;

    setIsGreeting(true);

    // Start from the beginning
    video.currentTime = 0;

    // Turn the sound on after the user's click
    video.muted = false;
    video.volume = 1;

    // Play the video with the voiceover
    video.play().catch((error) => {
      console.log("Video playback error:", error);
    });
  };

  // When the greeting video finishes,
  // open the selected role's login page
  const handleGreetingEnded = () => {
    navigate(currentRole.path);
  };

  // Swipe / drag
  const handleDragEnd = (event, info) => {
    if (info.offset.x < -80) {
      nextRole();
    } else if (info.offset.x > 80) {
      previousRole();
    }
  };

  const currentRole = roles[selectedRole];

  return (
    <div className="role-page">

      {/* =========================
          WELCOME SECTION
          ========================= */}

      <section className="welcome-section">

        <p className="welcome-brand">
          KHAYACONNECT
        </p>

        <h1>
          Connected care
          <br />
          for older adults
          <br />
          and families.
        </h1>

        <p className="welcome-description">
          Bringing families, healthcare workers and
          communities closer together.
        </p>

      </section>


      {/* =========================
          ROLE SECTION
          ========================= */}

      <section className="role-section">

        {/* =========================
            ROLE HEADER
            ========================= */}

        <div className="role-header">

          <p>
            WHO ARE YOU?
          </p>

          <span>
            Select your role to continue
          </span>

        </div>


        {/* =========================
            ROLE CAROUSEL
            ========================= */}

        <div className="role-selector">

          {/* PREVIOUS BUTTON */}

          <motion.button
            className="arrow-button"
            onClick={previousRole}
            aria-label="Previous role"
            disabled={isGreeting}

            whileHover={{
              scale: 1.08,
            }}

            whileTap={{
              scale: 0.92,
            }}
          >
            ←
          </motion.button>


          {/* =========================
              ROLE CARD
              ========================= */}

          <div className="role-card">

            {/* CHARACTER VIDEO */}

            <div className="role-image-container">

              <AnimatePresence
                mode="wait"
                initial={false}
                custom={direction}
              >

                <motion.video
                  key={selectedRole}
                  ref={videoRef}
                  src={currentRole.video}
                  className="role-video"

                  autoPlay
                  muted={!isGreeting}
                  loop={!isGreeting}
                  playsInline

                  onClick={handleCharacterClick}
                  onEnded={handleGreetingEnded}

                  aria-label={`Continue as ${currentRole.name}`}

                  title={`Click to continue as ${currentRole.name}`}

                  initial={{
                    opacity: 0,
                    x: direction * 220,
                    scale: 0.94,
                  }}

                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }}

                  exit={{
                    opacity: 0,
                    x: direction * -220,
                    scale: 0.94,
                  }}

                  transition={{
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  }}

                  drag={!isGreeting ? "x" : false}

                  dragConstraints={{
                    left: 0,
                    right: 0,
                  }}

                  dragElastic={0.7}

                  onDragEnd={handleDragEnd}

                  whileDrag={{
                    scale: 1.02,
                  }}

                  whileHover={{
                    scale: 1.015,
                  }}

                  whileTap={{
                    scale: 0.98,
                  }}
                />

              </AnimatePresence>

            </div>


            {/* =========================
                ROLE TEXT
                ========================= */}

            <AnimatePresence
              mode="wait"
              initial={false}
            >

              <motion.div
                key={selectedRole}

                initial={{
                  opacity: 0,
                  y: 12,
                }}

                animate={{
                  opacity: 1,
                  y: 0,
                }}

                exit={{
                  opacity: 0,
                  y: -12,
                }}

                transition={{
                  duration: 0.3,
                  ease: "easeOut",
                }}
              >

                <h2>
                  {currentRole.name}
                </h2>

                <p>
                  {currentRole.description}
                </p>

              </motion.div>

            </AnimatePresence>

          </div>


          {/* NEXT BUTTON */}

          <motion.button
            className="arrow-button"
            onClick={nextRole}
            aria-label="Next role"
            disabled={isGreeting}

            whileHover={{
              scale: 1.08,
            }}

            whileTap={{
              scale: 0.92,
            }}
          >
            →
          </motion.button>

        </div>


        {/* =========================
            ROLE DOTS
            ========================= */}

        <div className="role-dots">

          {roles.map((role, index) => (

            <motion.button
              key={role.name}

              className={`dot ${
                index === selectedRole
                  ? "active"
                  : ""
              }`}

              onClick={() => selectRole(index)}

              aria-label={`Select ${role.name}`}

              disabled={isGreeting}

              whileTap={{
                scale: 0.8,
              }}
            />

          ))}

        </div>

      </section>

    </div>
  );
}

export default RoleSelection;