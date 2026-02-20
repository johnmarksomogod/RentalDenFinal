// Firebase SDK for AdminSide (React Native/Expo)
import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAR4qxgZ3Hby17weDvxGbvGRNHhsR7v-EY",
  authDomain: "qr-based-driver-vehicle.firebaseapp.com",
  projectId: "qr-based-driver-vehicle",
  storageBucket: "qr-based-driver-vehicle.firebasestorage.app",
  messagingSenderId: "729947875572",
  appId: "1:729947875572:web:813c610b9842cec73456a1",
  measurementId: "G-D043MK5QV7",
};

const app = initializeApp(firebaseConfig);

// Use persistent auth storage on native (iOS/Android) so the user
// stays logged in across app reloads. On web, use the default browser
// persistence from getAuth.
const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Secondary app for creating new users without affecting owner's session
const appUserCreation = initializeApp(firebaseConfig, "UserCreation");
const authUserCreation = getAuth(appUserCreation);

export { app, auth, db, storage, functions, appUserCreation, authUserCreation };
