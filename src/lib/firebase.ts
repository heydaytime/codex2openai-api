"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

function getAuthInstance(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getApp());
  }
  return authInstance;
}

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();
const microsoftProvider = new OAuthProvider("microsoft.com");

export type OAuthProviderName = "google" | "github" | "facebook" | "twitter" | "microsoft";

const providers: Record<OAuthProviderName, GoogleAuthProvider | GithubAuthProvider | FacebookAuthProvider | TwitterAuthProvider | OAuthProvider> = {
  google: googleProvider,
  github: githubProvider,
  facebook: facebookProvider,
  twitter: twitterProvider,
  microsoft: microsoftProvider,
};

export async function signInWith(providerName: OAuthProviderName) {
  return signInWithPopup(getAuthInstance(), providers[providerName]);
}

export async function signOut() {
  return firebaseSignOut(getAuthInstance());
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getAuthInstance(), callback);
}

export async function getIdToken(): Promise<string | null> {
  const user = getAuthInstance().currentUser;
  if (!user) return null;
  return user.getIdToken();
}
