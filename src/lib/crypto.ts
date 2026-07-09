import CryptoJS from 'crypto-js';

// Symmetric Key for Group Chats (derived from chatId and a system secret)
const SYSTEM_SECRET = "teengenius_cognitive_protocol_alpha_9";

export function encryptSimple(text: string, secretKey: string) {
  return CryptoJS.AES.encrypt(text, secretKey + SYSTEM_SECRET).toString();
}

export function decryptSimple(ciphertext: string, secretKey: string) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey + SYSTEM_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return null;
  }
}

/**
 * End-to-End Encryption Utility
 * Uses Web Crypto API (SubtleCrypto)
 */

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)));

  return {
    publicKey: publicBase64,
    privateKey: keyPair.privateKey
  };
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const binaryDerString = window.atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

// Store private key in IndexedDB for persistence (simulated here with a simple ref for session)
// In a real app, you'd use a secure storage or prompt for a password to decrypt it.
let sessionPrivateKey: CryptoKey | null = null;

export function setSessionPrivateKey(key: CryptoKey) {
  sessionPrivateKey = key;
}

export function hasPrivateKey() {
  return sessionPrivateKey !== null;
}

/**
 * Hybrid Encryption:
 * 1. Generate one-time AES key
 * 2. Encrypt message with AES-GCM
 * 3. Encrypt AES key with Recipient's RSA Public Key
 */
export async function encryptMessage(text: string, recipientPublicKeyPem: string): Promise<string> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);

  // 1. Generate AES Key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt Text with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedText
  );

  // 3. Encrypt AES Key with RSA
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    exportedAesKey
  );

  // Combine IV + Encrypted AES Key + Encrypted Content
  const combined = new Uint8Array(iv.length + encryptedAesKey.byteLength + encryptedContent.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedAesKey), iv.length);
  combined.set(new Uint8Array(encryptedContent), iv.length + encryptedAesKey.byteLength);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptMessage(encryptedBase64: string): Promise<string> {
  if (!sessionPrivateKey) throw new Error("Private key not available. Device not registered?");

  const combined = new Uint8Array(atob(encryptedBase64).split("").map(c => c.charCodeAt(0)));
  
  const iv = combined.slice(0, 12);
  const encryptedAesKey = combined.slice(12, 12 + 256); // RSA 2048 produces 256 bytes
  const encryptedContent = combined.slice(12 + 256);

  // 1. Decrypt AES Key with RSA
  const aesKeyRaw = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    sessionPrivateKey,
    encryptedAesKey
  );

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  // 2. Decrypt Content with AES
  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedContent
  );

  return new TextDecoder().decode(decryptedContent);
}

// IndexedDB Helper for Private Key persistence
const DB_NAME = 'ClassHubCrypto';
const STORE_NAME = 'keys';

export async function savePrivateKeyToDB(key: CryptoKey): Promise<void> {
  sessionPrivateKey = key; // Save in session memory globally instantly as a solid fallback
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(key, 'privateKey');
        tx.oncomplete = () => resolve();
      };
      request.onerror = () => {
        console.warn("IndexedDB opened with error, falling back to session-memory.");
        resolve(); // Handle gracefully with on-device session key
      };
    } catch (e) {
      console.warn("IndexedDB access blocked by security sandbox, falling back to session-memory.", e);
      resolve(); // Graceful resolution
    }
  });
}

export async function loadPrivateKeyFromDB(): Promise<CryptoKey | null> {
  if (sessionPrivateKey) return sessionPrivateKey;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(STORE_NAME, 'readonly');
        const getReq = tx.objectStore(STORE_NAME).get('privateKey');
        getReq.onsuccess = () => {
          const key = getReq.result as CryptoKey;
          if (key) sessionPrivateKey = key;
          resolve(key || null);
        };
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}
