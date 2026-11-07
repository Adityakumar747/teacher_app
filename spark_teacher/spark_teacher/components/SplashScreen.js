import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SplashScreen = ({ onFinish }) => {
  const [showSplash, setShowSplash] = useState(true);
  const hasFinishedRef = useRef(false);

  const htmlContent = `<!DOCTYPE html><html class="dark" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Sparkology Thunder Strike Splash</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#F59E0B",
                        secondary: "#1E3A8A",
                        "background-dark": "#020617",
                    },
                    fontFamily: {
                        display: ["Inter", "sans-serif"],
                    },
                },
            },
        };
    </script>
<style type="text/tailwindcss">
        :root {
            --spark-orange: #f97316;
            --spark-yellow: #fbbf24;
            --spark-blue: #3b82f6;
            --spark-navy: #020617;
            --strike-white: #ffffff;
        }
        @keyframes lightning-jagged-strike {
            0% { transform: translateY(-100%) scaleY(2); opacity: 0; filter: brightness(3) blur(2px); }
            5% { opacity: 1; }
            15% { transform: translateY(0) scaleY(1); opacity: 1; filter: brightness(5) blur(0px); }
            20% { opacity: 0; }
            25% { opacity: 1; filter: brightness(10); }
            35% { opacity: 0; transform: scale(1.2); }
            100% { opacity: 0; }
        }
        @keyframes impact-flare {
            0%, 15% { transform: scale(0); opacity: 0; }
            20% { transform: scale(4); opacity: 1; filter: brightness(5); }
            50% { transform: scale(1.5); opacity: 0; filter: blur(20px); }
            100% { transform: scale(0); opacity: 0; }
        }
        @keyframes energy-ripple {
            0%, 18% { transform: scale(0.5); opacity: 0; border-width: 20px; }
            30% { transform: scale(2.5); opacity: 0.8; border-width: 1px; }
            60% { transform: scale(4); opacity: 0; border-width: 0px; }
            100% { transform: scale(4); opacity: 0; }
        }
        @keyframes logo-resolve {
            0% { transform: scale(0.2); opacity: 0; filter: brightness(5) blur(10px); }
            40% { transform: scale(1.1); opacity: 1; filter: brightness(2) blur(2px); }
            100% { transform: scale(1); opacity: 1; filter: brightness(1) blur(0px); }
        }
        @keyframes cloud-drift {
            0% { transform: translate(0, 0) scale(1); opacity: 0.3; }
            50% { transform: translate(2%, 1%) scale(1.1); opacity: 0.5; }
            100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
        }
        @keyframes text-slide-in {
            0% { transform: translateY(15px); opacity: 0; filter: blur(10px); }
            100% { transform: translateY(0); opacity: 1; filter: blur(0px); }
        }
        @keyframes background-jolt {
            0%, 14% { background-color: var(--spark-navy); }
            15% { background-color: #1e293b; }
            18% { background-color: #334155; }
            22% { background-color: var(--spark-navy); }
        }
        .strike-path {
            clip-path: polygon(45% 0%, 55% 0%, 40% 30%, 60% 35%, 35% 70%, 50% 75%, 20% 100%, 35% 100%, 60% 70%, 45% 65%, 75% 30%, 55% 25%);
            animation: lightning-jagged-strike 1.2s ease-out forwards;
        }
        .impact-circle {
            animation: impact-flare 1.5s ease-out forwards;
        }
        .ripple {
            animation: energy-ripple 1.8s ease-out forwards;
        }
        .logo-container {
            animation: logo-resolve 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s forwards;
            opacity: 0;
        }
        .text-reveal {
            animation: text-slide-in 0.8s ease-out 1.4s forwards;
            opacity: 0;
        }
        .cloud-texture {
            background: radial-gradient(circle at 50% 50%, rgba(30, 58, 138, 0.2) 0%, transparent 70%);
            filter: blur(60px);
            animation: cloud-drift 8s infinite ease-in-out;
        }
        .custom-bolt-mask {
            clip-path: polygon(45% 0%, 100% 0%, 70% 45%, 95% 45%, 25% 100%, 45% 55%, 15% 55%);
            background: linear-gradient(180deg, var(--spark-yellow) 0%, var(--spark-orange) 100%);
        }
        .jolt-bg {
            animation: background-jolt 2s ease-out forwards;
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
      margin: 0;
      padding: 0;
    }
  </style>
  </head>
<body class="font-display antialiased overflow-hidden bg-background-dark">
<div class="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden jolt-bg">
<div class="absolute inset-0 z-0">
<div class="absolute top-[-10%] left-[-20%] w-[150%] h-[60%] cloud-texture opacity-40"></div>
<div class="absolute bottom-[-10%] right-[-20%] w-[120%] h-[50%] cloud-texture opacity-30" style="animation-delay: -2s;"></div>
<div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay"></div>
</div>
<div class="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
<div class="absolute top-0 w-24 h-[55%] strike-path bg-gradient-to-b from-blue-400 via-white to-blue-200 shadow-[0_0_50px_rgba(255,255,255,0.8)]"></div>
<div class="absolute top-[50%] flex items-center justify-center">
<div class="impact-circle w-64 h-64 rounded-full bg-white blur-xl mix-blend-screen"></div>
<div class="impact-circle w-96 h-96 rounded-full bg-blue-500/40 blur-3xl mix-blend-screen" style="animation-delay: 0.1s;"></div>
<div class="ripple absolute w-40 h-40 border-4 border-blue-400/50 rounded-full"></div>
<div class="ripple absolute w-40 h-40 border-4 border-white/30 rounded-full" style="animation-delay: 0.2s;"></div>
<div class="ripple absolute w-40 h-40 border-4 border-orange-500/20 rounded-full" style="animation-delay: 0.4s;"></div>
</div>
</div>
<div class="relative flex flex-col items-center z-50">
<div class="logo-container relative">
<div class="w-40 h-40 flex items-center justify-center rounded-full bg-[#0a0f1e] border-[3px] border-blue-900/40 shadow-[0_0_40px_rgba(30,58,138,0.4),inset_0_0_20px_rgba(30,58,138,0.3)]">
<div class="absolute inset-0 rounded-full bg-orange-500/10 blur-xl animate-pulse"></div>
<div class="relative w-24 h-24 flex items-center justify-center">
<div class="custom-bolt-mask w-16 h-20 z-20 shadow-[0_0_25px_rgba(249,115,22,0.6)]"></div>
<div class="custom-bolt-mask w-16 h-20 absolute opacity-30 translate-x-1 translate-y-1 z-10 scale-110 blur-sm" style="background: var(--spark-blue);"></div>
</div>
</div>
</div>
<div class="mt-12 text-center text-reveal">
<div class="flex items-center justify-center space-x-1">
<span class="text-6xl font-black text-white tracking-tighter" style="">S</span>
<span class="text-6xl font-black text-orange-500 tracking-tighter relative" style="">
                    P
                    <div class="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full blur-[1px] shadow-[0_0_10px_#fbbf24]"></div>
</span>
<span class="text-6xl font-black text-white tracking-tighter" style="">A</span>
<span class="text-6xl font-black text-white tracking-tighter" style="">R</span>
<span class="text-6xl font-black text-white tracking-tighter" style="">K</span>
</div>
<p class="mt-4 text-[10px] font-bold tracking-[0.8em] uppercase text-slate-400/60 pl-[0.8em]" style="">
                Educational ERP</p>
</div>
</div>
<div class="absolute bottom-16 w-full flex flex-col items-center text-reveal" style="animation-delay: 2s">
<div class="w-24 h-[1px] bg-white/10 rounded-full overflow-hidden">
<div class="h-full bg-gradient-to-r from-transparent via-orange-500 to-transparent w-full origin-left animate-[loading_2s_ease-in-out_infinite]"></div>
</div>
</div>
<style>
        @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
    </style>
</div>

<script>
    setTimeout(() => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('finished');
      }
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage('finished', '*');
        }
      } catch(e) {}
    }, 4500);
</script>
</body></html>`;

  // Fallback timeout in case WebView messaging fails
  useEffect(() => {
    const handleWebMsg = (e) => {
      if (e.data === 'finished') {
        handleFinish();
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('message', handleWebMsg);
    }

    const fallbackTimeout = setTimeout(() => {
      handleFinish();
    }, 5000);

    return () => {
      clearTimeout(fallbackTimeout);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('message', handleWebMsg);
      }
    };
  }, []);

  const handleFinish = () => {
    if (!hasFinishedRef.current) {
      hasFinishedRef.current = true;
      setShowSplash(false);
      if (onFinish) {
        onFinish();
      }
    }
  };

  const handleMessage = (event) => {
    if (event.nativeEvent.data === 'finished') {
      handleFinish();
    }
  };

  if (!showSplash) {
    return null;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.outerContainer}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="splash-screen"
        />
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <WebView
        source={{ html: htmlContent }}
        style={[styles.webview, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={handleMessage}
        originWhitelist={['*']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        }
      : {}),
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: '#020617',
    flex: 1,
  },
});

export default SplashScreen;


