#!/bin/bash
cd "$(dirname "$0")"

echo "🔍 检查依赖..."
if [ ! -d "node_modules" ] || [ ! -d "node_modules/expo-router" ] || [ ! -d "node_modules/expo-linking" ]; then
  echo "📦 安装依赖（约需 3-5 分钟）..."
  npm install expo@~54.0.0 --legacy-peer-deps
  npx expo install expo-router expo-av expo-file-system expo-haptics \
    expo-linear-gradient expo-status-bar expo-image-picker \
    expo-document-picker expo-linking expo-print expo-sharing \
    @react-native-async-storage/async-storage \
    react-native-gesture-handler react-native-safe-area-context \
    react-native-screens react-native-svg react-native-view-shot
  echo "✅ 依赖安装完成"
else
  echo "✅ 依赖已存在"
fi

echo "🚀 启动 LoveSync v6..."
npx expo start --clear
