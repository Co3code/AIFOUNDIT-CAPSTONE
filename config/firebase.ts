import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAzZJjZ4slN9dLir5-Z_m5Y5hZK3Izvu60",
  authDomain: "aifoundit-3b92d.firebaseapp.com",
  projectId: "aifoundit-3b92d",
  storageBucket: "aifoundit-3b92d.firebasestorage.app",
  messagingSenderId: "960090796731",
  appId: "1:960090796731:web:7b22887ea228e78b32ef9e",
  measurementId: "G-ELRF281TBZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
