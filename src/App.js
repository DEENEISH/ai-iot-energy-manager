import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

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
    power: "Loading...",
    current_consumption: "Loading...",
    cost_savings: "Loading...",
    cost_usage: "Loading...",
    fan_manual: "OFF",
    light_manual: "OFF",
    mode: "ai"
  });

  useEffect(() => {
    const dbRef = ref(database, "/");
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Calculate values
          const current = parseFloat(data.current) || 0;
          const voltage = 5; // Assuming 5V system
          const power = (current * voltage).toFixed(2); // P = I*V
          
          // Calculate current consumption percentage (0.14A out of 0.5A)
          const currentPercentage = current > 0.5 ? 100 : (current / 0.5) * 100;
          
          // Electricity rates and solar efficiency
          const ratePerWh = 0.30; // RM0.30 per watt-hour
          const solarEfficiency = 0.8; // Assume solar covers 80% of usage
          
          // Calculate costs
          const hourlyUsageCost = (power * ratePerWh).toFixed(2);
          const hourlySavings = (power * ratePerWh * solarEfficiency).toFixed(2);

          setSensorData(prev => ({
            ...prev,
            brightness: data.brightness ?? "N/A",
            current: current.toFixed(2) + "A",
            fan_speed: data.fan_speed ?? "N/A",
            ldr: data.ldr ?? "N/A",
            pir: data.pir ?? "N/A",
            rain: data.rain ?? "N/A",
            speed: data.speed ?? "N/A",
            temp: data.temp ?? "N/A",
            power: power + "W",
            current_consumption: current.toFixed(2) + "A\n" + currentPercentage.toFixed(0) + "%",
            cost_savings: "Saved:\nRM" + hourlySavings + "/h",
            cost_usage: "Cost:\nRM" + hourlyUsageCost + "/h",
            fan_manual: data.fan_manual ?? "OFF",
            light_manual: data.light_manual ?? "OFF",
            mode: data.mode ?? "ai"
          }));
        }
      },
      (error) => {
        console.error("Firebase read failed:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const getCircleColor = (value, isForEnergy = false, isForSecondRow = false) => {
    if (isNaN(value)) {
      if (value === "LOW") return isForSecondRow ? "#007bff" : "#f39c12";
      if (value === "HIGH") return isForSecondRow ? "#007bff" : "#2ecc71";
      return "#9b59b6";
    }

    const numberValue = parseFloat(value);

    if (isForEnergy) {
      if (numberValue <= 10) return "#e74c3c";
      if (numberValue > 10 && numberValue <= 50) return "#f39c12";
      return "#2ecc71";
    } else {
      if (numberValue <= 30) return isForSecondRow ? "#007bff" : "#e74c3c";
      if (numberValue > 30 && numberValue <= 70) return isForSecondRow ? "#007bff" : "#f39c12";
      return isForSecondRow ? "#007bff" : "#2ecc71";
    }
  };

  const handleModeToggle = () => {
    const newMode = sensorData.mode === "ai" ? "manual" : "ai";
    set(ref(database, "mode"), newMode)
      .then(() => console.log("Mode updated to:", newMode))
      .catch((error) => console.error("Error updating mode:", error));
  };

  const handleLightToggle = () => {
    const newLightState = sensorData.light_manual === "ON" ? "OFF" : "ON";
    set(ref(database, "light_manual"), newLightState)
      .then(() => console.log("Light switched to:", newLightState))
      .catch((error) => console.error("Error updating light:", error));
  };

  const handleFanToggle = () => {
    const newFanState = sensorData.fan_manual === "ON" ? "OFF" : "ON";
    set(ref(database, "fan_manual"), newFanState)
      .then(() => console.log("Fan switched to:", newFanState))
      .catch((error) => console.error("Error updating fan:", error));
  };

  return (
    <>
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
          font-size: 5px;
          font-weight: bold;
          text-anchor: middle;
          dominant-baseline: middle;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 60px;
          height: 34px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.4s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          border-radius: 50%;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.4s;
        }
        input:checked + .slider {
          background-color: #4caf50;
        }
        input:checked + .slider:before {
          transform: translateX(26px);
        }
        .switch-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 15px;
        }
        .switch-label {
          margin-top: 5px;
          font-size: 14px;
        }
      `}</style>

      <div className="container py-5">
        <h2 className="text-center mb-5 fw-bold">🌞 AI-IoT SMART ENERGY MANAGEMENT SYSTEM</h2>

        {/* Mode Toggle */}
        <div className="switch-container mb-4">
          <label className="switch">
            <input 
              type="checkbox" 
              onChange={handleModeToggle} 
              checked={sensorData.mode === "ai"} 
            />
            <span className="slider"></span>
          </label>
          <span className="switch-label">
            {sensorData.mode === "ai" ? "AI" : "Manual"} Mode
          </span>
        </div>

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

        {/* Second Row - PIR, Rain */}
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

        {/* Third Row - Energy Calculation */}
        <h3 className="text-center mt-5 mb-4">Energy Calculation</h3>
        <div className="row g-4">
          {["power", "current_consumption", "cost_savings", "cost_usage"].map((key) => {
            let value, displayValue, color, displayText, title;
            
            if (key === "current_consumption") {
              const parts = sensorData.current_consumption.split('\n');
              displayText = parts.map((part, i) => (
                <tspan x="18" dy={i === 0 ? 0 : 5} key={i}>{part}</tspan>
              ));
              const current = parseFloat(sensorData.current) || 0;
              displayValue = current > 0.5 ? 100 : (current / 0.5) * 100;
              color = getCircleColor(displayValue, true);
              title = "Current (0.5A max)";
            } 
            else if (key === "power") {
              displayText = sensorData.power;
              const powerValue = parseFloat(sensorData.power) || 0;
              displayValue = powerValue > 100 ? 100 : powerValue;
              color = getCircleColor(powerValue, true);
              title = "Power";
            }
            else if (key === "cost_savings") {
              const parts = sensorData.cost_savings.split('\n');
              displayText = parts.map((part, i) => (
                <tspan x="18" dy={i === 0 ? 0 : 5} key={i}>{part}</tspan>
              ));
              displayValue = 100;
              color = "#2ecc71";
              title = "Cost Savings";
            }
            else {
              const parts = sensorData.cost_usage.split('\n');
              displayText = parts.map((part, i) => (
                <tspan x="18" dy={i === 0 ? 0 : 5} key={i}>{part}</tspan>
              ));
              displayValue = 100;
              color = "#e74c3c";
              title = "Usage Cost";
            }

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
                      <text x="18" y="18" className="circle-text">
                        {displayText}
                      </text>
                    </svg>
                  </div>
                  <h5 className="text-capitalize">{title}</h5>
                </div>
              </div>
            );
          })}
        </div>

        {/* Manual Controls - Only shown in Manual mode */}
        {sensorData.mode === "manual" && (
          <div className="row justify-content-center mt-5">
            <div className="col-md-6">
              <div className="card shadow p-4 border-0">
                <h3 className="text-center mb-4">Manual Controls</h3>
                <div className="row justify-content-center">
                  <div className="col-6 text-center">
                    <div className="switch-container">
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={sensorData.light_manual === "ON"} 
                          onChange={handleLightToggle} 
                        />
                        <span className="slider"></span>
                      </label>
                      <span className="switch-label">
                        Light {sensorData.light_manual === "ON" ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                  <div className="col-6 text-center">
                    <div className="switch-container">
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={sensorData.fan_manual === "ON"} 
                          onChange={handleFanToggle} 
                        />
                        <span className="slider"></span>
                      </label>
                      <span className="switch-label">
                        Fan {sensorData.fan_manual === "ON" ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-5 text-muted small">
          &copy; {new Date().getFullYear()} Smart Energy Management Dashboard
        </div>
      </div>
    </>
  );
}

export default App;