module.exports = {
  productName: process.env.APP_TARGET || "HeadyWeb",
  appId: `com.headysystems.${process.env.APP_TARGET || "HeadyWeb"}`,
  files: [
    "main.js",
    "package.json",
    "assets/**/*"
  ],
  directories: {
    output: `dist/${process.env.APP_TARGET || "HeadyWeb"}`
  },
  win: {
    icon: "assets/icon.png",
    target: "nsis"
  },
  mac: {
    icon: "assets/icon.png",
    target: "zip"
  },
  linux: {
    icon: "assets/icon.png",
    target: "AppImage"
  }
};
