import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// Firebase Config
// Note: For this application to connect to a real Firebase project,
// ensure your environment variables (REACT_APP_FIREBASE_API_KEY, etc.)
// are correctly set in your development or deployment environment.
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

// Define TNB tiered electricity rates in RM per kWh
// This structure defines the upper limit of each tier and its corresponding rate.
// The 'limit' indicates the amount of kWh *in that specific tier*.
// For example, the first tier is 200 kWh, the second is 100 kWh (201-300), etc.
const TNB_TIERED_RATES = [
  { limit: 200, rate: 0.218 }, // First 200 kWh at RM 0.218/kWh
  { limit: 100, rate: 0.334 }, // Next 100 kWh (from 201 to 300 kWh) at RM 0.334/kWh
  { limit: 300, rate: 0.516 }, // Next 300 kWh (from 301 to 600 kWh) at RM 0.516/kWh
  { limit: 300, rate: 0.546 }, // Next 300 kWh (from 601 to 900 kWh) at RM 0.546/kWh
  { limit: Infinity, rate: 0.571 } // Remaining kWh (above 900 kWh) at RM 0.571/kWh
];

/**
 * Calculates the total electricity cost based on tiered rates.
 * @param {number} totalKWh - Total energy consumed in kilowatt-hours (kWh).
 * @returns {number} The total cost in RM.
 */
const calculateTieredCost = (totalKWh) => {
  let cost = 0;
  let consumptionRemaining = totalKWh;

  for (let i = 0; i < TNB_TIERED_RATES.length; i++) {
    const tier = TNB_TIERED_RATES[i];
    let unitsInCurrentTier;

    // Determine how many units fall into the current tier
    if (tier.limit === Infinity) {
      unitsInCurrentTier = consumptionRemaining;
    } else {
      unitsInCurrentTier = Math.min(consumptionRemaining, tier.limit);
    }

    cost += unitsInCurrentTier * tier.rate;
    consumptionRemaining -= unitsInCurrentTier;

    if (consumptionRemaining <= 0) {
      break; // All consumption accounted for
    }
  }
  return cost;
};

/**
 * CircleChart Component
 * Renders a circular progress chart with a central text display.
 * @param {object} props - Component props
 * @param {string|number} props.value - The raw value to display
 * @param {string} props.title - The title of the chart
 * @param {string} props.color - The stroke color of the progress circle
 * @param {number} props.displayValue - The percentage value for the progress bar (0-100)
 * @param {React.ReactNode} props.children - Custom content to display in the center of the circle
 */
const CircleChart = ({ value, title, color, displayValue, children }) => {
  return (
    <div className="card shadow h-100 text-center p-4 border-0 rounded-lg">
      <div className="circle-chart mx-auto mb-3">
        <svg className="circle-svg" viewBox="0 0 36 36">
          {/* Background circle */}
          <path
            className="circle-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Progress circle */}
          <path
            className="circle"
            stroke={color}
            strokeDasharray={`${displayValue}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Text display in the center */}
          <text x="18" y="18" className="circle-text">
            {children || String(value).toUpperCase()}
          </text>
        </svg>
      </div>
      <h5 className="text-capitalize font-bold text-gray-800">{title}</h5>
    </div>
  );
};


function App() {
  const [sensorData, setSensorData] = useState({
    brightness: "Loading...",
    current: "Loading...", // Instantaneous current (Amps)
    fan_speed: "Loading...",
    ldr: "Loading...",
    pir: "Loading...",
    rain: "Loading...",
    speed: "Loading...",
    temp: "Loading...",
    power: "Loading...", // Instantaneous power (Watts)
    current_consumption: "Loading...", // Instantaneous current consumption percentage
    cost_savings: "Loading...", // Hourly savings
    cost_usage: "Loading...", // Hourly usage cost
    fan_manual: "OFF",
    light_manual: "OFF",
    mode: "ai",
    overall_current: "Loading..." // Overall cumulative current (now assumed kWh)
  });

  // Previous month's bill, now fetched from Firebase
  const [previousMonthBill, setPreviousMonthBill] = useState("Loading..."); 
  const [estimatedCurrentMonthBill, setEstimatedCurrentMonthBill] = useState("Loading...");
  const [totalSavingsComparedToPrevious, setTotalSavingsComparedToPrevious] = useState("Loading...");
  const [savingsPercentage, setSavingsPercentage] = useState("Loading..."); // New state for savings percentage
  const [chartData, setChartData] = useState([]); // State for chart data

  // Effect to fetch previous month's bill from Firebase
  useEffect(() => {
    const prevMonthRef = ref(database, "prev_month");
    const unsubscribePrevMonth = onValue(
      prevMonthRef,
      (snapshot) => {
        const value = snapshot.val();
        if (typeof value === 'number') {
          setPreviousMonthBill(value);
        } else {
          setPreviousMonthBill("N/A"); // Or a default value if not found/invalid
          console.warn("Previous month's bill not found or invalid in Firebase at 'prev_month'.");
        }
      },
      (error) => {
        console.error("Firebase read for 'prev_month' failed:", error);
        setPreviousMonthBill("Error");
      }
    );
    return () => unsubscribePrevMonth();
  }, []); // Runs once on component mount

  useEffect(() => {
    // Reference to the root of your Firebase Realtime Database
    const dbRef = ref(database, "/");

    // Set up a listener for real-time data updates
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        const data = snapshot.val(); // Get the entire data snapshot
        if (data) {
          // --- Instantaneous Sensor Data Calculations ---
          const current = parseFloat(data.current) || 0; // Instantaneous current in Amps
          const voltage = 5; // Assuming a fixed 5V system voltage
          const power = (current * voltage); // Instantaneous power in Watts
          
          // Calculate instantaneous current consumption percentage based on a max capacity of 0.5A
          const maxCurrentCapacity = 0.5;
          const currentPercentage = current > maxCurrentCapacity ? 100 : (current / maxCurrentCapacity) * 100;
          
          // Electricity rates and desired solar efficiency for hourly calculation
          const flatRatePerWh = 0.30; // This flat rate is now only for instantaneous hourly cost display
          const solarSavingsPercentage = 0.30; // User requested 30% savings for demonstration

          // Calculate total hourly usage cost without savings (based on instantaneous power)
          const hourlyUsageCost = (power * flatRatePerWh);
          // Calculate hourly savings based on the specified percentage
          const hourlySavings = (hourlyUsageCost * solarSavingsPercentage);

          // --- Monthly Bill Calculations using overall_current (assumed kWh) and Tiered Rates ---
          // Assuming overall_current is cumulative Kilowatt-hours (kWh) for the month
          const totalEnergyConsumedkWh = parseFloat(data.overall_current) || 0;
          
          // Calculate estimated monthly usage cost using tiered rates
          const calculatedEstimatedMonthlyUsageCost = calculateTieredCost(totalEnergyConsumedkWh);
          
          // Calculate actual monthly savings from solar based on the estimated monthly usage
          const actualMonthlySavingsFromSolar = calculatedEstimatedMonthlyUsageCost * solarSavingsPercentage;
          
          // Calculate the estimated current month's bill after solar savings
          const calculatedEstimatedCurrentMonthBill = calculatedEstimatedMonthlyUsageCost - actualMonthlySavingsFromSolar;
          
          // Only calculate total savings compared to previous if previousMonthBill is a valid number
          let calculatedTotalSavingsComparedToPrevious;
          let calculatedSavingsPercentage = "N/A";

          if (typeof previousMonthBill === 'number' && !isNaN(previousMonthBill)) {
            calculatedTotalSavingsComparedToPrevious = previousMonthBill - calculatedEstimatedCurrentMonthBill;
            if (previousMonthBill > 0) { // Avoid division by zero
              calculatedSavingsPercentage = (calculatedTotalSavingsComparedToPrevious / previousMonthBill) * 100;
            } else {
              calculatedSavingsPercentage = 0; // If previous bill is 0, savings percentage is 0
            }
          } else {
            calculatedTotalSavingsComparedToPrevious = "N/A"; // Set to "N/A" if previousMonthBill is not a number
          }


          // Update the sensor data state with fetched and calculated values
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
            power: power.toFixed(2) + "W", // Format power for display
            current_consumption: `${current.toFixed(2)}A\n${currentPercentage.toFixed(0)}%`,
            cost_savings: `Saved:\nRM${hourlySavings.toFixed(2)}/h`, // Format savings for display
            cost_usage: `Cost:\nRM${hourlyUsageCost.toFixed(2)}/h`, // Format usage cost for display
            fan_manual: data.fan_manual ?? "OFF",
            light_manual: data.light_manual ?? "OFF",
            mode: data.mode ?? "ai",
            overall_current: totalEnergyConsumedkWh.toFixed(2) + " kWh" // Display overall current as kWh
          }));

          // Update the new monthly bill states
          setEstimatedCurrentMonthBill(`RM${calculatedEstimatedCurrentMonthBill.toFixed(2)}`);
          // Conditionally format totalSavingsComparedToPrevious
          const formattedTotalSavings = typeof calculatedTotalSavingsComparedToPrevious === 'number' 
            ? `RM ${calculatedTotalSavingsComparedToPrevious.toFixed(2)}` // Added "RM " here
            : calculatedTotalSavingsComparedToPrevious;
          setTotalSavingsComparedToPrevious(formattedTotalSavings);

          // Conditionally format savingsPercentage
          const formattedSavingsPercentage = typeof calculatedSavingsPercentage === 'number' 
            ? `${calculatedSavingsPercentage.toFixed(1)}%` 
            : calculatedSavingsPercentage;
          setSavingsPercentage(formattedSavingsPercentage);

          // Prepare data for the chart
          setChartData([
            { name: 'Previous Bill', value: typeof previousMonthBill === 'number' ? previousMonthBill : 0 },
            { name: 'Current Bill', value: calculatedEstimatedCurrentMonthBill },
            { name: 'Savings', value: typeof calculatedTotalSavingsComparedToPrevious === 'number' ? calculatedTotalSavingsComparedToPrevious : 0 }
          ]);

        }
      },
      (error) => {
        console.error("Firebase Realtime Database read failed:", error);
      }
    );

    // Cleanup function to unsubscribe from the Firebase listener when the component unmounts
    return () => unsubscribe();
  }, [previousMonthBill]); // previousMonthBill added to dependency array, so calculations re-run when it's fetched

  /**
   * Determines the color of the circle chart based on the value and context.
   * @param {string|number} value - The sensor value or calculated value.
   * @param {boolean} isForEnergy - True if the value relates to energy metrics (power, current, costs).
   * @param {boolean} isForSecondRow - True if the value is for PIR or Rain sensors.
   * @returns {string} Hex color code for the circle stroke.
   */
  const getCircleColor = (value, isForEnergy = false, isForSecondRow = false) => {
    // Handle non-numeric string values like "LOW", "HIGH", "ON", "OFF", "N/A", "Loading..."
    const stringValue = String(value).toUpperCase();
    if (stringValue === "LOW") return isForSecondRow ? "#007bff" : "#f39c12"; // Blue for PIR/Rain, Orange otherwise
    if (stringValue === "HIGH") return isForSecondRow ? "#007bff" : "#2ecc71"; // Blue for PIR/Rain, Green otherwise
    if (stringValue === "ON") return "#2ecc71"; // Green for ON state
    if (stringValue === "OFF") return "#e74c3c"; // Red for OFF state
    if (stringValue === "N/A" || stringValue === "LOADING...") return "#9b59b6"; // Purple for default/loading states

    // Convert to number for numeric comparisons
    const numberValue = parseFloat(value);
    if (isNaN(numberValue)) return "#9b59b6"; // Fallback for any other unparseable numbers

    // Logic for energy-related metrics
    if (isForEnergy) {
      if (numberValue <= 10) return "#e74c3c"; // Red for low power/high consumption
      if (numberValue > 10 && numberValue <= 50) return "#f39c12"; // Orange for moderate
      return "#2ecc71"; // Green for high power/low consumption (e.g., good savings)
    } else {
      // Logic for general sensor values (brightness, temp, fan_speed, ldr)
      if (numberValue <= 30) return isForSecondRow ? "#007bff" : "#e74c3c"; // Blue for PIR/Rain, Red for low values
      if (numberValue > 30 && numberValue > 70) return isForSecondRow ? "#007bff" : "#f39c12"; // Blue for PIR/Rain, Orange for moderate values
      return isForSecondRow ? "#007bff" : "#2ecc71"; // Blue for PIR/Rain, Green for high values
    }
  };

  /**
   * Handles toggling the AI/Manual mode in Firebase Realtime Database.
   */
  const handleModeToggle = () => {
    const newMode = sensorData.mode === "ai" ? "manual" : "ai";
    set(ref(database, "mode"), newMode)
      .then(() => console.log("Mode updated to:", newMode))
      .catch((error) => console.error("Error updating mode:", error));
  };

  /**
   * Handles toggling the manual light state in Firebase Realtime Database.
   */
  const handleLightToggle = () => {
    const newLightState = sensorData.light_manual === "ON" ? "OFF" : "ON";
    set(ref(database, "light_manual"), newLightState)
      .then(() => console.log("Light switched to:", newLightState))
      .catch((error) => console.error("Error updating light:", error));
  };

  /**
   * Handles toggling the manual fan state in Firebase Realtime Database.
   */
  const handleFanToggle = () => {
    const newFanState = sensorData.fan_manual === "ON" ? "OFF" : "ON";
    set(ref(database, "fan_manual"), newFanState)
      .then(() => console.log("Fan switched to:", newFanState))
      .catch((error) => console.error("Error updating fan:", error));
  };

  // Determine color for savings percentage circle
  const getSavingsPercentageColor = () => {
    const numValue = parseFloat(savingsPercentage);
    if (isNaN(numValue)) return "#9b59b6"; // Purple for loading/N/A
    if (numValue > 0) return "#2ecc71"; // Green for positive savings
    if (numValue < 0) return "#e74c3c"; // Red for negative savings (increased cost)
    return "#f39c12"; // Orange for zero savings
  };

  return (
    <>
      {/* Bootstrap CSS CDN for responsive design and basic styling */}
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        rel="stylesheet"
      />
      {/* Custom styles for the circular charts and switches */}
      <style>{`
        body {
          font-family: 'Inter', sans-serif; /* Using Inter font for better readability */
          background-color: #f0f2f5; /* Light gray background */
        }
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
          stroke: #e0e0e0; /* Lighter background stroke for the circle */
          stroke-width: 3.8;
        }
        .circle {
          fill: none;
          stroke-width: 3.8;
          stroke-linecap: round;
          transition: stroke-dasharray 0.5s ease; /* Smooth transition for progress updates */
        }
        .circle-text {
          fill: #333; /* Darker text for better contrast */
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
          background-color: #4CAF50; /* Green when switch is ON */
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
          color: #555;
        }
        .card {
            border-radius: 1rem; /* More rounded corners for cards */
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* Softer shadow for depth */
        }
      `}</style>

      <div className="container py-5">
        <h2 className="text-center mb-5 fw-bold text-gray-800">🌞 AI-IoT SMART ENERGY MANAGEMENT SYSTEM</h2>

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
          <span className="switch-label text-lg font-semibold">
            {sensorData.mode === "ai" ? "AI Mode" : "Manual Mode"}
          </span>
        </div>

        {/* First Row - LDR, Brightness, Temperature, Fan Speed */}
        <div className="row g-4">
          {["ldr", "brightness", "temp", "fan_speed"].map((key) => {
            const value = sensorData[key];
            const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
            // Display value for SVG stroke-dasharray (0-100)
            const displayValue = isNumeric
              ? Math.min(100, Math.max(0, parseFloat(value)))
              : 100; // Default to 100 for non-numeric (e.g., "Loading...")
            const color = getCircleColor(value); // Get color based on value

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
            const color = getCircleColor(value, false, true); // Pass true for isForSecondRow

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
        <h3 className="text-center mt-5 mb-4 fw-bold text-gray-700">Energy Calculation & Solar Savings</h3>
        <div className="row g-4">
          {["power", "current_consumption", "cost_savings", "cost_usage"].map((key) => {
            let displayValue, color, displayText, title;
            
            // Logic for current_consumption display and color
            if (key === "current_consumption") {
              const parts = sensorData.current_consumption.split('\n');
              displayText = (
                <tspan x="18" y="18">
                  {parts[0]}
                  <tspan x="18" dy="5">{parts[1]}</tspan> {/* Move percentage to new line */}
                </tspan>
              );
              const current = parseFloat(sensorData.current) || 0;
              // Display value for current consumption based on percentage
              displayValue = current > 0.5 ? 100 : (current / 0.5) * 100;
              color = getCircleColor(displayValue, true); // Use energy-related color logic
              title = "Current (0.5A max)";
            } 
            // Logic for power display and color
            else if (key === "power") {
              displayText = sensorData.power;
              const powerValue = parseFloat(sensorData.power) || 0;
              // Cap display value at 100 for the circle, but use actual for color logic
              displayValue = powerValue > 100 ? 100 : powerValue;
              color = getCircleColor(powerValue, true); // Use energy-related color logic
              title = "Power";
            }
            // Logic for cost_savings display and color
            else if (key === "cost_savings") {
              const parts = sensorData.cost_savings.split('\n');
              displayText = (
                <tspan x="18" y="18">
                  {parts[0]}
                  <tspan x="18" dy="5">{parts[1]}</tspan>
                </tspan>
              );
              displayValue = 100; // Always show full circle for savings
              color = "#2ecc71"; // Green for savings
              title = "Cost Savings"; 
            }
            // Logic for cost_usage display and color
            else { // key === "cost_usage"
              const parts = sensorData.cost_usage.split('\n');
              displayText = (
                <tspan x="18" y="18">
                  {parts[0]}
                  <tspan x="18" dy="5">{parts[1]}</tspan>
                </tspan>
              );
              displayValue = 100; // Always show full circle for usage cost
              color = "#e74c3c"; // Red for usage cost
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

        {/* New Row for Monthly Bill Comparison */}
        <h3 className="text-center mt-5 mb-4 fw-bold text-gray-700">Monthly Bill Comparison</h3>
        <div className="row g-4 justify-content-center">
          <div className="col-sm-6 col-lg-4">
            <div className="card shadow h-100 text-center p-4 border-0">
              <h5 className="mb-3">Previous Month's Bill</h5>
              <p className="display-6 fw-bold text-primary">
                {typeof previousMonthBill === 'number' ? `RM ${previousMonthBill.toFixed(2)}` : previousMonthBill}
              </p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="card shadow h-100 text-center p-4 border-0">
              <h5 className="mb-3">Current Month Bill (with Solar)</h5>
              <p className="display-6 fw-bold text-success">{estimatedCurrentMonthBill}</p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="card shadow h-100 text-center p-4 border-0">
              <h5 className="mb-3">Total Savings vs. Previous Month</h5>
              <p className="display-6 fw-bold text-info">
                {/* Conditionally format totalSavingsComparedToPrevious */}
                {typeof totalSavingsComparedToPrevious === 'number' 
                  ? `RM ${totalSavingsComparedToPrevious.toFixed(2)}` 
                  : totalSavingsComparedToPrevious}
              </p>
            </div>
          </div>
        </div>

        {/* New Graph Section */}
        <h3 className="text-center mt-5 mb-4 fw-bold text-gray-700">Monthly Bill Savings Graph</h3>
        <div className="row justify-content-center">
          <div className="col-lg-10"> {/* Wider column for the graph */}
            <div className="card shadow p-4 border-0 rounded-lg" style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Amount (RM)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `RM ${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="value" name="Amount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* New Row for Savings Percentage Chart */}
        <h3 className="text-center mt-5 mb-4 fw-bold text-gray-700">Savings Percentage</h3>
        <div className="row g-4 justify-content-center">
          <div className="col-sm-6 col-lg-4">
            <CircleChart
              value={savingsPercentage}
              title="Savings Percentage"
              color={getSavingsPercentageColor()}
              displayValue={typeof parseFloat(savingsPercentage) === 'number' ? Math.max(0, Math.min(100, parseFloat(savingsPercentage))) : 0}
            />
          </div>
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
