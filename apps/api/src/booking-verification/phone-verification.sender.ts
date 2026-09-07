export const PHONE_VERIFICATION_SENDER = Symbol("PHONE_VERIFICATION_SENDER");

export interface SendVerificationCodeInput {
  businessId: string;
  code: string;
  phoneNumber: string;
}

export interface PhoneVerificationSender {
  sendVerificationCode(input: SendVerificationCodeInput): Promise<void>;
}
