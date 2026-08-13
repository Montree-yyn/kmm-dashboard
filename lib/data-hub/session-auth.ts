import { auth } from "../firebase";

export async function getSessionAuthToken() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your secure session has expired. Sign in again to import data.");
  return token;
}
