export interface EmailJobData {
  scheduledEmailId: string;
}

export interface JwtUser {
  sub: string;
  email: string;
  purpose?: "session" | "google-oauth" | "slack-oauth";
}
