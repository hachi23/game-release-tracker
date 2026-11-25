// The browser stand-in for node:os. App-data paths are only computed, never opened, in the Android preview.
export const homedir = () => "/app-data";
export const tmpdir = () => "/tmp";
export const platform = () => "android";
export default { homedir, tmpdir, platform };
