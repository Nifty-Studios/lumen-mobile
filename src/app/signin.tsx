// Sign in later: from Settings, the home card, or Share.
import { router } from "expo-router";
import { AuthScreen } from "../components/AuthScreen";

export default function SignIn() {
  return <AuthScreen onClose={() => router.back()} onDone={() => router.back()} />;
}
