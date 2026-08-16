import { getStorage } from "firebase/storage";
import { app } from "./firebase";

// Kept out of lib/firebase.ts so the Firebase Storage SDK stays out of the
// main bundle; only Company Management imports this module.
export const storage = getStorage(app);
