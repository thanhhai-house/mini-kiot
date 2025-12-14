import { OAuth2Client } from "google-auth-library";

export function makeGoogleVerifier(googleClientId) {
  const client = new OAuth2Client(googleClientId);

  return async function verifyGoogleIdToken(idToken) {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid token payload");

    const { sub, email, email_verified, name, picture } = payload;

    if (!email || !email_verified) {
      throw new Error("Email not verified");
    }

    return {
      uid: sub,
      email: email.toLowerCase(),
      name: name || "",
      picture: picture || ""
    };
  };
}
