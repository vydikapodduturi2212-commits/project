
export const firebaseConfig = {
  apiKey: "AIzaSyDSiqrKBVvFMQUkOcmahvownJyuE6gWZps",
  authDomain: "ace-nexus-e77a5.firebaseapp.com",
  projectId: "ace-nexus-e77a5",
  storageBucket: "ace-nexus-e77a5.firebasestorage.app",
  messagingSenderId: "622299407603",
  appId: "1:622299407603:web:1c488cc83e8e5937918386"
};

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every((value) => typeof value === "string" && value.trim().length > 0);
}
