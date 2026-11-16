// Build-time values that must not be hard-coded in app.json:
//  - BUILD_NUMBER: Android versionCode / iOS build number (GitHub run number).
//  - GOOGLE_SERVICES_JSON: path to Firebase's google-services.json (Android
//    push via FCM). The GitHub workflow writes it from a secret; locally, drop
//    the file next to this one. Without it Android builds still work, without push.
const fs = require('fs')
const path = require('path')

module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER) || 1
  const googleServices = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : null)
  return {
    ...config,
    ios: { ...config.ios, buildNumber: String(build) },
    android: { ...config.android, versionCode: build, ...(googleServices ? { googleServicesFile: googleServices } : {}) },
    plugins: [...(config.plugins || []), './plugins/withAndroidSigning'],
  }
}
