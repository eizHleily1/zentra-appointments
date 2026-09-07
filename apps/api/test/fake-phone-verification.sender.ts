import type {
  PhoneVerificationSender,
  SendVerificationCodeInput
} from "../src/booking-verification/phone-verification.sender";

/**
 * Deterministic test double so specs read the issued code directly instead of
 * scraping logs, and so no external SMS vendor is ever required.
 */
export class FakePhoneVerificationSender implements PhoneVerificationSender {
  readonly sent: SendVerificationCodeInput[] = [];
  private failure: Error | null = null;

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }

    this.sent.push(input);
  }

  /** Simulates an SMS vendor outage so specs can assert the rollback behaviour. */
  failSends(error = new Error("SMS provider unavailable")): void {
    this.failure = error;
  }

  succeedSends(): void {
    this.failure = null;
  }

  lastCodeFor(phoneNumber: string): string {
    const match = [...this.sent].reverse().find((entry) => entry.phoneNumber === phoneNumber);

    if (!match) {
      throw new Error(`No verification code was sent to ${phoneNumber}`);
    }

    return match.code;
  }

  reset(): void {
    this.sent.length = 0;
    this.failure = null;
  }
}
