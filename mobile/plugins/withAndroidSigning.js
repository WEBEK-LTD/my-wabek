// Signs Android release builds with the upload key from the environment
// (GitHub Actions secrets). Without WABEK_UPLOAD_STORE_FILE the release build
// keeps the template's debug signing, so local builds still work.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARK = '// wabek-release-signing'

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let g = cfg.modResults.contents
    if (g.includes(MARK)) return cfg
    // 1. a "release" signing config fed by environment variables
    g = g.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARK}
        release {
            if (System.getenv('WABEK_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('WABEK_UPLOAD_STORE_FILE'))
                storePassword System.getenv('WABEK_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('WABEK_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('WABEK_UPLOAD_KEY_PASSWORD')
            }
        }`,
    )
    // 2. the release build type uses it when the key is present
    g = g.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      `$1signingConfig System.getenv('WABEK_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    )
    cfg.modResults.contents = g
    return cfg
  })
}
