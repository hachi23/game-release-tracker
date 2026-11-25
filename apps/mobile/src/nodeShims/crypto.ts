// The browser stand-in for node:crypto. Only randomUUID runs in the in-app backend; the credential cipher
// is never created on Android (no data key is handed over), so its functions only need to exist.
export const randomUUID = () => crypto.randomUUID();
const unavailable = (name: string) => () => {
  throw new Error(`node:crypto ${name} is not available in the Android preview`);
};
export const createHash = unavailable("createHash");
export const createCipheriv = unavailable("createCipheriv");
export const createDecipheriv = unavailable("createDecipheriv");
export const randomBytes = unavailable("randomBytes");
export default { randomUUID, createHash, createCipheriv, createDecipheriv, randomBytes };
