export interface User { id: string; email: string; name: string; avatarUrl: string | null }
export interface Sender { id: string; name: string; email: string; smtpHost: string; smtpPort: number; smtpSecure: boolean; isDefault: boolean; isActive: boolean }
export interface EmailItem {
  id: string; recipient: string; scheduledAt: string; status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
  sentAt: string | null; failedAt: string | null; lastError: string | null; previewUrl: string | null; attemptCount: number;
  campaign: { subject: string; sender: { name: string; email: string } };
}
export interface EmailListResponse { data: EmailItem[]; pagination: { page: number; limit: number; total: number; pages: number } }
export interface SlackStatus { connected: boolean; teamName?: string; channelName?: string; channelId?: string }
