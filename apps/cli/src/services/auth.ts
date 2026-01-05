import os from "os";
import path from "path";
import fs from "fs-extra";

const SESSION_FILE = path.join(os.homedir(), ".shiplio_session");

export async function saveToken(token: string) {
  try {
    await fs.writeFile(SESSION_FILE, JSON.stringify({ token }));
  } catch (error) {
    throw new Error("Error saving token");
  }
}

export function readToken() {
  if (fs.existsSync(SESSION_FILE)) {
    const sessionData = fs.readFileSync(SESSION_FILE, "utf-8");
    const { token } = JSON.parse(sessionData);
    return token;
  } else {
    return null;
  }
}

export function logOut() {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
}
