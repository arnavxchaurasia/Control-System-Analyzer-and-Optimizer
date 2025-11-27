import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { Settings, TrendingUp, Zap, Activity, BarChart3, GitBranch, Target, Database, Brain } from 'lucide-react';

const ControlSystemAnalyzer = () => {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [systemType, setSystemType] = useState('second-order');
  
  const [params, setParams] = useState({
    kp: 1.0,
    ki: 0.5,
    kd: 0.1,
    wn: 2.0,
    zeta: 0.7,
    k: 1.0,
    tau: 1.0
  });

  const [tuningMethod, setTuningMethod] = useState('ziegler-nichols');
  const [performanceIndex, setPerformanceIndex] = useState('iae');
  
  const [analysis, setAnalysis] = useState(null);
  const [stepResponse, setStepResponse] = useState([]);
  const [bodeData, setBodeData] = useState([]);
  const [rootLocusData, setRootLocusData] = useState([]);
  const [nyquistData, setNyquistData] = useState([]);
  const [stabilityAnalysis, setStabilityAnalysis] = useState(null);
  const [comparisonSystems, setComparisonSystems] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);

  const calculateStepResponse = () => {
    const dt = 0.01;
    const tFinal = 10;
    const points = Math.floor(tFinal / dt);
    const data = [];
    
    if (systemType === 'second-order') {
      const wn = params.wn;
      const zeta = params.zeta;
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      
      for (let i = 0; i < points; i++) {
        const t = i * dt;
        let y;
        
        if (zeta < 1) {
          y = 1 - (Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta)) * 
              Math.cos(wd * t - Math.atan(zeta / Math.sqrt(1 - zeta * zeta)));
        } else if (zeta === 1) {
          y = 1 - Math.exp(-wn * t) * (1 + wn * t);
        } else {
          const s1 = -zeta * wn + wn * Math.sqrt(zeta * zeta - 1);
          const s2 = -zeta * wn - wn * Math.sqrt(zeta * zeta - 1);
          y = 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
        }
        
        data.push({ time: t, output: y, setpoint: 1 });
      }
    } else if (systemType === 'pid') {
      const Kp = params.kp;
      const Ki = params.ki;
      const Kd = params.kd;
      const tau = params.tau;
      const K = params.k;
      
      let y = 0;
      let integral = 0;
      let prevError = 0;
      
      for (let i = 0; i < points; i++) {
        const t = i * dt;
        const setpoint = 1;
        const error = setpoint - y;
        
        integral += error * dt;
        const derivative = (error - prevError) / dt;
        
        const u = Kp * error + Ki * integral + Kd * derivative;
        const dydt = (K * u - y) / tau;
        
        y += dydt * dt;
        prevError = error;
        
        data.push({ time: t, output: y, setpoint: 1, control: u });
      }
    } else if (systemType === 'first-order') {
      const K = params.k;
      const tau = params.tau;
      
      for (let i = 0; i < points; i++) {
        const t = i * dt;
        const y = K * (1 - Math.exp(-t / tau));
        data.push({ time: t, output: y, setpoint: K });
      }
    }
    
    setStepResponse(data);
    analyzePerformance(data);
  };

  const analyzePerformance = (data) => {
    const finalValue = data[data.length - 1].output;
    const settlingBand = 0.02 * finalValue;
    
    const y10 = 0.1 * finalValue;
    const y90 = 0.9 * finalValue;
    const t10 = data.find(d => d.output >= y10)?.time || 0;
    const t90 = data.find(d => d.output >= y90)?.time || 0;
    const riseTime = t90 - t10;
    
    let peakValue = 0;
    let peakTime = 0;
    data.forEach(d => {
      if (d.output > peakValue) {
        peakValue = d.output;
        peakTime = d.time;
      }
    });
    const overshoot = ((peakValue - finalValue) / finalValue) * 100;
    
    let settlingTime = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i].output - finalValue) > settlingBand) {
        settlingTime = data[i].time;
        break;
      }
    }
    
    const steadyStateError = Math.abs(1 - finalValue);
    
    setAnalysis({
      riseTime: riseTime.toFixed(3),
      peakTime: peakTime.toFixed(3),
      overshoot: overshoot.toFixed(2),
      settlingTime: settlingTime.toFixed(3),
      steadyStateError: steadyStateError.toFixed(4),
      peakValue: peakValue.toFixed(3)
    });
  };

  const calculateBode = () => {
    const data = [];
    const startFreq = 0.01;
    const endFreq = 100;
    const points = 100;
    
    for (let i = 0; i < points; i++) {
      const w = startFreq * Math.pow(endFreq / startFreq, i / (points - 1));
      
      let magnitude;
      let phase;
      
      if (systemType === 'second-order') {
        const wn = params.wn;
        const zeta = params.zeta;
        const ratio = w / wn;
        
        magnitude = 20 * Math.log10(1 / Math.sqrt(
          Math.pow(1 - ratio * ratio, 2) + Math.pow(2 * zeta * ratio, 2)
        ));
        
        phase = -Math.atan2(2 * zeta * ratio, 1 - ratio * ratio) * 180 / Math.PI;
      } else {
        const tau = params.tau;
        magnitude = 20 * Math.log10(1 / Math.sqrt(1 + Math.pow(w * tau, 2)));
        phase = -Math.atan(w * tau) * 180 / Math.PI;
      }
      
      data.push({
        frequency: w,
        magnitude: magnitude,
        phase: phase
      });
    }
    
    setBodeData(data);
  };

  const calculateRootLocus = () => {
    const data = [];
    const kValues = [];
    
    for (let i = 0; i <= 100; i++) {
      kValues.push(i * 0.1);
    }
    
    if (systemType === 'second-order') {
      const wn = params.wn;
      const zeta = params.zeta;
      
      kValues.forEach(k => {
        const effectiveZeta = zeta * Math.sqrt(1 + k);
        const effectiveWn = wn * Math.sqrt(1 + k);
        
        if (effectiveZeta < 1) {
          const real = -effectiveZeta * effectiveWn;
          const imag = effectiveWn * Math.sqrt(1 - effectiveZeta * effectiveZeta);
          data.push({ real, imag, k, pole: 1 });
          data.push({ real, imag: -imag, k, pole: 2 });
        } else {
          const s1 = -effectiveZeta * effectiveWn + effectiveWn * Math.sqrt(effectiveZeta * effectiveZeta - 1);
          const s2 = -effectiveZeta * effectiveWn - effectiveWn * Math.sqrt(effectiveZeta * effectiveZeta - 1);
          data.push({ real: s1, imag: 0, k, pole: 1 });
          data.push({ real: s2, imag: 0, k, pole: 2 });
        }
      });
    }
    
    setRootLocusData(data);
  };

  const calculateNyquist = () => {
    const data = [];
    const startFreq = 0.01;
    const endFreq = 100;
    const points = 200;
    
    for (let i = 0; i < points; i++) {
      const w = startFreq * Math.pow(endFreq / startFreq, i / (points - 1));
      
      if (systemType === 'second-order') {
        const wn = params.wn;
        const zeta = params.zeta;
        const ratio = w / wn;
        
        const denomReal = 1 - ratio * ratio;
        const denomImag = 2 * zeta * ratio;
        const denomMag = Math.sqrt(denomReal * denomReal + denomImag * denomImag);
        
        const real = denomReal / (denomMag * denomMag);
        const imag = -denomImag / (denomMag * denomMag);
        
        data.push({ real, imag, frequency: w });
      }
    }
    
    setNyquistData(data);
  };

  const analyzeStability = () => {
    let isStable = false;
    let gainMargin = 0;
    let phaseMargin = 0;
    let stabilityType = '';
    
    if (systemType === 'second-order') {
      const zeta = params.zeta;
      const wn = params.wn;
      
      if (zeta > 0 && wn > 0) {
        isStable = true;
        
        if (zeta < 1) {
          stabilityType = 'Underdamped - Oscillatory';
          phaseMargin = Math.atan(2 * zeta / Math.sqrt(Math.sqrt(1 + 4 * zeta * zeta * zeta * zeta) - 2 * zeta * zeta)) * 180 / Math.PI;
        } else if (zeta === 1) {
          stabilityType = 'Critically Damped - Optimal';
          phaseMargin = 65.5;
        } else {
          stabilityType = 'Overdamped - Slow Response';
          phaseMargin = 90;
        }
        
        gainMargin = 20 * Math.log10(1 / (2 * zeta));
      } else {
        isStable = false;
        stabilityType = 'Unstable';
      }
    } else if (systemType === 'pid') {
      const Kp = params.kp;
      
      if (Kp > 0) {
        isStable = true;
        stabilityType = 'Stable with PID Control';
        gainMargin = 15;
        phaseMargin = 60;
      }
    }
    
    setStabilityAnalysis({
      isStable,
      gainMargin: gainMargin.toFixed(2),
      phaseMargin: phaseMargin.toFixed(2),
      stabilityType
    });
  };

  const addSystemToComparison = () => {
    const newSystem = {
      id: Date.now(),
      name: `System ${comparisonSystems.length + 1}`,
      params: { ...params },
      systemType,
      color: ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6'][comparisonSystems.length % 5]
    };
    
    setComparisonSystems([...comparisonSystems, newSystem]);
    calculateComparisonData([...comparisonSystems, newSystem]);
  };

  const calculateComparisonData = (systems) => {
    const dt = 0.01;
    const tFinal = 10;
    const points = Math.floor(tFinal / dt);
    const data = [];
    
    for (let i = 0; i < points; i++) {
      const t = i * dt;
      const point = { time: t };
      
      systems.forEach(sys => {
        let y = 0;
        
        if (sys.systemType === 'second-order') {
          const wn = sys.params.wn;
          const zeta = sys.params.zeta;
          const wd = wn * Math.sqrt(1 - zeta * zeta);
          
          if (zeta < 1) {
            y = 1 - (Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta)) * 
                Math.cos(wd * t - Math.atan(zeta / Math.sqrt(1 - zeta * zeta)));
          }
        } else if (sys.systemType === 'first-order') {
          const K = sys.params.k;
          const tau = sys.params.tau;
          y = K * (1 - Math.exp(-t / tau));
        }
        
        point[`system_${sys.id}`] = y;
      });
      
      data.push(point);
    }
    
    setComparisonData(data);
  };

  const optimizeController = () => {
    let optimizedParams = { ...params };
    
    if (tuningMethod === 'ziegler-nichols') {
      const Ku = 4.0;
      const Pu = 2 * Math.PI / params.wn;
      
      optimizedParams.kp = 0.6 * Ku;
      optimizedParams.ki = 1.2 * Ku / Pu;
      optimizedParams.kd = 0.075 * Ku * Pu;
    } else if (tuningMethod === 'cohen-coon') {
      const K = params.k;
      const tau = params.tau;
      const theta = 0.1;
      
      const R = theta / tau;
      optimizedParams.kp = (1 / K) * (1 / R) * (1.35 + 0.25 * R);
      optimizedParams.ki = optimizedParams.kp / (tau * (2.5 - 2 * R) / (1 + 0.6 * R));
      optimizedParams.kd = optimizedParams.kp * tau * (0.37 - 0.37 * R) / (1 + 0.2 * R);
    } else if (tuningMethod === 'imc') {
      const lambda = params.tau / 3;
      optimizedParams.kp = params.tau / (params.k * lambda);
      optimizedParams.ki = optimizedParams.kp / params.tau;
      optimizedParams.kd = 0;
    }
    
    setParams(optimizedParams);
    alert(`Controller optimized using ${tuningMethod}!\nKp: ${optimizedParams.kp.toFixed(3)}\nKi: ${optimizedParams.ki.toFixed(3)}\nKd: ${optimizedParams.kd.toFixed(3)}`);
  };

  useEffect(() => {
    calculateStepResponse();
    calculateBode();
    calculateRootLocus();
    calculateNyquist();
    analyzeStability();
  }, [params, systemType]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                <Activity className="text-blue-600" />
                Advanced Control System Analyzer & Optimizer
              </h1>
              <p className="text-gray-600">Comprehensive ECE Control Systems Analysis Tool</p>
            </div>
            
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6">
            {[
              { id: 'analyzer', icon: BarChart3, label: 'Analyzer' },
              { id: 'optimizer', icon: Zap, label: 'Optimizer' },
              { id: 'frequency', icon: TrendingUp, label: 'Frequency' },
              { id: 'rootlocus', icon: GitBranch, label: 'Root Locus' },
              { id: 'stability', icon: Target, label: 'Stability' },
              { id: 'comparison', icon: Database, label: 'Compare' }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 font-semibold flex items-center justify-center gap-2 text-sm ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Settings size={20} />
            System Configuration
          </h2>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              System Type
            </label>
            <select
              value={systemType}
              onChange={(e) => setSystemType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="second-order">Second-Order System</option>
              <option value="pid">PID Controlled System</option>
              <option value="first-order">First-Order System</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {systemType === 'second-order' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Natural Frequency (ωn)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.wn}
                    onChange={(e) => setParams({...params, wn: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Damping Ratio (ζ)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.zeta}
                    onChange={(e) => setParams({...params, zeta: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            
            {systemType === 'pid' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kp (Proportional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.kp}
                    onChange={(e) => setParams({...params, kp: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ki (Integral)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.ki}
                    onChange={(e) => setParams({...params, ki: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kd (Derivative)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.kd}
                    onChange={(e) => setParams({...params, kd: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Time Constant (τ)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.tau}
                    onChange={(e) => setParams({...params, tau: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            
            {systemType === 'first-order' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gain (K)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.k}
                    onChange={(e) => setParams({...params, k: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Time Constant (τ)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.tau}
                    onChange={(e) => setParams({...params, tau: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {activeTab === 'analyzer' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Step Response</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={stepResponse}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="output" stroke="#2563eb" strokeWidth={2} dot={false} name="System Output" />
                  <Line type="monotone" dataKey="setpoint" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Setpoint" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {analysis && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Performance Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Rise Time</p>
                    <p className="text-2xl font-bold text-blue-600">{analysis.riseTime} s</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Peak Time</p>
                    <p className="text-2xl font-bold text-green-600">{analysis.peakTime} s</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Overshoot</p>
                    <p className="text-2xl font-bold text-purple-600">{analysis.overshoot}%</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Settling Time</p>
                    <p className="text-2xl font-bold text-orange-600">{analysis.settlingTime} s</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Steady-State Error</p>
                    <p className="text-2xl font-bold text-red-600">{analysis.steadyStateError}</p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Peak Value</p>
                    <p className="text-2xl font-bold text-indigo-600">{analysis.peakValue}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'optimizer' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Controller Optimization</h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tuning Method
                </label>
                <select
                  value={tuningMethod}
                  onChange={(e) => setTuningMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ziegler-nichols">Ziegler-Nichols</option>
                  <option value="cohen-coon">Cohen-Coon</option>
                  <option value="imc">Internal Model Control (IMC)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Performance Index
                </label>
                <select
                  value={performanceIndex}
                  onChange={(e) => setPerformanceIndex(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="iae">IAE (Integral Absolute Error)</option>
                  <option value="ise">ISE (Integral Square Error)</option>
                  <option value="itae">ITAE (Integral Time Absolute Error)</option>
                </select>
              </div>
            </div>

            <button
              onClick={optimizeController}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={20} />
              Optimize Controller Parameters
            </button>

            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Current PID Parameters:</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Kp</p>
                  <p className="text-xl font-bold text-blue-600">{params.kp.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ki</p>
                  <p className="text-xl font-bold text-green-600">{params.ki.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Kd</p>
                  <p className="text-xl font-bold text-purple-600">{params.kd.toFixed(3)}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
              <h3 className="font-semibold text-gray-800 mb-2">Tuning Method Info:</h3>
              {tuningMethod === 'ziegler-nichols' && (
                <p className="text-sm text-gray-700">
                  The Ziegler-Nichols method is a classical tuning approach that provides good disturbance rejection. 
                  It may produce significant overshoot but offers fast response.
                </p>
              )}
              {tuningMethod === 'cohen-coon' && (
                <p className="text-sm text-gray-700">
                  Cohen-Coon tuning is effective for processes with significant dead time. 
                  It provides better performance than Ziegler-Nichols for lag-dominant processes.
                </p>
              )}
              {tuningMethod === 'imc' && (
                <p className="text-sm text-gray-700">
                  Internal Model Control tuning provides robust performance with single tuning parameter. 
                  It offers good setpoint tracking with minimal overshoot.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'frequency' && (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Bode Plot - Magnitude</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={bodeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="frequency" 
                    scale="log" 
                    domain={['auto', 'auto']}
                    label={{ value: 'Frequency (rad/s)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Magnitude (dB)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="magnitude" stroke="#2563eb" strokeWidth={2} dot={false} name="Magnitude" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Bode Plot - Phase</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={bodeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="frequency" 
                    scale="log" 
                    domain={['auto', 'auto']}
                    label={{ value: 'Frequency (rad/s)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Phase (degrees)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="phase" stroke="#dc2626" strokeWidth={2} dot={false} name="Phase" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Nyquist Plot</h2>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="real" 
                    label={{ value: 'Real Axis', position: 'insideBottom', offset: -5 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    dataKey="imag"
                    label={{ value: 'Imaginary Axis', angle: -90, position: 'insideLeft' }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine x={-1} stroke="red" strokeDasharray="3 3" label="Critical Point" />
                  <ReferenceLine y={0} stroke="gray" />
                  <ReferenceLine x={0} stroke="gray" />
                  <Scatter data={nyquistData} fill="#2563eb" name="Nyquist Contour" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'rootlocus' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Root Locus Plot</h2>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="real" 
                  label={{ value: 'Real Axis (σ)', position: 'insideBottom', offset: -5 }}
                  domain={['auto', 'auto']}
                />
                <YAxis 
                  dataKey="imag"
                  label={{ value: 'Imaginary Axis (jω)', angle: -90, position: 'insideLeft' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  content={({ payload }) => {
                    if (payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                          <p className="text-sm"><strong>K:</strong> {data.k?.toFixed(2)}</p>
                          <p className="text-sm"><strong>Real:</strong> {data.real?.toFixed(3)}</p>
                          <p className="text-sm"><strong>Imag:</strong> {data.imag?.toFixed(3)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <ReferenceLine y={0} stroke="gray" />
                <ReferenceLine x={0} stroke="red" strokeDasharray="3 3" label="Stability Boundary" />
                <Scatter 
                  data={rootLocusData.filter(d => d.pole === 1)} 
                  fill="#2563eb" 
                  name="Pole 1 Locus"
                />
                <Scatter 
                  data={rootLocusData.filter(d => d.pole === 2)} 
                  fill="#dc2626" 
                  name="Pole 2 Locus"
                />
              </ScatterChart>
            </ResponsiveContainer>
            
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-l-4 border-blue-600">
              <h3 className="font-semibold text-gray-800 mb-2">Root Locus Analysis:</h3>
              <p className="text-sm text-gray-700 mb-2">
                The root locus shows how the closed-loop poles move in the s-plane as the gain K varies from 0 to ∞.
              </p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Poles in the left half-plane indicate a stable system</li>
                <li>• Poles on the imaginary axis indicate marginal stability</li>
                <li>• Poles in the right half-plane indicate an unstable system</li>
                <li>• Distance from origin indicates natural frequency</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'stability' && stabilityAnalysis && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Stability Analysis</h2>
            
            <div className={`p-6 rounded-lg mb-6 ${stabilityAnalysis.isStable ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stabilityAnalysis.isStable ? 'bg-green-500' : 'bg-red-500'}`}>
                  <Target className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {stabilityAnalysis.isStable ? 'System is STABLE' : 'System is UNSTABLE'}
                  </h3>
                  <p className="text-gray-600">{stabilityAnalysis.stabilityType}</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="text-blue-600" />
                  Gain Margin
                </h3>
                <p className="text-3xl font-bold text-blue-600 mb-2">{stabilityAnalysis.gainMargin} dB</p>
                <p className="text-sm text-gray-600">
                  Indicates how much the gain can be increased before the system becomes unstable.
                </p>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Activity className="text-purple-600" />
                  Phase Margin
                </h3>
                <p className="text-3xl font-bold text-purple-600 mb-2">{stabilityAnalysis.phaseMargin}°</p>
                <p className="text-sm text-gray-600">
                  Indicates how much phase lag can be added before the system becomes unstable.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border-l-4 border-indigo-600">
              <h3 className="font-semibold text-gray-800 mb-3">Stability Criteria:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Routh-Hurwitz Criterion</h4>
                  <p className="text-sm text-gray-600">
                    For a system to be stable, all poles must have negative real parts (left half of s-plane).
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Nyquist Criterion</h4>
                  <p className="text-sm text-gray-600">
                    The Nyquist plot should not encircle the critical point (-1, 0) for stability.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
              <h3 className="font-semibold text-gray-800 mb-2">Design Recommendations:</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>• Gain Margin greater than 6 dB - Adequate robustness to gain variations</li>
                <li>• Phase Margin greater than 45° - Good stability with acceptable overshoot</li>
                <li>• Phase Margin greater than 60° - Excellent stability with minimal overshoot</li>
                <li>• Current damping ratio (ζ = {params.zeta}) - {params.zeta < 0.4 ? 'Increase for better stability' : params.zeta > 0.8 ? 'Decrease for faster response' : 'Optimal range'}</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">System Comparison Tool</h2>
            
            <button
              onClick={addSystemToComparison}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 mb-6"
            >
              <Database size={20} />
              Add Current System to Comparison
            </button>

            {comparisonSystems.length > 0 && (
              <>
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Saved Systems:</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {comparisonSystems.map(sys => (
                      <div key={sys.id} className="border-2 rounded-lg p-4" style={{ borderColor: sys.color }}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold" style={{ color: sys.color }}>{sys.name}</h4>
                          <button
                            onClick={() => {
                              const updated = comparisonSystems.filter(s => s.id !== sys.id);
                              setComparisonSystems(updated);
                              calculateComparisonData(updated);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-sm text-gray-600">Type: {sys.systemType}</p>
                        {sys.systemType === 'second-order' && (
                          <p className="text-sm text-gray-600">ωn: {sys.params.wn}, ζ: {sys.params.zeta}</p>
                        )}
                        {sys.systemType === 'pid' && (
                          <p className="text-sm text-gray-600">Kp: {sys.params.kp.toFixed(2)}, Ki: {sys.params.ki.toFixed(2)}, Kd: {sys.params.kd.toFixed(2)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-4">Comparative Step Response</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'Amplitude', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      {comparisonSystems.map(sys => (
                        <Line 
                          key={sys.id}
                          type="monotone" 
                          dataKey={`system_${sys.id}`}
                          stroke={sys.color}
                          strokeWidth={2}
                          dot={false}
                          name={sys.name}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
                  <h3 className="font-semibold text-gray-800 mb-2">Comparison Insights:</h3>
                  <p className="text-sm text-gray-700">
                    Compare different system configurations to understand trade-offs between response speed, 
                    overshoot, and stability. Experiment with various damping ratios and controller gains 
                    to see their effects in real-time.
                  </p>
                </div>
              </>
            )}

            {comparisonSystems.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Database className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">No systems added yet. Configure a system and click Add Current System to start comparing.</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Brain className="text-blue-600" size={24} />
              <h3 className="text-xl font-bold text-gray-800">Advanced Control System Analyzer</h3>
            </div>
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-gray-600 mb-2">Developed as ECE Course Project</p>
              <p className="text-lg font-bold text-blue-600">Made by Divyanshu and Sourav</p>
              <p className="text-sm text-gray-600 mb-2">EEE - 5th Semester</p>
              <p className="text-xs text-gray-500">
                Featuring: Step Response Analysis • PID Optimization • Bode Plots • Root Locus • Nyquist Plots • Stability Analysis • System Comparison
              </p>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              © 2024 Control Systems Project • Built with React & Recharts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlSystemAnalyzer;
