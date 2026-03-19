import React from "react";
import { View, Text } from "react-native";

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0077B6" }}>
      <Text style={{ fontSize: 32, fontWeight: "bold", color: "#FFFFFF" }}>
        VaccineGuard
      </Text>
      <Text style={{ fontSize: 16, color: "#E0F0FF", marginTop: 8 }}>
        Web mode is working!
      </Text>
    </View>
  );
}
