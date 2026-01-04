import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Will enable later

const firebaseConfig = {
    apiKey: "AIzaSyB9AwMcEwXDOTVHfWIGpPhCR6gj7OA1zXY",
    authDomain: "controle-dentista.firebaseapp.com",
    projectId: "controle-dentista",
    storageBucket: "controle-dentista.firebasestorage.app",
    messagingSenderId: "394179185800",
    appId: "1:394179185800:web:6ca052fe01b6037dc4633d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
