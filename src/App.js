import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: "https://home-2cb64-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Firebase Initialization
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function App() {
  const [sensorData, setSensorData] = useState({
    brightness: "Loading...",
    current: "Loading...",
    fan_speed: "Loading...",
    ldr: "Loading...",
    pir: "Loading...",
    rain: "Loading...",
    speed: "Loading...",
    temp: "Loading...",
    solar_power: "Loading...",
    energy_consumption: "Loading...",
    cost_savings: "Loading...",
  });

  useEffect(() => {
    const dbRef = ref(database, "/");
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setSensorData({
            brightness: data.brightness ?? "N/A",
            current: data.current ?? "N/A",
            fan_speed: data.fan_speed ?? "N/A",
            ldr: data.ldr ?? "N/A",
            pir: data.pir ?? "N/A",
            rain: data.rain ?? "N/A",
            speed: data.speed ?? "N/A",
            temp: data.temp ?? "N/A",
            solar_power: data.solar_power ?? "N/A",
            energy_consumption: data.energy_consumption ?? "N/A",
            cost_savings: data.cost_savings ?? "N/A",
          });
        }
      },
      (error) => {
        console.error("Firebase read failed:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Function to get the color based on the value
  const getCircleColor = (value, isForEnergy = false, isForSecondRow = false) => {
    if (isNaN(value)) {
      // For non-numeric values
      if (value === "LOW") return isForSecondRow ? "#007bff" : "#f39c12"; // Blue for second row
      if (value === "HIGH") return isForSecondRow ? "#007bff" : "#2ecc71"; // Green for high
      return "#9b59b6"; // Purple for other non-numeric values
    }

    const numberValue = parseFloat(value);

    if (isForEnergy) {
      // Energy thresholds (customize these values based on your needs)
      if (numberValue <= 10) return "#e74c3c"; // Red for low energy savings
      if (numberValue > 10 && numberValue <= 50) return "#f39c12"; // Yellow for moderate
      return "#2ecc71"; // Green for good
    } else {
      // General sensor values
      if (numberValue <= 30) return isForSecondRow ? "#007bff" : "#e74c3c"; // Blue for second row, red for low
      if (numberValue > 30 && numberValue <= 70) return isForSecondRow ? "#007bff" : "#f39c12"; // Blue for second row, yellow for medium
      return isForSecondRow ? "#007bff" : "#2ecc71"; // Blue for second row, green for high
    }
  };

  return (
    <>
      {/* Bootstrap */}
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        rel="stylesheet"
      />
      <style>{`
        .circle-chart {
          width: 120px;
          height: 120px;
        }
        .circle-svg {
          width: 100%;
          height: 100%;
        }
        .circle-bg {
          fill: none;
          stroke: #eee;
          stroke-width: 3.8;
        }
        .circle {
          fill: none;
          stroke-width: 3.8;
          stroke-linecap: round;
          transition: stroke-dasharray 0.5s ease;
        }
        .circle-text {
          fill: #007bff;
          font-size: 6px;
          font-weight: bold;
          text-anchor: middle;
          dominant-baseline: middle;
        }
      `}</style>

      <div className="container py-5">
        <h2 className="text-center mb-5 fw-bold">🌞 AI-IoT SMART ENERGY MANAGEMENT SYSTEM</h2>

        {/* First Row - LDR, Brightness, Temperature, Fan Speed */}
        <div className="row g-4">
          {["ldr", "brightness", "temp", "fan_speed"].map((key) => {
            const value = sensorData[key];
            const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
            const displayValue = isNumeric
              ? Math.min(100, Math.max(0, parseFloat(value)))
              : 100;
            const color = getCircleColor(value);

            return (
              <div className="col-sm-6 col-lg-3" key={key}>
                <div className="card shadow h-100 text-center p-4 border-0">
                  <div className="circle-chart mx-auto mb-3">
                    <svg className="circle-svg" viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle"
                        stroke={color}
                        strokeDasharray={`${displayValue}, 100`}
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <text x="18" y="20.5" className="circle-text">
                        {String(value).toUpperCase()}
                      </text>
                    </svg>
                  </div>
                  <h5 className="text-capitalize">{key.replace(/([A-Z])/g, ' $1')}</h5>
                </div>
              </div>
            );
          })}
        </div>

        {/* Second Row - PIR, Rain (Centered, Blue Color) */}
        <div className="row g-4 mt-4 justify-content-center">
          {["pir", "rain"].map((key) => {
            const value = sensorData[key];
            const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
            const displayValue = isNumeric
              ? Math.min(100, Math.max(0, parseFloat(value)))
              : 100;
            const color = getCircleColor(value, false, true);

            return (
              <div className="col-sm-6 col-lg-3" key={key}>
                <div className="card shadow h-100 text-center p-4 border-0">
                  <div className="circle-chart mx-auto mb-3">
                    <svg className="circle-svg" viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle"
                        stroke={color}
                        strokeDasharray={`${displayValue}, 100`}
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <text x="18" y="20.5" className="circle-text">
                        {String(value).toUpperCase()}
                      </text>
                    </svg>
                  </div>
                  <h5 className="text-capitalize">{key.replace(/([A-Z])/g, ' $1')}</h5>
                </div>
              </div>
            );
          })}
        </div>

        {/* Third Row - Energy Saving Calculation */}
        <h3 className="text-center mt-5 mb-4">Energy Saving Calculation</h3>
        <div className="row g-4">
          {["solar_power", "energy_consumption", "cost_savings"].map((key) => {
            const value = sensorData[key];
            const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
            const displayValue = isNumeric
              ? Math.min(100, Math.max(0, parseFloat(value)))
              : 100;
            const color = getCircleColor(value, true);

            return (
              <div className="col-sm-6 col-lg-4" key={key}>
                <div className="card shadow h-100 text-center p-4 border-0">
                  <div className="circle-chart mx-auto mb-3">
                    <svg className="circle-svg" viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle"
                        stroke={color}
                        strokeDasharray={`${displayValue}, 100`}
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <text x="18" y="20.5" className="circle-text">
                        {String(value).toUpperCase()}
                      </text>
                    </svg>
                  </div>
                  <h5 className="text-capitalize">{key.replace(/([A-Z])/g, ' $1')}</h5>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-5 text-muted small">
          &copy; {new Date().getFullYear()} Smart Energy Management Dashboard
        </div>
      </div>
    </>
  );
}

export default App;
