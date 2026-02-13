# User Manager


## 开发

```bash
npm run tauri android dev
```

## 打包

```bash
keytool -genkey -v -keystore ~/usermgr-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias usermgr
```

```bash
npm run tauri android build
```