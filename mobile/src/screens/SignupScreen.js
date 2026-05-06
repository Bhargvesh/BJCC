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
const HEADER_H = SCREEN_H * 0.36;

export default function SignupScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
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

  const handleSignup = async () => {
    setMsg(""); setOkMsg("");
    if (!fullName.trim() || !email.trim() || !password.trim() || !repeatPassword.trim()) {
      setMsg("Please fill all fields."); return;
    }
    if (password.length < 6) {
      setMsg("Password must be at least 6 characters."); return;
    }
    if (password !== repeatPassword) {
      setMsg("Passwords do not match."); return;
    }
    if (!agreed) {
      setMsg("Please agree to the Terms and Conditions."); return;
    }
    const rawContact = email.trim();
    const emailVal = rawContact.includes("@")
      ? rawContact
      : `${rawContact.replace(/\s+/g, "")}@mobile.bjcc`;

    setLoading(true);
    try {
      const data = await apiPost("/api/innovation/auth/signup", {
        name: fullName.trim(), email: emailVal, password,
      });
      // apiPost resolves with parsed JSON on success
      if (data?.token) {
        await setToken(data.token);
        await setUser(data.user || {});
        setOkMsg("Account created! Redirecting…");
        setTimeout(() => navigation.replace("Main"), 300);
      } else {
        setMsg("Signup failed. Please try again.");
      }
    } catch (err) {
      // apiFetch throws on non-2xx — extract detail from error message
      const raw = err?.message || "";
      if (raw.includes("409") || raw.toLowerCase().includes("already registered")) {
        setMsg("Email already registered. Please sign in.");
      } else if (raw.includes("400") || raw.toLowerCase().includes("invalid email")) {
        setMsg("Invalid email address.");
      } else if (raw.includes("Network") || raw.includes("fetch") || raw.includes("connect")) {
        setMsg("Cannot connect to server. Check your connection.");
      } else {
        try {
          const jsonStart = raw.indexOf("{");
          if (jsonStart !== -1) {
            const parsed = JSON.parse(raw.slice(jsonStart));
            setMsg(parsed.detail || "Signup failed.");
          } else {
            setMsg("Signup failed. Please try again.");
          }
        } catch {
          setMsg("Signup failed. Please try again.");
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

      {/* ── Animated scrollable card ── */}
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
            <Text style={styles.cardTitle}>Create Account</Text>

            {/* Full Name */}
            <View style={styles.inputRow}>
              <Feather name="user" size={16} color="#AABBD4" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jones John"
                placeholderTextColor="#C0CEDF"
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <View style={styles.inputRow}>
              <Feather name="mail" size={16} color="#AABBD4" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                value={email}
                onChangeText={setEmail}
                placeholder="jonesjohn@example.com"
                placeholderTextColor="#C0CEDF"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password */}
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

            {/* Repeat Password */}
            <View style={styles.inputRow}>
              <Feather name="lock" size={16} color="#AABBD4" style={styles.inputIcon} />
              <TextInput
                style={[styles.inputField, { flex: 1 }]}
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                placeholder="Repeat password"
                placeholderTextColor="#C0CEDF"
                secureTextEntry={!showRepeat}
              />
              <TouchableOpacity onPress={() => setShowRepeat(v => !v)}>
                <Feather name={showRepeat ? "eye" : "eye-off"} size={16} color="#AABBD4" />
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(v => !v)}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed && <Feather name="check" size={10} color="#FFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms and Conditions</Text>
              </Text>
            </TouchableOpacity>

            {!!msg   && <Text style={styles.err}>{msg}</Text>}
            {!!okMsg && <Text style={styles.ok}>{okMsg}</Text>}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>SIGN UP</Text>
              }
            </TouchableOpacity>

            <Text style={styles.switchText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.switchLink}>Sign In from here</Text>
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
    top: 44, left: 18,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  /* ── Emblem badge — WHITE circle ── */
  emblemBadge: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#FFFFFF",           // ← white so dark emblem shows
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emblemImg: {
    width: 68, height: 68,
    // NO tintColor — keep original dark emblem
  },

  /* ── Brand ── */
  brandName: {
    color: "#FFFFFF", fontSize: 22, fontWeight: "900",
    letterSpacing: 4, marginTop: 0, marginBottom: 4,
  },
  brandSub: {
    color: "rgba(255,255,255,0.88)", fontSize: 13.5,
    fontWeight: "600", letterSpacing: 0.3,
  },

  /* ── Form layout ── */
  formWrapper: { flex: 1, marginTop: -HEADER_H * 0.25 },
  scroll: { paddingHorizontal: 22, paddingBottom: 30 },

  /* ── Card ── */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 24, paddingTop: 26, paddingBottom: 28,
    alignItems: "center",
    shadowColor: BLUE, shadowOpacity: 0.13, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: BLUE, marginBottom: 20 },

  /* ── Inputs ── */
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.2, borderColor: "#D5E3F8", borderRadius: 32,
    paddingHorizontal: 16, paddingVertical: 11,
    marginBottom: 12, backgroundColor: "#FAFCFF", width: "100%",
  },
  inputIcon: { marginRight: 10 },
  inputField: { flex: 1, fontSize: 13.5, color: "#1A2E6B" },

  /* ── Terms ── */
  termsRow: {
    flexDirection: "row", alignItems: "center",
    width: "100%", marginBottom: 18, gap: 8,
  },
  checkbox: {
    width: 16, height: 16, borderRadius: 3,
    borderWidth: 1.5, borderColor: "#C5D8F8",
    backgroundColor: "#FFF", alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: BLUE, borderColor: BLUE },
  termsText: { color: "#8898AA", fontSize: 11.5, flex: 1 },
  termsLink: { color: BLUE, fontWeight: "600" },

  /* ── Button ── */
  actionBtn: {
    backgroundColor: BLUE, borderRadius: 32,
    paddingVertical: 14, width: "100%",
    alignItems: "center", marginBottom: 18,
    shadowColor: BLUE, shadowOpacity: 0.38, shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  actionBtnText: { color: "#FFF", fontSize: 13.5, fontWeight: "800", letterSpacing: 1.4 },

  /* ── Switch ── */
  switchText: { color: "#8898AA", fontSize: 12, textAlign: "center", marginBottom: 3 },
  switchLink: { color: BLUE, fontWeight: "700", fontSize: 13, textAlign: "center" },

  err: { color: "#D33A2C", marginBottom: 8, textAlign: "center", fontSize: 12 },
  ok:  { color: "#14804A", marginBottom: 8, textAlign: "center", fontSize: 12 },
});
