import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { BASE_URL, setToken, setUser } from "../api/client";
import { Colors } from "../theme";

export default function WebGoogleLoginScreen({ navigation }) {
  const webBase = useMemo(() => BASE_URL.replace(/:80[0-9]{2}/, ":5173"), []);
  const loginUrl = `${webBase}/signup`;

  const injectedJS = `
    (function () {
      function sendAuth() {
        try {
          const token = localStorage.getItem("isi_token") || "";
          const user = localStorage.getItem("isi_user") || "";
          if (token) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "AUTH", token, user }));
          }
        } catch (e) {}
      }
      setInterval(sendAuth, 700);
      sendAuth();
      true;
    })();
  `;

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || "{}");
      if (payload?.type === "AUTH" && payload?.token) {
        await setToken(payload.token);
        let userObj = {};
        try {
          userObj = payload.user ? JSON.parse(payload.user) : {};
        } catch {
          userObj = {};
        }
        await setUser(userObj || {});
        navigation.replace("Home");
      }
    } catch {
      // ignore malformed webview messages
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sign in with Google</Text>
        <View style={{ width: 40 }} />
      </View>
      <WebView
        source={{ uri: loginUrl }}
        onMessage={onMessage}
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
  top: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: "#6ec6ff", fontSize: 14, fontWeight: "700" },
});

