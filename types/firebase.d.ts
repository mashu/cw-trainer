declare module 'firebase/app' {
  export const initializeApp: any;
  export const getApps: any;
}

declare module 'firebase/auth' {
  export const getAuth: any;
  export class GoogleAuthProvider {}
  export const signInWithPopup: any;
  export const signOut: any;
  export type User = any;
}

declare module 'firebase/firestore' {
  export const getFirestore: any;
  export const collection: any;
  export const doc: any;
  export const getDocs: any;
  export const orderBy: any;
  export const query: any;
  export const setDoc: any;
  export const deleteDoc: any;
}


