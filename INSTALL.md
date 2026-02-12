# 安装说明

## 安装地图依赖

本应用使用高德地图 JS API 进行地图展示，需要安装以下依赖：

```bash
npm install @amap/amap-jsapi-loader
```

## 完整依赖列表

查看 `package.json` 确认所有依赖已安装：

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-opener": "^2",
    "@tauri-apps/plugin-geolocation": "^2",
    "@amap/amap-jsapi-loader": "^1.0.1"
  }
}
```

## 安装所有依赖

在项目根目录运行：

```bash
npm install
```

## 开发运行

```bash
# Web 开发模式
npm run dev

# Tauri 桌面应用开发模式
npm run tauri dev

# Android 应用开发模式
npm run app:dev
```

## 构建

```bash
# 构建 Web 应用
npm run build

# 构建 Tauri 桌面应用
npm run tauri build

# 构建 Android 应用
npm run tauri android build
```
