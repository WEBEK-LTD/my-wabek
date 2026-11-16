// Adds values that must not be hard-coded in app.json:
//  - EAS_PROJECT_ID: the Expo project id (`eas init` prints it); push notifications need it.
//  - GOOGLE_SERVICES_JSON: path to Firebase's google-services.json (Android push).
//    On EAS, add it as a "file" environment variable; locally, drop the file
//    next to this one. Without it the Android app still builds, just without push.
const fs = require('fs')
const path = require('path')

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || ''
  const googleServices = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : null)
  return {
    ...config,
    android: { ...config.android, ...(googleServices ? { googleServicesFile: googleServices } : {}) },
    extra: { ...config.extra, eas: { ...(config.extra?.eas || {}), projectId } },
  }
}
