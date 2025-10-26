declare module 'firebase/app' {
  export const initializeApp: any;
  export const getApps: any;
  export const getApp: any;
}

declare module 'firebase/auth' {
  export const getAuth: any;
  export class GoogleAuthProvider {}
  export const signInWithPopup: any;
  export const signInWithRedirect: any;
  export const getRedirectResult: any;
  export const signOut: any;
  export type User = any;
  export const createUserWithEmailAndPassword: any;
  export const signInWithEmailAndPassword: any;
  export const onAuthStateChanged: any;
  export type UserCredential = any;
  export const setPersistence: any;
  export const browserLocalPersistence: any;
}

declare module 'firebase/firestore' {
  export const getFirestore: any;
  export const collection: any;
  export const doc: any;
  export const getDoc: any;
  export const getDocs: any;
  export const orderBy: any;
  export const query: any;
  export const limit: any;
  export const collectionGroup: any;
  export const setDoc: any;
  export const deleteDoc: any;
}


