import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Spacing, Radius } from "../theme";
import { apiPost, apiGet } from "../api/client";

function fmtINR(amountPaise) {
  const r = (Number(amountPaise) || 0) / 100;
  return `INR ${r.toFixed(2)}`;
}

export default function PaymentScreen({ navigation }) {
  const [payee, setPayee] = useState("merchant@upi");
  const [amount, setAmount] = useState("5");
  const [note, setNote] = useState("Offline UPI soundwave demo");

  const [issuedToken, setIssuedToken] = useState("");
  const [tokenOutput, setTokenOutput] = useState("Create a token…");
  const [decodedOutput, setDecodedOutput] = useState("Token decode is simulated on mobile.");
  const [userName, setUserName] = useState("Account");

  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet("/api/innovation/auth/me");
        if (me?._authError) {
          navigation.replace("Login");
          return;
        }
        const who = me?.user?.name || me?.user?.email;
        if (who) setUserName(who);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const createPayment = async () => {
    const amount_paise = Math.max(1, Math.round(Number(amount) * 100));
    try {
      const res = await apiPost("/api/innovation/payments/create", {
        payee_vpa: payee,
        amount_paise,
        note,
      });
      if (res?._authError) {
        navigation.replace("Login");
        return;
      }
      const tok = res.data?.token || "";
      setIssuedToken(tok);
      setTokenOutput(tok ? tok : JSON.stringify(res.data, null, 2));
    } catch (err) {
      setTokenOutput("Error creating payment: " + err.message);
    }
  };

  const confirmToken = async () => {
    if (!issuedToken) {
      Alert.alert("No token", "Create a payment token first.");
      return;
    }
    try {
      const res = await apiPost("/api/innovation/payments/confirm", {
        token: issuedToken,
      });
      if (res?._authError) {
        navigation.replace("Login");
        return;
      }
      const d = res.data;
      if (d?.status === "confirmed") {
        setDecodedOutput(
          `✅ CONFIRMED\n\nPayment: ${d.payment_id}\nAmount: ${fmtINR(d.payload?.amount_paise)}\nPayee: ${d.payload?.payee_vpa}\n\n${JSON.stringify(d, null, 2)}`
        );
      } else {
        setDecodedOutput(JSON.stringify(d, null, 2));
      }
    } catch (err) {
      setDecodedOutput("Error: " + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Offline Micropayment</Text>
          <Text style={styles.headerSub}>Sound-wave UPI demo</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{userName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Offline micropayment via sound waves
          </Text>
          <Text style={styles.cardSub}>
            Token → audio → microphone decode → confirm. This demonstrates
            offline transfer via sound (concept demo).
          </Text>

          <Text style={styles.label}>Payee VPA</Text>
          <TextInput
            style={styles.input}
            value={payee}
            onChangeText={setPayee}
            placeholder="merchant@upi"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Amount (INR)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="5"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Note</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Payment note"
            placeholderTextColor={Colors.textMuted}
          />

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={createPayment} activeOpacity={0.8}>
              <LinearGradient
                colors={[Colors.brandStart, Colors.brandMid]}
                style={styles.btnPrimary}
              >
                <Text style={styles.btnPrimaryText}>Create Token</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnSecondary,
                !issuedToken && styles.btnDisabled,
              ]}
              onPress={confirmToken}
              disabled={!issuedToken}
            >
              <Text style={styles.btnSecondaryText}>Confirm Token</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Token Output */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Issued Token</Text>
          <View style={styles.preBox}>
            <Text style={styles.preText} selectable>
              {tokenOutput}
            </Text>
          </View>
        </View>

        {/* Decoded Output */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Confirmation Result</Text>
          <View style={styles.preBox}>
            <Text style={styles.preText} selectable>
              {decodedOutput}
            </Text>
          </View>
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📱 Mobile Note</Text>
          <Text style={styles.infoText}>
            Audio-based sound-wave transmission requires Web Audio API and works
            best in the browser version. On mobile, the payment token
            creation and confirmation still work through the backend API.
          </Text>
        </View>

        {/* Architecture info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>1.</Text>
            <Text style={styles.bulletText}>
              <Text style={{ fontWeight: "700" }}>Create Token</Text> — Backend
              generates a signed JWT containing payment details
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>2.</Text>
            <Text style={styles.bulletText}>
              <Text style={{ fontWeight: "700" }}>Sound Transmission</Text>{" "}
              (browser) — Token bits encoded as 18/19kHz tones
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>3.</Text>
            <Text style={styles.bulletText}>
              <Text style={{ fontWeight: "700" }}>Mic Decode</Text> (browser) —
              FFT analysis classifies frequency → bits → token
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>4.</Text>
            <Text style={styles.bulletText}>
              <Text style={{ fontWeight: "700" }}>Confirm</Text> — Backend
              verifies signature and marks payment as confirmed
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: 48,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  backBtn: { color: Colors.brandStart, fontWeight: "700", fontSize: 15 },
  headerTitle: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  headerSub: { color: Colors.textMuted, fontSize: 11 },
  chip: {
    backgroundColor: Colors.chipBg,
    borderWidth: 1,
    borderColor: Colors.chipBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  chipText: { color: Colors.chipText, fontWeight: "800", fontSize: 11 },

  scroll: { padding: Spacing.md },

  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.bgCardBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTitle: { color: Colors.text, fontSize: 17, fontWeight: "800" },
  cardSub: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: Radius.md,
    color: Colors.text,
    padding: 12,
    fontSize: 15,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  btnPrimary: {
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnSecondaryText: { color: Colors.text, fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.4 },

  preBox: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: Radius.md,
    padding: 14,
    marginTop: Spacing.sm,
  },
  preText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 16,
    opacity: 0.85,
  },

  infoBox: {
    backgroundColor: "rgba(61,159,217,0.08)",
    borderWidth: 1,
    borderColor: "rgba(61,159,217,0.2)",
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoTitle: {
    color: Colors.chipText,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 6,
  },
  infoText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  bulletRow: { flexDirection: "row", marginTop: 8 },
  bulletDot: {
    color: Colors.brandStart,
    fontSize: 14,
    marginRight: 8,
    fontWeight: "800",
    width: 18,
  },
  bulletText: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
    opacity: 0.85,
  },
});
