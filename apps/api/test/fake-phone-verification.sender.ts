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

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    this.sent.push(input);
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
  }
}
