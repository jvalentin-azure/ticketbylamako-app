const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const GOOGLE_WALLET_META_NAME = "com.google.android.gms.wallet.api.enabled";

module.exports = function withWalletKit(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      androidConfig.modResults,
    );
    const metaData = application["meta-data"] || [];
    const existing = metaData.find(
      (entry) => entry.$?.["android:name"] === GOOGLE_WALLET_META_NAME,
    );

    if (existing) {
      existing.$["android:value"] = "true";
    } else {
      metaData.push({
        $: {
          "android:name": GOOGLE_WALLET_META_NAME,
          "android:value": "true",
        },
      });
    }

    application["meta-data"] = metaData;
    return androidConfig;
  });
};
