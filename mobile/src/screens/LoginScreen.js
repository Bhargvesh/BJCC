import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiPost, setToken, setUser } from "../api/client";

const { height: SCREEN_H } = Dimensions.get("window");
const BLUE = "#1A4FC4";
const HEADER_H = SCREEN_H * 0.42;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // ── mount animation ──
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 380, useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 380, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    setMsg(""); setOkMsg("");
    if (!email.trim() || !password.trim()) {
      setMsg("Please enter username/email and password."); return;
    }
    setLoading(true);
    try {
      const data = await apiPost("/api/innovation/auth/login", {
        email: email.trim(),
        password,
      });
      // apiPost resolves with parsed JSON on success
      if (data?.token) {
        await setToken(data.token);
        await setUser(data.user || {});
        setOkMsg("Login successful!");
        setTimeout(() => navigation.replace("Main"), 300);
      } else {
        setMsg("Login failed. Please try again.");
      }
    } catch (err) {
      // apiFetch throws on non-2xx — extract detail from error message
      const raw = err?.message || "";
      if (raw.includes("401") || raw.toLowerCase().includes("invalid")) {
        setMsg("Invalid email or password.");
      } else if (raw.includes("Cannot connect") || raw.includes("Network") || raw.includes("fetch")) {
        setMsg("Cannot connect to server. Check your connection.");
      } else {
        // Try to extract FastAPI detail from message like "API 400: {\"detail\":\"..\"}"
        try {
          const jsonStart = raw.indexOf("{");
          if (jsonStart !== -1) {
            const parsed = JSON.parse(raw.slice(jsonStart));
            setMsg(parsed.detail || "Login failed.");
          } else {
            setMsg("Login failed. Please try again.");
          }
        } catch {
          setMsg("Login failed. Please try again.");
        }
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Blue curved header ── */}
      <View style={styles.blueSection}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={22} color="#FFF" />
        </TouchableOpacity>

        {/* Ashoka Emblem — WHITE badge so dark emblem is visible */}
        <View style={styles.emblemBadge}>
          <Image
            source={require("../../assets/ashoka-emblem.png")}
            style={styles.emblemImg}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.brandName}>BJCC</Text>
        <Text style={styles.brandSub}>Bharat Judicial Court Connect</Text>
      </View>

      {/* ── Animated card ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formWrapper}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.cardTitle}>Sign In Now</Text>

            <View style={styles.inputRow}>
              <Feather name="user" size={16} color="#AABBD4" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                value={email}
                onChangeText={setEmail}
                placeholder="Jones John"
                placeholderTextColor="#C0CEDF"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputRow}>
              <Feather name="lock" size={16} color="#AABBD4" style={styles.inputIcon} />
              <TextInput
                style={[styles.inputField, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#C0CEDF"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={16} color="#AABBD4" />
              </TouchableOpacity>
            </View>

            <View style={styles.rememberRow}>
              <TouchableOpacity style={styles.rememberLeft} onPress={() => setRememberMe(v => !v)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                  {rememberMe && <Feather name="check" size={10} color="#FFF" />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </View>

            {!!msg   && <Text style={styles.err}>{msg}</Text>}
            {!!okMsg && <Text style={styles.ok}>{okMsg}</Text>}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>SIGN IN</Text>
              }
            </TouchableOpacity>

            <Text style={styles.switchText}>Don't you have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.switchLink}>Sign Up from here</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8EFFC" },

  /* ── Header ── */
  blueSection: {
    height: HEADER_H,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 56,
    paddingTop: 16,
  },
  backBtn: {
    position: "absolute",
    top: 44,
    left: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Emblem badge — white circle so dark logo is visible ── */
  emblemBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFFFFF",          // ← white background
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emblemImg: {
    width: 68,
    height: 68,
    // NO tintColor — show the real dark emblem image
  },

  /* ── Brand ── */
  brandName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 0,
    marginBottom: 4,
  },
  brandSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  /* ── Form ── */
  formWrapper: {
    flex: 1,
    marginTop: -HEADER_H * 0.28,
  },
  scroll: { paddingHorizontal: 22, paddingBottom: 30 },

  /* ── Card ── */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
    alignItems: "center",
    shadowColor: BLUE,
    shadowOpacity: 0.13,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: BLUE,
    marginBottom: 22,
  },

  /* ── Inputs ── */
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#D5E3F8",
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 14,
    backgroundColor: "#FAFCFF",
    width: "100%",
  },
  inputIcon: { marginRight: 10 },
  inputField: { flex: 1, fontSize: 13.5, color: "#1A2E6B" },

  /* ── Remember ── */
  rememberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 22,
  },
  rememberLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkbox: {
    width: 16, height: 16, borderRadius: 3,
    borderWidth: 1.5, borderColor: "#C5D8F8",
    backgroundColor: "#FFF", alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: BLUE, borderColor: BLUE },
  rememberText: { color: "#8898AA", fontSize: 11.5 },
  forgotText: { color: BLUE, fontSize: 11.5, fontWeight: "600" },

  /* ── Button ── */
  actionBtn: {
    backgroundColor: BLUE,
    borderRadius: 32,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 18,
    shadowColor: BLUE,
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  actionBtnText: { color: "#FFF", fontSize: 13.5, fontWeight: "800", letterSpacing: 1.4 },

  /* ── Switch ── */
  switchText: { color: "#8898AA", fontSize: 12, textAlign: "center", marginBottom: 3 },
  switchLink: { color: BLUE, fontWeight: "700", fontSize: 13, textAlign: "center" },

  err: { color: "#D33A2C", marginBottom: 8, textAlign: "center", fontSize: 12 },
  ok:  { color: "#14804A", marginBottom: 8, textAlign: "center", fontSize: 12 },
});
